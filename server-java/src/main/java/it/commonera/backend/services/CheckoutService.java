package it.commonera.backend.services;

import it.commonera.backend.entities.*;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Conclusione dell'ordine, in **due tempi**.
 *
 * Fase A ({@code priceAndReserve}): l'ordine nasce `pending`, la merce viene
 * riservata, buono e punti vengono impegnati. Fase B: il fornitore conferma
 * l'incasso e solo allora l'ordine diventa `paid` — vedi
 * {@link PaymentWebhookService}, che assegna i punti e svuota il carrello.
 *
 * Perche' due tempi. Prima tutto stava in **una** transazione che si chiudeva
 * dichiarando l'ordine pagato senza che un euro fosse passato di mano. Infilare
 * li' dentro la chiamata al fornitore sarebbe stato peggio: terrebbe aperta una
 * connessione di database per tutta la latenza di rete, e se il fornitore
 * rispondesse dopo un rollback avremmo **incassato per un ordine che non
 * esiste**. Quindi la chiamata di rete sta fuori da ogni transazione, e cio' che
 * resta impegnato quando qualcosa va storto lo libera
 * {@link OrderCompensationService}.
 *
 * L'ordine dei passi dentro la fase A non e' decorativo: **prima si riserva la
 * merce, poi si tocca il denaro**. Al contrario, un carrello senza giacenza
 * bruciava il buono e poi falliva, e il rollback era l'unica rete di sicurezza.
 */
@Service
public class CheckoutService {

    private static final Logger log = LoggerFactory.getLogger(CheckoutService.class);

    /** Costi di spedizione e soglia della gratuita': stessi valori del backend Node. */
    private static final BigDecimal SHIPPING_STANDARD = new BigDecimal("4.90");
    private static final BigDecimal SHIPPING_EXPRESS = new BigDecimal("9.90");
    private static final BigDecimal FREE_SHIPPING_THRESHOLD = new BigDecimal("100");

    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final ProductVariantRepository variants;
    private final UserAddressRepository addresses;
    private final CartRepository carts;
    private final PricingService pricing;
    private final GiftCardService giftCards;
    private final LoyaltyService loyalty;
    private final PromoCodeService promoCodes;
    private final PaymentGateway gateway;
    private final OrderCompensationService compensation;
    private final TransactionTemplate tx;

    public CheckoutService(OrderRepository orders, PaymentRepository payments,
                           ProductVariantRepository variants, UserAddressRepository addresses,
                           CartRepository carts, PricingService pricing,
                           GiftCardService giftCards, LoyaltyService loyalty,
                           PromoCodeService promoCodes, PaymentGateway gateway,
                           OrderCompensationService compensation, TransactionTemplate tx) {
        this.orders = orders;
        this.payments = payments;
        this.variants = variants;
        this.addresses = addresses;
        this.carts = carts;
        this.pricing = pricing;
        this.giftCards = giftCards;
        this.loyalty = loyalty;
        this.promoCodes = promoCodes;
        this.gateway = gateway;
        this.compensation = compensation;
        this.tx = tx;
    }

    /**
     * Le transazioni si aprono con {@link TransactionTemplate} e non con
     * {@code @Transactional} sui metodi privati: Spring applica quell'annotazione
     * con un proxy, e una chiamata da un metodo dello stesso oggetto **non passa
     * dal proxy**. Le fasi sarebbero rimaste senza transazione, in silenzio.
     */
    public Map<String, Object> placeOrder(UUID userId, Request request) {
        Draft draft = tx.execute(status -> priceAndReserve(userId, request));

        // Niente da incassare (un buono che copre tutto): non c'e' nessuna
        // conferma da aspettare, quindi l'ordine e' pagato adesso.
        if (draft.toCharge().signum() == 0) {
            return tx.execute(status -> confirmWithoutPayment(draft, userId));
        }

        PaymentGateway.Intent intent;
        try {
            intent = gateway.createIntent(draft.toCharge(), "EUR", draft.orderId());
        } catch (RuntimeException e) {
            release(draft.orderId(), userId, "Apertura del pagamento fallita");
            throw e;
        }

        try {
            tx.executeWithoutResult(status -> attachIntent(draft, userId, intent.id()));
        } catch (RuntimeException e) {
            // Prima si chiude l'intent, poi si libera l'ordine: se il primo passo
            // fallisse dopo aver liberato la merce, resterebbe aperta la
            // possibilita' di incassare per un ordine ormai annullato.
            cancelQuietly(intent.id());
            release(draft.orderId(), userId, "Registrazione del pagamento fallita");
            throw e;
        }

        var response = baseResponse(draft);
        response.put("clientSecret", intent.clientSecret());
        response.put("status", "pending");
        return response;
    }

    /**
     * Fase A. Calcola, salva l'ordine, **riserva la merce** e impegna buono e
     * punti. Non assegna punti, non svuota il carrello e non dichiara pagato
     * niente: quelle tre cose appartengono alla conferma.
     */
    private Draft priceAndReserve(UUID userId, Request request) {
        // 1. L'indirizzo deve essere di chi ordina, non uno qualsiasi il cui id si
        //    conosce: senza questo controllo si potrebbe spedire a casa d'altri.
        var address = addresses.findByIdAndUserId(request.addressId(), userId)
                .orElseThrow(() -> ApiException.notFound("Address not found"));

        if (request.items() == null || request.items().isEmpty()) {
            throw ApiException.badRequest("Cart is empty");
        }

        // 2. Prezzi e disponibilita' si rileggono dal database: quello che manda il
        //    client non fa testo, altrimenti basterebbe cambiare un numero nella
        //    richiesta per pagare meno.
        var order = new Order();
        order.setUserId(userId);
        order.setAddressId(address.getId());
        order.setShippingMethod(request.shippingMethod() == null ? "standard" : request.shippingMethod());

        BigDecimal subtotal = BigDecimal.ZERO;
        for (Line line : request.items()) {
            var variant = variants.findById(line.variantId())
                    .orElseThrow(() -> ApiException.badRequest("Variant " + line.variantId() + " not found"));
            if (!Boolean.TRUE.equals(variant.getIsActive())) {
                throw ApiException.badRequest("Variant " + line.variantId() + " not found");
            }
            if (line.quantity() <= 0) throw ApiException.badRequest("Quantity must be positive");

            var price = pricing.of(variant);
            var lineTotal = price.lineTotal(line.quantity());

            var item = new OrderItem();
            item.setOrder(order);
            item.setVariantId(variant.getId());
            // Copiati, non riferiti: la fattura di ieri deve restare leggibile anche
            // se il prodotto viene rinominato o tolto dal catalogo.
            item.setProductName(variant.getProduct().getName());
            item.setVariantLabel(variant.label());
            item.setSkuSnapshot(variant.getSku());
            item.setUnitPrice(price.unit());
            item.setQuantity(line.quantity());
            item.setDiscountApplied(price.original().subtract(price.unit())
                    .multiply(BigDecimal.valueOf(line.quantity())).setScale(2, RoundingMode.HALF_UP));
            item.setLineTotal(lineTotal);
            order.getItems().add(item);

            subtotal = subtotal.add(lineTotal);
        }

        // 2b. Codice promo: si convalida su un totale gia' scontato dalle offerte di
        //     prodotto (`subtotal`, che le righe sopra calcolano dal prezzo scontato di
        //     ciascuna variante), non sul prezzo di listino. L'uso si registra solo dopo
        //     che l'ordine esiste davvero — vedi punto 5.
        BigDecimal promoDiscount = BigDecimal.ZERO;
        UUID promoCodeId = null;
        if (request.promoCode() != null && !request.promoCode().isBlank()) {
            var promo = promoCodes.validate(request.promoCode(), subtotal, userId);
            promoDiscount = promo.discountValue();
            promoCodeId = promo.promoCodeId();
        }

        // La spedizione gratuita si guarda sull'importo **al netto del promo**: uno
        // sconto che fa scendere sotto soglia deve far ricomparire il costo di
        // spedizione, non farlo sparire due volte.
        BigDecimal afterPromo = subtotal.subtract(promoDiscount);
        BigDecimal shipping = afterPromo.compareTo(FREE_SHIPPING_THRESHOLD) >= 0
                ? BigDecimal.ZERO
                : ("express".equals(order.getShippingMethod()) ? SHIPPING_EXPRESS : SHIPPING_STANDARD);

        order.setSubtotal(subtotal.setScale(2, RoundingMode.HALF_UP));
        order.setShippingCost(shipping);
        order.setDiscountTotal(promoDiscount.setScale(2, RoundingMode.HALF_UP));
        order.setPromoCodeId(promoCodeId);
        order.setTotal(afterPromo.add(shipping).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        order.setNotes(request.notes());
        var saved = orders.save(order);

        addHistory(saved, OrderStatus.pending, userId, null);

        // 3. Riserva della giacenza, **condizionale**: due checkout sull'ultimo pezzo
        //    leggono entrambi 1 e scalerebbero entrambi, lasciando -1.
        //
        //    Sta qui, **prima** di codice promo, punti e buono, perche' e' il passo
        //    che fallisce per cause fuori dal controllo di chi compra. Farlo per
        //    ultimo, com'era, significava aver gia' consumato un uso del codice,
        //    speso i punti e scalato il buono per un ordine che non nascera' mai,
        //    e affidarne il recupero al solo rollback.
        for (Line line : request.items()) {
            if (variants.decrementStock(line.variantId(), line.quantity()) == 0) {
                throw ApiException.badRequest("Insufficient stock, please review your cart");
            }
        }

        // 4. Uso del codice registrato ora che l'ordine ha un id reale e la merce e'
        //    riservata.
        if (promoCodeId != null) {
            promoCodes.recordUse(promoCodeId, userId, saved.getId(), promoDiscount.setScale(2, RoundingMode.HALF_UP));
        }

        // 5. Punti prima del buono: il buono copre solo cio' che resta, e non viene
        //    consumato al posto dei punti.
        BigDecimal loyaltyDiscount = BigDecimal.ZERO;
        if (request.loyaltyPoints() != null && request.loyaltyPoints() > 0) {
            var redeemed = loyalty.redeem(userId, saved.getId(), request.loyaltyPoints(), saved.getTotal());
            loyaltyDiscount = redeemed.discount();
        }

        BigDecimal payable = saved.getTotal().subtract(loyaltyDiscount).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        if (loyaltyDiscount.signum() > 0) {
            saved.setDiscountTotal(saved.getDiscountTotal().add(loyaltyDiscount));
            saved.setTotal(payable);
        }

        BigDecimal giftCardApplied = BigDecimal.ZERO;
        if (request.giftCardCode() != null && !request.giftCardCode().isBlank()) {
            var redeemed = giftCards.redeem(request.giftCardCode(), payable, saved.getId());
            giftCardApplied = redeemed.applied();
            saved.setGiftCardId(redeemed.giftCardId());
            saved.setGiftCardAmount(giftCardApplied);
        }

        BigDecimal toCharge = payable.subtract(giftCardApplied).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        return new Draft(saved.getId(), toCharge, saved.getTotal(), loyaltyDiscount, giftCardApplied,
                request.items());
    }

    /**
     * Ordine coperto per intero dal buono: non c'e' nessun fornitore da
     * aspettare, quindi la conferma avviene subito e con essa punti e
     * svuotamento del carrello.
     */
    private Map<String, Object> confirmWithoutPayment(Draft draft, UUID userId) {
        var order = orders.findById(draft.orderId()).orElseThrow();

        var payment = new Payment();
        payment.setOrderId(order.getId());
        payment.setUserId(userId);
        payment.setStatus(Payment.PaymentStatus.succeeded);
        payment.setMethod(Payment.PaymentMethod.gift_card);
        payment.setAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        payment.setPaidAt(java.time.LocalDateTime.now());
        payments.save(payment);

        order.setStatus(OrderStatus.paid);
        addHistory(order, OrderStatus.paid, userId, "Coperto interamente da buono");

        emptyCart(userId, draft.items());
        awardPoints(order);

        var response = baseResponse(draft);
        response.put("status", "paid");
        return response;
    }

    /**
     * Registra il tentativo di incasso. {@code providerTxId} e' UNIQUE a schema:
     * e' la chiave con cui il webhook riconosce l'ordine ed evita di contare due
     * volte lo stesso evento.
     */
    private void attachIntent(Draft draft, UUID userId, String intentId) {
        var payment = new Payment();
        payment.setOrderId(draft.orderId());
        payment.setUserId(userId);
        payment.setStatus(Payment.PaymentStatus.pending);
        payment.setMethod(Payment.PaymentMethod.credit_card);
        payment.setAmount(draft.toCharge());
        // Il nome del fornitore dice la verita' su dove sono finiti i soldi. Con
        // il doppio non sono finiti da nessuna parte, e la riga a database non
        // deve lasciar credere il contrario.
        payment.setProvider(gateway.isReal() ? "stripe" : "simulated");
        payment.setProviderTxId(intentId);
        payments.save(payment);
    }

    /** Punti sull'imponibile davvero scontato: {@code subtotale - sconti}. */
    private void awardPoints(Order order) {
        loyalty.award(order.getUserId(), order.getId(),
                order.getSubtotal().subtract(order.getDiscountTotal()));
    }

    private void emptyCart(UUID userId, List<Line> items) {
        carts.findByUserId(userId).ifPresent(cart -> {
            for (Line line : items) {
                cart.getItems().stream()
                        .filter(i -> i.getVariant().getId().equals(line.variantId()))
                        .findFirst()
                        .ifPresent(item -> {
                            // Si scala la quantita' ordinata: chi ne aveva tre e ne
                            // ordina uno deve ritrovarsi gli altri due.
                            if (item.getQuantity() > line.quantity()) {
                                item.setQuantity(item.getQuantity() - line.quantity());
                            } else {
                                cart.getItems().remove(item);
                            }
                        });
            }
            carts.save(cart);
        });
    }

    /**
     * Libera cio' che la fase A aveva impegnato. Rilegge l'ordine dentro la
     * propria transazione: quello della fase A e' staccato, e leggergli le righe
     * farebbe esplodere il caricamento pigro.
     */
    private void release(UUID orderId, UUID userId, String note) {
        try {
            tx.executeWithoutResult(status -> orders.findById(orderId).ifPresent(order ->
                    compensation.releaseAndCancel(order, List.of(OrderStatus.pending), userId, note)));
        } catch (RuntimeException e) {
            // Non si nasconde l'errore originale dietro a quello della pulizia:
            // l'ordine resta `pending` e lo raccogliera' il reaper.
            log.error("Compensazione fallita per l'ordine {}: resta pending", orderId, e);
        }
    }

    private void cancelQuietly(String intentId) {
        try {
            gateway.cancelIntent(intentId);
        } catch (RuntimeException e) {
            // Un intent non annullato scade da solo: vale la pena registrarlo,
            // non vale la pena far fallire due volte la stessa richiesta.
            log.warn("Intent {} non annullato: scadra' da solo", intentId, e);
        }
    }

    private LinkedHashMap<String, Object> baseResponse(Draft draft) {
        var response = new LinkedHashMap<String, Object>();
        response.put("orderId", draft.orderId());
        // Il totale restituito e' quello **effettivo**: rispondere con quello calcolato
        // prima degli sconti farebbe vedere al cliente un importo diverso da quello
        // addebitato e scritto a database.
        response.put("total", draft.total());
        response.put("amountToPay", draft.toCharge());
        response.put("loyaltyDiscount", draft.loyaltyDiscount());
        response.put("giftCardApplied", draft.giftCardApplied());
        return response;
    }

    private void addHistory(Order order, OrderStatus status, UUID changedBy, String note) {
        var entry = new OrderStatusHistory();
        entry.setOrder(order);
        entry.setStatus(status);
        entry.setChangedBy(changedBy);
        entry.setNote(note);
        order.getStatusHistory().add(entry);
    }

    /** Quel che la fase A consegna alle fasi successive. */
    private record Draft(UUID orderId, BigDecimal toCharge, BigDecimal total,
                         BigDecimal loyaltyDiscount, BigDecimal giftCardApplied, List<Line> items) {}

    public record Line(UUID variantId, int quantity) {}

    public record Request(
            UUID addressId,
            List<Line> items,
            String shippingMethod,
            String promoCode,
            String giftCardCode,
            Integer loyaltyPoints,
            String notes) {}
}

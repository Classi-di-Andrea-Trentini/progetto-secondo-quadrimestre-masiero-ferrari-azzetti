package it.commonera.backend.services;

import it.commonera.backend.entities.*;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Conclusione dell'ordine.
 *
 * Tutto avviene in **una transazione**: righe, storico, pagamento, scalo della
 * giacenza, buono, punti e svuotamento del carrello. Se una qualsiasi di queste cose
 * fallisce, non deve restarne a metà nessuna — un ordine creato con la giacenza non
 * scalata, o un buono bruciato per un ordine mai nato, sono guasti che si scoprono
 * settimane dopo e non si sanno piu' ricostruire.
 */
@Service
public class CheckoutService {

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

    public CheckoutService(OrderRepository orders, PaymentRepository payments,
                           ProductVariantRepository variants, UserAddressRepository addresses,
                           CartRepository carts, PricingService pricing,
                           GiftCardService giftCards, LoyaltyService loyalty,
                           PromoCodeService promoCodes) {
        this.orders = orders;
        this.payments = payments;
        this.variants = variants;
        this.addresses = addresses;
        this.carts = carts;
        this.pricing = pricing;
        this.giftCards = giftCards;
        this.loyalty = loyalty;
        this.promoCodes = promoCodes;
    }

    @Transactional
    public Map<String, Object> placeOrder(UUID userId, Request request) {
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
        //     che l'ordine esiste davvero — vedi punto 7.
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

        // 2c. Uso del codice registrato ora che l'ordine ha un id reale: se il resto del
        //     checkout fallisse dopo, il rollback della transazione annulla anche questo.
        if (promoCodeId != null) {
            promoCodes.recordUse(promoCodeId, userId, saved.getId(), promoDiscount.setScale(2, RoundingMode.HALF_UP));
        }

        // 3. Punti prima del buono: il buono copre solo cio' che resta, e non viene
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

        // 4. Pagamento. Senza un fornitore configurato l'incasso non e' reale: resta
        //    registrato come riuscito, ed e' un debito dichiarato, non un dettaglio
        //    dimenticato.
        var payment = new Payment();
        payment.setOrderId(saved.getId());
        payment.setUserId(userId);
        payment.setStatus(Payment.PaymentStatus.succeeded);
        payment.setMethod(toCharge.signum() > 0
                ? Payment.PaymentMethod.credit_card
                : Payment.PaymentMethod.gift_card);
        payment.setAmount(toCharge);
        payment.setPaidAt(java.time.LocalDateTime.now());
        payments.save(payment);

        saved.setStatus(OrderStatus.paid);
        addHistory(saved, OrderStatus.paid, userId, "Pagamento registrato");

        // 5. Scalo della giacenza, **condizionale**: due checkout sull'ultimo pezzo
        //    leggono entrambi 1 e scalerebbero entrambi, lasciando -1.
        for (Line line : request.items()) {
            if (variants.decrementStock(line.variantId(), line.quantity()) == 0) {
                throw ApiException.badRequest("Insufficient stock, please review your cart");
            }
        }

        // 6. Il carrello si svuota qui dentro, non dal client dopo la risposta: se
        //    quella chiamata fallisse, resterebbero ordine fatto e carrello pieno.
        carts.findByUserId(userId).ifPresent(cart -> {
            for (Line line : request.items()) {
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

        // I punti maturano sull'imponibile **davvero** scontato: vanno tolti sia lo
        // sconto del codice promo sia quello dei punti riscattati. Sottraendo solo il
        // secondo, un codice promo regalava punti su denaro mai incassato — credito
        // creato dal nulla a ogni ordine scontato.
        loyalty.award(userId, saved.getId(), subtotal.subtract(promoDiscount).subtract(loyaltyDiscount));

        var response = new LinkedHashMap<String, Object>();
        response.put("orderId", saved.getId());
        // Il totale restituito e' quello **effettivo**: rispondere con quello calcolato
        // prima degli sconti farebbe vedere al cliente un importo diverso da quello
        // addebitato e scritto a database.
        response.put("total", saved.getTotal());
        response.put("loyaltyDiscount", loyaltyDiscount);
        response.put("giftCardApplied", giftCardApplied);
        response.put("status", "paid");
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

package it.commonera.backend.services;

import it.commonera.backend.entities.*;
import it.commonera.backend.repositories.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Dati di prova condivisi.
 *
 * Ogni test costruiva da se' utente, categoria, prodotto e variante: lo stesso
 * blocco copiato in ogni classe. Il percorso dei pagamenti ha bisogno di ordini
 * gia' in stato `pending` in quattro classi diverse, e quattro copie della stessa
 * impalcatura divergono al primo campo aggiunto allo schema.
 */
@Component
public class TestFixtures {

    private final UserRepository users;
    private final UserAddressRepository addresses;
    private final OrderRepository orders;
    private final GiftCardService giftCards;
    private final LoyaltyEntryRepository loyaltyEntries;
    private final CheckoutService checkout;
    private final PaymentRepository payments;
    private final PaymentWebhookService webhook;
    private final CartRepository carts;
    private final GiftCardRepository giftCardRepo;

    @PersistenceContext
    private EntityManager em;

    public TestFixtures(UserRepository users, UserAddressRepository addresses, OrderRepository orders,
                        GiftCardService giftCards, LoyaltyEntryRepository loyaltyEntries,
                        CheckoutService checkout, PaymentRepository payments,
                        PaymentWebhookService webhook, CartRepository carts,
                        GiftCardRepository giftCardRepo) {
        this.users = users;
        this.addresses = addresses;
        this.orders = orders;
        this.giftCards = giftCards;
        this.loyaltyEntries = loyaltyEntries;
        this.checkout = checkout;
        this.payments = payments;
        this.webhook = webhook;
        this.carts = carts;
        this.giftCardRepo = giftCardRepo;
    }

    /**
     * Un checkout fermo in attesa dell'incasso: ordine `pending`, merce
     * riservata, carrello ancora pieno. E' lo stato su cui lavora il webhook.
     */
    public PendingCheckout aPendingCheckout() {
        return pendingCheckout(null);
    }

    /** Come sopra, ma con un buono che copre **in parte**: resta qualcosa da incassare. */
    public PendingCheckout aPendingCheckoutWithGiftCard() {
        return pendingCheckout(new BigDecimal("20.00"));
    }

    private PendingCheckout pendingCheckout(BigDecimal giftCardBalance) {
        var buyer = aUser();
        var address = anAddressFor(buyer);
        var variant = aVariantWithStock(10);
        int quantity = 2;

        // Il carrello va riempito davvero: il webhook deve svuotarlo, e un
        // carrello gia' vuoto farebbe passare il test senza provare niente.
        var cart = new Cart();
        cart.setUserId(buyer.getId());
        var cartItem = new CartItem();
        cartItem.setCart(cart);
        cartItem.setVariant(variant);
        cartItem.setQuantity(quantity);
        cart.getItems().add(cartItem);
        carts.save(cart);

        GiftCard card = giftCardBalance == null ? null
                : giftCards.issue(buyer.getId(), giftCardBalance, "buono di prova", null);
        em.flush();
        // Fotografato **prima** del checkout: dopo il riscatto sarebbe il saldo
        // gia' scalato, e il confronto dopo il rimborso non proverebbe niente.
        BigDecimal balanceBefore = card == null ? null : giftCardBalanceOf(card.getId());

        var request = new CheckoutService.Request(address.getId(),
                java.util.List.of(new CheckoutService.Line(variant.getId(), quantity)),
                "standard", null, card == null ? null : card.getCode(), null, null);
        var result = checkout.placeOrder(buyer.getId(), request);
        em.flush();

        var orderId = (UUID) result.get("orderId");
        var intentId = payments.findByOrderId(orderId).orElseThrow().getProviderTxId();
        return new PendingCheckout(orderId, buyer.getId(), variant.getId(), quantity, intentId,
                card == null ? null : card.getId(), balanceBefore);
    }

    /** Un checkout gia' confermato dal fornitore: ordine `paid`, punti accreditati. */
    public PendingCheckout aPaidCheckout() {
        var draft = aPendingCheckout();
        confirmPaid(draft.orderId());
        return draft;
    }

    /**
     * Sposta indietro la data di creazione di un ordine.
     *
     * `created_at` e' scritta dal database e mappata {@code insertable=false,
     * updatable=false}: da JPA non si tocca, e aspettare mezz'ora per provare il
     * raccoglitore non e' un test.
     */
    public void backdateOrder(UUID orderId, LocalDateTime when) {
        em.createNativeQuery("update orders set created_at = :when where id = :id")
                .setParameter("when", when)
                .setParameter("id", orderId)
                .executeUpdate();
        em.flush();
    }

    /**
     * Un evento nel formato del {@link SimulatedPaymentGateway}, che e' il
     * fornitore attivo quando non ci sono chiavi. Il formato vero di Stripe e'
     * annidato e firmato: qui non serve, perche' cio' che si vuole provare e'
     * cosa fa il negozio **dopo** aver riconosciuto l'evento.
     */
    public String succeededEvent(String intentId) {
        return "{\"type\":\"payment_intent.succeeded\",\"intent\":\"" + intentId + "\"}";
    }

    public String failedEvent(String intentId) {
        return "{\"type\":\"payment_intent.payment_failed\",\"intent\":\"" + intentId + "\"}";
    }

    public Cart cartOf(UUID userId) {
        return carts.findByUserId(userId).orElseThrow();
    }

    /**
     * Giacenza e saldo letti con query scalari: si muovono con UPDATE atomici,
     * che **non** aggiornano le entita' gia' in sessione. Letti da `findById`
     * darebbero il valore di prima, preso dalla cache.
     */
    public int stockOf(UUID variantId) {
        return em.createQuery("select v.stockQty from ProductVariant v where v.id = :id", Integer.class)
                .setParameter("id", variantId).getSingleResult();
    }

    public BigDecimal giftCardBalanceOf(UUID giftCardId) {
        return em.createQuery("select g.currentBalance from GiftCard g where g.id = :id", BigDecimal.class)
                .setParameter("id", giftCardId).getSingleResult();
    }

    public record PendingCheckout(UUID orderId, UUID userId, UUID variantId, int quantity,
                                  String intentId, UUID giftCardId, BigDecimal giftCardBalanceBefore) {}

    /**
     * Porta a `paid` un ordine appena prenotato, come fara' il webhook del
     * fornitore quando conferma l'incasso.
     *
     * Serve perche' dalla fase A in poi {@link CheckoutService#placeOrder} lascia
     * l'ordine `pending`: i test che verificano cose che accadono **dopo**
     * l'incasso (punti accreditati, annullamento di un ordine pagato) hanno
     * bisogno di quel passaggio, che prima avveniva da solo perche' il checkout
     * si dichiarava pagato senza che nessuno avesse pagato.
     */
    public void confirmPaid(UUID orderId) {
        // Passa dal webhook vero, non da una scorciatoia: cosi' i test che
        // guardano un ordine pagato provano anche la strada per cui ci e'
        // arrivato, invece di una copia che puo' divergere.
        var intentId = payments.findByOrderId(orderId).orElseThrow().getProviderTxId();
        webhook.handle(succeededEvent(intentId), null);
        em.flush();
    }

    public User aUser() {
        var user = new User();
        user.setEmail("prova." + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("non-usato-in-questo-test");
        user.setFullName("Compratore Prova");
        user.setEmailVerifiedAt(LocalDateTime.now());
        return users.save(user);
    }

    public UserAddress anAddressFor(User user) {
        var address = new UserAddress();
        address.setUserId(user.getId());
        address.setFullName(user.getFullName());
        address.setStreet("Via Roma 1");
        address.setCity("Trento");
        address.setPostalCode("38100");
        return addresses.save(address);
    }

    public ProductVariant aVariantWithStock(int stock) {
        var category = new Category();
        category.setName("Categoria Prova");
        category.setSlug("categoria-prova-" + UUID.randomUUID());
        em.persist(category);

        var product = new Product();
        product.setCategory(category);
        product.setName("Prodotto Prova");
        product.setSlug("prodotto-prova-" + UUID.randomUUID());
        product.setBasePrice(new BigDecimal("50.00"));
        em.persist(product);

        var variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSku("SKU-" + UUID.randomUUID());
        variant.setStockQty(stock);
        em.persist(variant);
        em.flush();
        return variant;
    }

    /** Un ordine appena nato, senza righe: basta a chi deve solo appenderci un pagamento. */
    public Order anOrderPending() {
        var user = aUser();
        var order = new Order();
        order.setUserId(user.getId());
        order.setAddressId(anAddressFor(user).getId());
        order.setStatus(OrderStatus.pending);
        order.setSubtotal(new BigDecimal("50.00"));
        order.setDiscountTotal(BigDecimal.ZERO);
        order.setShippingCost(new BigDecimal("4.90"));
        order.setTotal(new BigDecimal("54.90"));
        return orders.save(order);
    }

    public Payment aPayment(Order order, String providerTxId) {
        var payment = new Payment();
        payment.setOrderId(order.getId());
        payment.setUserId(order.getUserId());
        payment.setStatus(Payment.PaymentStatus.pending);
        payment.setMethod(Payment.PaymentMethod.credit_card);
        payment.setAmount(order.getTotal());
        payment.setProvider("stripe");
        payment.setProviderTxId(providerTxId);
        return payment;
    }

    /** Un buono con un saldo noto, emesso da un amministratore di comodo. */
    public GiftCard aGiftCardWithBalance(BigDecimal balance) {
        return giftCards.issue(aUser().getId(), balance, "buono di prova", null);
    }

    /** Punti gia' a saldo: sotto i 500 il riscatto al checkout non e' ammesso. */
    public void grantPoints(UUID userId, int points) {
        var entry = new LoyaltyEntry();
        entry.setUserId(userId);
        entry.setPoints(points);
        entry.setReason("seed-di-prova");
        loyaltyEntries.save(entry);
        em.flush();
    }

    /**
     * Un ordine vero, passato dal checkout reale con buono e punti: il percorso
     * che la compensazione deve saper disfare. Costruirlo a mano rischierebbe di
     * provare l'inversione di qualcosa che il checkout non fa davvero.
     */
    public CheckedOut aCheckoutWithGiftCardAndPoints(int quantity, BigDecimal giftCardBalance, int points) {
        var buyer = aUser();
        var address = anAddressFor(buyer);
        var variant = aVariantWithStock(10);
        var card = giftCards.issue(buyer.getId(), giftCardBalance, "buono di prova", null);
        if (points > 0) {
            grantPoints(buyer.getId(), points);
        }

        var request = new CheckoutService.Request(address.getId(),
                java.util.List.of(new CheckoutService.Line(variant.getId(), quantity)),
                "standard", null, card.getCode(), points > 0 ? points : null, null);
        var result = checkout.placeOrder(buyer.getId(), request);
        em.flush();
        em.clear();

        var order = orders.findById((UUID) result.get("orderId")).orElseThrow();
        return new CheckedOut(order, buyer.getId(), variant.getId(), quantity, card.getId());
    }

    public record CheckedOut(Order order, UUID userId, UUID variantId, int quantity, UUID giftCardId) {
        public UUID orderId() {
            return order.getId();
        }
    }
}

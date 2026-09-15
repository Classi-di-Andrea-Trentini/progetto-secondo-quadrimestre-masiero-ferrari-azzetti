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

    @PersistenceContext
    private EntityManager em;

    public TestFixtures(UserRepository users, UserAddressRepository addresses, OrderRepository orders,
                        GiftCardService giftCards, LoyaltyEntryRepository loyaltyEntries,
                        CheckoutService checkout) {
        this.users = users;
        this.addresses = addresses;
        this.orders = orders;
        this.giftCards = giftCards;
        this.loyaltyEntries = loyaltyEntries;
        this.checkout = checkout;
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

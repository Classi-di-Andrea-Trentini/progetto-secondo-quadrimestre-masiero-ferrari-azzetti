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

    @PersistenceContext
    private EntityManager em;

    public TestFixtures(UserRepository users, UserAddressRepository addresses, OrderRepository orders) {
        this.users = users;
        this.addresses = addresses;
        this.orders = orders;
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
}

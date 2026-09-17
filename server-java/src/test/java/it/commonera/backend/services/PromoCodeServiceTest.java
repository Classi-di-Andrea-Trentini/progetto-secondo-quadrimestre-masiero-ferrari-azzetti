package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.Category;
import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.PromoCode;
import it.commonera.backend.entities.Product;
import it.commonera.backend.entities.ProductVariant;
import it.commonera.backend.entities.User;
import it.commonera.backend.entities.UserAddress;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.PromoCodeRepository;
import it.commonera.backend.repositories.PromoCodeUseRepository;
import it.commonera.backend.repositories.UserAddressRepository;
import it.commonera.backend.repositories.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Il checkout accettava gia' `promoCode` nel corpo della richiesta ma lo
 * ignorava del tutto in silenzio — il codice veniva letto e mai usato. Qui si
 * verifica sia la logica di validazione da sola ({@link PromoCodeService#validate})
 * sia che {@link CheckoutService#placeOrder} la applichi davvero al totale.
 */
class PromoCodeServiceTest extends AbstractIntegrationTest {

    @Autowired
    private TestFixtures fixtures;

    @Autowired
    private UserRepository users;
    @Autowired
    private UserAddressRepository addresses;
    @Autowired
    private PromoCodeRepository promoCodes;
    @Autowired
    private PromoCodeUseRepository promoCodeUses;
    @Autowired
    private it.commonera.backend.repositories.LoyaltyEntryRepository loyaltyEntries;
    @Autowired
    private PromoCodeService promoCodeService;
    @Autowired
    private CheckoutService checkout;
    @PersistenceContext
    private EntityManager em;

    private User buyer;
    private UserAddress address;
    private ProductVariant variant;

    @BeforeEach
    void setUp() {
        buyer = new User();
        buyer.setEmail("buyer." + UUID.randomUUID() + "@example.com");
        buyer.setPasswordHash("unused-in-this-test");
        buyer.setFullName("Compratore Prova");
        buyer.setEmailVerifiedAt(LocalDateTime.now());
        buyer = users.save(buyer);

        address = new UserAddress();
        address.setUserId(buyer.getId());
        address.setFullName("Compratore Prova");
        address.setStreet("Via Roma 1");
        address.setCity("Trento");
        address.setPostalCode("38100");
        address = addresses.save(address);

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

        variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSku("SKU-" + UUID.randomUUID());
        variant.setStockQty(10);
        em.persist(variant);

        em.flush();
    }

    private PromoCode promo(String code, PromoCode.DiscountType type, String value) {
        var promo = new PromoCode();
        promo.setCode(code);
        promo.setType(type);
        promo.setValue(new BigDecimal(value));
        return promo;
    }

    @Test
    void percentageDiscountIsComputedOnOrderAmountAndCappedByMaxDiscount() {
        var promo = promo("SAVE20", PromoCode.DiscountType.percentage, "20");
        promo.setMaxDiscountCap(new BigDecimal("15.00"));
        promoCodes.save(promo);

        // 20% di 100.00 sarebbe 20.00, ma il tetto lo porta a 15.00.
        var result = promoCodeService.validate("SAVE20", new BigDecimal("100.00"), buyer.getId());
        assertThat(result.discountValue()).isEqualByComparingTo("15.00");
    }

    @Test
    void fixedAmountDiscountNeverExceedsTheOrderTotal() {
        var promo = promo("FLAT50", PromoCode.DiscountType.fixed_amount, "50.00");
        promoCodes.save(promo);

        // Uno sconto fisso maggiore del totale non deve produrre uno sconto negativo.
        var result = promoCodeService.validate("FLAT50", new BigDecimal("30.00"), buyer.getId());
        assertThat(result.discountValue()).isEqualByComparingTo("30.00");
    }

    @Test
    void codeIsCaseInsensitiveAndTrimmed() {
        promoCodes.save(promo("WELCOME10", PromoCode.DiscountType.percentage, "10"));

        var result = promoCodeService.validate(" welcome10 ", new BigDecimal("100.00"), buyer.getId());
        assertThat(result.code()).isEqualTo("WELCOME10");
        assertThat(result.discountValue()).isEqualByComparingTo("10.00");
    }

    @Test
    void expiredCodeIsRejected() {
        var promo = promo("OLD10", PromoCode.DiscountType.percentage, "10");
        promo.setExpiresAt(LocalDateTime.now().minusDays(1));
        promoCodes.save(promo);

        assertThatThrownBy(() -> promoCodeService.validate("OLD10", new BigDecimal("100.00"), buyer.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void inactiveCodeIsRejected() {
        var promo = promo("OFF10", PromoCode.DiscountType.percentage, "10");
        promo.setIsActive(false);
        promoCodes.save(promo);

        assertThatThrownBy(() -> promoCodeService.validate("OFF10", new BigDecimal("100.00"), buyer.getId()))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void belowMinimumOrderAmountIsRejected() {
        var promo = promo("BIG10", PromoCode.DiscountType.percentage, "10");
        promo.setMinOrderAmount(new BigDecimal("200.00"));
        promoCodes.save(promo);

        assertThatThrownBy(() -> promoCodeService.validate("BIG10", new BigDecimal("100.00"), buyer.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Minimum order amount");
    }

    @Test
    void usageLimitReachedIsRejected() {
        var promo = promo("LIMITED", PromoCode.DiscountType.percentage, "10");
        promo.setMaxUses(1);
        promo.setCurrentUses(1);
        promoCodes.save(promo);

        assertThatThrownBy(() -> promoCodeService.validate("LIMITED", new BigDecimal("100.00"), buyer.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("usage limit");
    }

    @Test
    void perUserUsageLimitIsRejectedAfterAlreadyUsedOnce() {
        var promo = promo("ONEEACH", PromoCode.DiscountType.percentage, "10");
        promo.setMaxUsesPerUser(1);
        promo = promoCodes.save(promo);

        // `promo_code_uses.order_id` ha un vincolo di integrita' verso `orders`:
        // serve un ordine vero, non un UUID a caso, o l'insert fallisce prima
        // ancora di arrivare al controllo che questo test vuole esercitare.
        var pastOrder = new Order();
        pastOrder.setUserId(buyer.getId());
        pastOrder.setAddressId(address.getId());
        pastOrder.setStatus(OrderStatus.paid);
        pastOrder.setSubtotal(new BigDecimal("50.00"));
        pastOrder.setTotal(new BigDecimal("50.00"));
        em.persist(pastOrder);
        em.flush();

        promoCodeService.recordUse(promo.getId(), buyer.getId(), pastOrder.getId(), new BigDecimal("5.00"));
        em.flush();
        em.clear();

        assertThatThrownBy(() -> promoCodeService.validate("ONEEACH", new BigDecimal("100.00"), buyer.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already used");
    }

    @Test
    void unknownCodeIsRejected() {
        assertThatThrownBy(() -> promoCodeService.validate("DOES-NOT-EXIST", new BigDecimal("100.00"), buyer.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid or expired");
    }

    @Test
    void checkoutAppliesThePromoDiscountToTheOrderTotalAndRecordsTheUse() {
        var promo = promo("CHECKOUT10", PromoCode.DiscountType.fixed_amount, "10.00");
        promoCodes.save(promo);
        em.flush();
        em.clear();

        // 2 x 50.00 = 100.00 di subtotale, spedizione gratuita sopra i 100 (anche
        // dopo lo sconto: 90.00 e' comunque sotto soglia, quindi torna la spedizione
        // standard a 4.90 — e' proprio il caso che verifica che lo sconto sia
        // applicato PRIMA del calcolo della spedizione, non dopo).
        var request = new CheckoutService.Request(
                address.getId(),
                List.of(new CheckoutService.Line(variant.getId(), 2)),
                "standard",
                "checkout10",
                null,
                null,
                null);

        var result = checkout.placeOrder(buyer.getId(), request);
        em.flush();
        em.clear();

        // 100.00 - 10.00 di sconto = 90.00, sotto la soglia dei 100 di spedizione
        // gratuita: + 4.90 di spedizione standard = 94.90.
        assertThat(result.get("total")).isEqualTo(new BigDecimal("94.90"));

        var updated = promoCodes.findById(promo.getId()).orElseThrow();
        assertThat(updated.getCurrentUses()).isEqualTo(1);
        assertThat(promoCodeUses.countByPromoCodeId(promo.getId())).isEqualTo(1);
    }

    @Test
    void loyaltyPointsAreAwardedOnTheSubtotalNetOfThePromoDiscount() {
        var promo = promo("POINTS10", PromoCode.DiscountType.fixed_amount, "10.00");
        promoCodes.save(promo);
        em.flush();
        em.clear();

        // 2 x 50.00 = 100.00 di subtotale, 10.00 di sconto promo.
        var request = new CheckoutService.Request(
                address.getId(),
                List.of(new CheckoutService.Line(variant.getId(), 2)),
                "standard",
                "points10",
                null,
                null,
                null);

        var result = checkout.placeOrder(buyer.getId(), request);
        em.flush();
        em.clear();

        // L'ordine nasce `pending`: i punti arrivano con la conferma del
        // fornitore, non con la prenotazione.
        fixtures.confirmPaid((java.util.UUID) result.get("orderId"));
        em.flush();
        em.clear();

        // I punti maturano su 90.00, non su 100.00: sottraendo solo lo sconto dei
        // punti e non quello del promo, il cliente incassava credito su 10 euro
        // che non ha mai pagato.
        assertThat(loyaltyEntries.balanceOf(buyer.getId())).isEqualTo(90);
    }

    @Test
    void checkoutRejectsAnInvalidPromoCodeWithoutCreatingAnyOrder() {
        var request = new CheckoutService.Request(
                address.getId(),
                List.of(new CheckoutService.Line(variant.getId(), 1)),
                "standard",
                "NOPE",
                null,
                null,
                null);

        assertThatThrownBy(() -> checkout.placeOrder(buyer.getId(), request))
                .isInstanceOf(ApiException.class);
    }
}

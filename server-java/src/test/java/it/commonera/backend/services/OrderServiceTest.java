package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.Category;
import it.commonera.backend.entities.Product;
import it.commonera.backend.entities.ProductVariant;
import it.commonera.backend.entities.User;
import it.commonera.backend.entities.UserAddress;
import it.commonera.backend.repositories.GiftCardRepository;
import it.commonera.backend.repositories.LoyaltyEntryRepository;
import it.commonera.backend.repositories.ProductVariantRepository;
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

/**
 * Fix 2: annullare un ordine ripristinava la giacenza ma non toccava buono
 * regalo ne' punti fedelta' spesi/guadagnati al checkout — perdita finanziaria
 * ripetibile ogni volta che un cliente pagava (in parte) con un buono e poi
 * annullava.
 *
 * Cosa scala il checkout ({@link CheckoutService#placeOrder}) su un ordine con
 * buono e punti, nell'ordine in cui succede:
 * <ol>
 *   <li>{@link LoyaltyService#redeem} scala i punti spesi e registra uno sconto;</li>
 *   <li>{@link GiftCardService#redeem} scala il buono su quello che resta da pagare,
 *       e l'ordine si porta dietro {@code giftCardId}/{@code giftCardAmount};</li>
 *   <li>{@link LoyaltyService#award} accredita punti sull'imponibile scontato.</li>
 * </ol>
 * {@link OrderService#cancel} deve invertire esattamente questo: rimborsare
 * {@code order.getGiftCardAmount()} sul buono, e scrivere un movimento punti
 * netto che azzeri quanto scritto per quell'ordine (spesa e accredito insieme).
 */
class OrderServiceTest extends AbstractIntegrationTest {

    @Autowired
    private UserRepository users;
    @Autowired
    private UserAddressRepository addresses;
    @Autowired
    private ProductVariantRepository variants;
    @Autowired
    private GiftCardRepository giftCardRepo;
    @Autowired
    private GiftCardService giftCardService;
    @Autowired
    private LoyaltyService loyaltyService;
    @Autowired
    private LoyaltyEntryRepository loyaltyEntries;
    @Autowired
    private CheckoutService checkout;
    @Autowired
    private OrderService orderService;
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

    @Test
    void cancellingOrderRefundsGiftCardAndReversesLoyaltyPointsAndRestocksVariant() {
        // Punti preesistenti, non legati a questo ordine: servono per poterne
        // spendere una parte al checkout (serve un saldo di almeno 500 per redimere).
        // flush() prima di clear() sempre: clear() da solo scarterebbe silenziosamente
        // le insert non ancora inviate al database invece di limitarsi a
        // scollegare le entita' gia' scritte.
        loyaltyService.award(buyer.getId(), null, new BigDecimal("1000"));
        em.flush();
        em.clear();
        assertThat(loyaltyEntries.balanceOf(buyer.getId())).isEqualTo(1000);

        var card = giftCardService.issue(null, new BigDecimal("30.00"), "Test", null);
        em.flush();
        em.clear();

        // 2 x 50.00 = 100.00 di subtotale, spedizione gratuita sopra i 100.
        var request = new CheckoutService.Request(
                address.getId(),
                List.of(new CheckoutService.Line(variant.getId(), 2)),
                "standard",
                null,
                card.getCode(),
                500,
                null);

        var result = checkout.placeOrder(buyer.getId(), request);
        UUID orderId = (UUID) result.get("orderId");
        em.flush();
        em.clear();

        // Dopo il checkout: 500 punti spesi (-5.00 di sconto) portano il totale a
        // 95.00; il buono da 30.00 copre 30.00 di quei 95.00 e si svuota; 95 punti
        // vengono accreditati sull'imponibile scontato (100 - 5 = 95 euro, 1 punto/euro).
        assertThat(variants.findById(variant.getId()).orElseThrow().getStockQty()).isEqualTo(8);
        assertThat(giftCardRepo.findById(card.getId()).orElseThrow().getCurrentBalance())
                .isEqualByComparingTo("0.00");
        assertThat(loyaltyEntries.balanceOf(buyer.getId())).isEqualTo(1000 - 500 + 95);

        orderService.cancel(buyer.getId(), orderId);
        em.flush();
        em.clear();

        // Dopo l'annullamento: tutto torna esattamente come prima del checkout.
        assertThat(variants.findById(variant.getId()).orElseThrow().getStockQty()).isEqualTo(10);
        assertThat(giftCardRepo.findById(card.getId()).orElseThrow().getCurrentBalance())
                .isEqualByComparingTo("30.00");
        assertThat(loyaltyEntries.balanceOf(buyer.getId())).isEqualTo(1000);
    }

    @Test
    void cancellingOrderWithoutGiftCardOrLoyaltyOnlyRestoresStock() {
        var request = new CheckoutService.Request(
                address.getId(),
                List.of(new CheckoutService.Line(variant.getId(), 3)),
                "standard",
                null,
                null,
                null,
                null);

        var result = checkout.placeOrder(buyer.getId(), request);
        UUID orderId = (UUID) result.get("orderId");
        em.flush();
        em.clear();

        assertThat(variants.findById(variant.getId()).orElseThrow().getStockQty()).isEqualTo(7);

        orderService.cancel(buyer.getId(), orderId);
        em.flush();
        em.clear();

        assertThat(variants.findById(variant.getId()).orElseThrow().getStockQty()).isEqualTo(10);
        // Nessun buono/punti coinvolti in questo ordine: nessun movimento da annullare.
        assertThat(loyaltyEntries.balanceOf(buyer.getId())).isZero();
    }
}

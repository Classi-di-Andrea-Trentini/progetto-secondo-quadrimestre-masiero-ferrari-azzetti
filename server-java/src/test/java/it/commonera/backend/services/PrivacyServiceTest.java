package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.Category;
import it.commonera.backend.entities.LoyaltyEntry;
import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.OrderItem;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.Product;
import it.commonera.backend.entities.ProductVariant;
import it.commonera.backend.entities.Review;
import it.commonera.backend.entities.Session;
import it.commonera.backend.entities.User;
import it.commonera.backend.entities.UserAddress;
import it.commonera.backend.entities.Wishlist;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.LoyaltyEntryRepository;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.ReviewRepository;
import it.commonera.backend.repositories.SessionRepository;
import it.commonera.backend.repositories.UserAddressRepository;
import it.commonera.backend.repositories.UserRepository;
import it.commonera.backend.repositories.WishlistRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * I due diritti che il GDPR rende esigibili con un click: portabilita' (art. 20) e
 * cancellazione (art. 17).
 *
 * Il punto delicato non e' cancellare, e' cancellare **senza** portarsi via i
 * documenti fiscali. {@code orders.user_id} e' {@code ON DELETE RESTRICT} apposta: una
 * fattura emessa non si puo' far sparire perche' il cliente chiude l'account, va
 * conservata per dieci anni (art. 2220 c.c.). Quindi la riga utente resta, ma svuotata
 * di tutto cio' che identifica una persona.
 *
 * Il rovescio della medaglia e' che "anonimizzato" dev'essere vero: se dopo la
 * cancellazione l'email o il nome originali sono ancora leggibili da qualche parte,
 * l'operazione ha solo *sembrato* funzionare. Ogni test qui sotto guarda proprio
 * quello: cosa resta scritto nel database.
 */
class PrivacyServiceTest extends AbstractIntegrationTest {

    @Autowired
    private PrivacyService privacy;
    @Autowired
    private UserRepository users;
    @Autowired
    private UserAddressRepository addresses;
    @Autowired
    private OrderRepository orders;
    @Autowired
    private ReviewRepository reviews;
    @Autowired
    private WishlistRepository wishlists;
    @Autowired
    private LoyaltyEntryRepository loyaltyEntries;
    @Autowired
    private SessionRepository sessions;
    @Autowired
    private PasswordEncoder encoder;
    @PersistenceContext
    private EntityManager em;

    private User user;
    private String email;
    private UUID productId;
    private UUID variantId;

    @BeforeEach
    void setUp() {
        email = "privacy." + UUID.randomUUID() + "@example.com";

        user = new User();
        user.setEmail(email);
        user.setPasswordHash(encoder.encode("Password123"));
        user.setFullName("Giulia Bianchi");
        user.setPhone("3331234567");
        user.setBirthDate(LocalDate.of(1998, 4, 12));
        user.setGender("donna");
        user.setNewsletterOptIn(true);
        user.setEmailVerifiedAt(LocalDateTime.now());
        user = users.save(user);

        var category = new Category();
        category.setName("Categoria Privacy");
        category.setSlug("categoria-privacy-" + UUID.randomUUID());
        em.persist(category);

        var product = new Product();
        product.setCategory(category);
        product.setName("Maglia di prova");
        product.setSlug("maglia-di-prova-" + UUID.randomUUID());
        product.setBasePrice(new BigDecimal("40.00"));
        em.persist(product);
        productId = product.getId();

        var variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSku("SKU-" + UUID.randomUUID());
        variant.setStockQty(5);
        em.persist(variant);
        variantId = variant.getId();

        em.flush();
    }

    // ─── Export ───────────────────────────────────────────────────────────────

    @Test
    void theExportCarriesEveryPieceOfPersonalDataTheShopHolds() {
        var address = address("Via Verdi 3", true);
        var order = order(address.getId(), new BigDecimal("40.00"));
        review(4, "Bella maglia");
        wishlistRow();
        loyaltyRow(120, "acquisto");
        em.flush();
        em.clear();

        var export = privacy.exportPersonalData(user.getId());

        // Portabilita' significa *tutto* quello che il negozio tiene su di me, non un
        // riassunto: se una sezione resta fuori, il diritto e' soddisfatto a meta'.
        assertThat(export.profile().email()).isEqualTo(email);
        assertThat(export.profile().fullName()).isEqualTo("Giulia Bianchi");
        assertThat(export.profile().phone()).isEqualTo("3331234567");
        assertThat(export.profile().birthDate()).isEqualTo(LocalDate.of(1998, 4, 12));

        assertThat(export.addresses()).singleElement()
                .satisfies(a -> assertThat(a.street()).isEqualTo("Via Verdi 3"));

        assertThat(export.orders()).singleElement().satisfies(o -> {
            assertThat(o.id()).isEqualTo(order.getId());
            assertThat(o.total()).isEqualByComparingTo("40.00");
            assertThat(o.items()).singleElement()
                    .satisfies(i -> assertThat(i.productName()).isEqualTo("Maglia di prova"));
        });

        assertThat(export.reviews()).singleElement()
                .satisfies(r -> assertThat(r.title()).isEqualTo("Bella maglia"));
        assertThat(export.wishlist()).singleElement()
                .satisfies(w -> assertThat(w.productId()).isEqualTo(productId));
        assertThat(export.loyalty().balance()).isEqualTo(120);
        assertThat(export.loyalty().entries()).singleElement()
                .satisfies(e -> assertThat(e.reason()).isEqualTo("acquisto"));
    }

    @Test
    void theExportNeverCarriesThePasswordHash() {
        em.flush();
        em.clear();

        // Il record non ha proprio il campo: la prova e' che il JSON prodotto non
        // contenga l'hash per nessuna strada, nemmeno dentro un altro valore.
        var json = privacy.exportPersonalData(user.getId()).toString();
        assertThat(json).doesNotContain("$2a$").doesNotContain("$2b$");
    }

    // ─── Cancellazione ────────────────────────────────────────────────────────

    @Test
    void erasingTheAccountEmptiesTheProfileButKeepsTheInvoice() {
        var address = address("Via Verdi 3", true);
        var order = order(address.getId(), new BigDecimal("40.00"));
        order.setInvoiceNumber("2026-9" + String.format("%03d", (int) (Math.random() * 1000)));
        orders.save(order);
        em.flush();
        em.clear();

        privacy.eraseAccount(user.getId(), "Password123");
        em.flush();
        em.clear();

        var erased = users.findById(user.getId()).orElseThrow();
        assertThat(erased.getDeletedAt()).isNotNull();
        assertThat(erased.getIsActive()).isFalse();
        // Nome, email, telefono e anagrafica non devono piu' esistere da nessuna parte.
        assertThat(erased.getEmail()).isNotEqualToIgnoringCase(email).endsWith("@anonimo.invalid");
        assertThat(erased.getFullName()).doesNotContain("Giulia").doesNotContain("Bianchi");
        assertThat(erased.getPhone()).isNull();
        assertThat(erased.getBirthDate()).isNull();
        assertThat(erased.getGender()).isNull();
        assertThat(erased.getNewsletterOptIn()).isFalse();
        // La vecchia password non deve piu' aprire niente.
        assertThat(encoder.matches("Password123", erased.getPasswordHash())).isFalse();

        // L'ordine e la sua fattura restano: e' un documento fiscale, la legge impone
        // di conservarlo, e `orders.user_id` e' ON DELETE RESTRICT proprio per questo.
        var keptOrder = orders.findById(order.getId()).orElseThrow();
        assertThat(keptOrder.getTotal()).isEqualByComparingTo("40.00");
        assertThat(keptOrder.getInvoiceNumber()).isNotNull();
        assertThat(keptOrder.getUserId()).isEqualTo(user.getId());
    }

    @Test
    void erasingTheAccountWipesWishlistReviewsAndPoints() {
        review(4, "Bella maglia");
        wishlistRow();
        loyaltyRow(120, "acquisto");
        em.flush();
        em.clear();

        privacy.eraseAccount(user.getId(), "Password123");
        em.flush();
        em.clear();

        // Nessuna legge impone di conservare i gusti di qualcuno che se n'e' andato.
        assertThat(wishlists.findByUserId(user.getId())).isEmpty();
        assertThat(reviews.findByUserIdAndProductId(user.getId(), productId)).isEmpty();
        assertThat(loyaltyEntries.balanceOf(user.getId())).isZero();
    }

    @Test
    void anAddressPrintedOnAnInvoiceIsBlankedNotDeleted() {
        var used = address("Via Verdi 3", true);
        var unused = address("Via Dante 9", false);
        var order = order(used.getId(), new BigDecimal("40.00"));
        em.flush();
        em.clear();

        privacy.eraseAccount(user.getId(), "Password123");
        em.flush();
        em.clear();

        // Cancellare la riga metterebbe a NULL `orders.address_id` (ON DELETE SET NULL)
        // e la fattura gia' emessa perderebbe il blocco destinatario: la riga resta,
        // svuotata.
        var keptOrder = orders.findById(order.getId()).orElseThrow();
        assertThat(keptOrder.getAddressId()).isEqualTo(used.getId());

        var blanked = addresses.findById(used.getId()).orElseThrow();
        assertThat(blanked.getStreet()).doesNotContain("Verdi");
        assertThat(blanked.getFullName()).doesNotContain("Giulia");
        assertThat(blanked.getPhone()).isNull();

        // Quello che nessun ordine ha mai usato non ha ragione di sopravvivere.
        assertThat(addresses.findById(unused.getId())).isEmpty();
    }

    @Test
    void erasingTheAccountTakesEverySessionDown() {
        var phone = session();
        var laptop = session();
        em.flush();
        em.clear();

        privacy.eraseAccount(user.getId(), "Password123");
        em.flush();
        em.clear();

        // Un cookie ancora valido dopo la cancellazione e' un account cancellato solo
        // sulla carta.
        assertThat(sessions.findById(phone.getId())).isEmpty();
        assertThat(sessions.findById(laptop.getId())).isEmpty();
    }

    @Test
    void erasingTheAccountNeedsTheRightPassword() {
        em.flush();
        em.clear();

        assertThatThrownBy(() -> privacy.eraseAccount(user.getId(), "Sbagliata1"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Password");

        // E soprattutto: non deve aver cancellato niente per strada.
        assertThat(users.findById(user.getId()).orElseThrow().getDeletedAt()).isNull();
    }

    @Test
    void anAccountAlreadyErasedCannotBeErasedOrExportedAgain() {
        em.flush();
        em.clear();

        privacy.eraseAccount(user.getId(), "Password123");
        em.flush();
        em.clear();

        assertThatThrownBy(() -> privacy.exportPersonalData(user.getId()))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> privacy.eraseAccount(user.getId(), "Password123"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void theLastAdministratorCannotEraseTheirOwnAccount() {
        // Gli admin del seed non sono sotto controllo di questo test: si azzerano
        // quelli attivi e si lascia solo questo, cosi' la condizione "e' l'ultimo" e'
        // vera davvero.
        users.findAll().stream()
                .filter(u -> u.getRole() == User.Role.admin && !u.getId().equals(user.getId()))
                .forEach(other -> {
                    other.setIsActive(false);
                    users.save(other);
                });
        user.setRole(User.Role.admin);
        users.save(user);
        em.flush();
        em.clear();

        // Un negozio senza nessuno che possa entrare nell'area amministrativa e'
        // irrecuperabile dal browser: si rifiuta, e si chiede di nominare un altro
        // amministratore prima.
        assertThatThrownBy(() -> privacy.eraseAccount(user.getId(), "Password123"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("amministratore");

        assertThat(users.findById(user.getId()).orElseThrow().getDeletedAt()).isNull();
    }

    // ─── Materiale di scena ───────────────────────────────────────────────────

    private UserAddress address(String street, boolean isDefault) {
        var address = new UserAddress();
        address.setUserId(user.getId());
        address.setFullName("Giulia Bianchi");
        address.setPhone("3331234567");
        address.setStreet(street);
        address.setCity("Trento");
        address.setProvince("TN");
        address.setPostalCode("38122");
        address.setIsDefault(isDefault);
        return addresses.save(address);
    }

    private Order order(UUID addressId, BigDecimal total) {
        var order = new Order();
        order.setUserId(user.getId());
        order.setAddressId(addressId);
        order.setStatus(OrderStatus.paid);
        order.setSubtotal(total);
        order.setTotal(total);

        var item = new OrderItem();
        item.setOrder(order);
        item.setVariantId(variantId);
        item.setProductName("Maglia di prova");
        item.setVariantLabel("M");
        item.setUnitPrice(total);
        item.setQuantity(1);
        item.setLineTotal(total);
        order.getItems().add(item);

        return orders.save(order);
    }

    private Review review(int rating, String title) {
        var review = new Review();
        review.setUserId(user.getId());
        review.setProductId(productId);
        review.setRating((short) rating);
        review.setTitle(title);
        review.setBody("Vestibilita' ottima, tessuto robusto.");
        review.setStatus(Review.ReviewStatus.approved);
        return reviews.save(review);
    }

    private Wishlist wishlistRow() {
        var row = new Wishlist();
        row.setUserId(user.getId());
        row.setProductId(productId);
        row.setVariantId(variantId);
        return wishlists.save(row);
    }

    private LoyaltyEntry loyaltyRow(int points, String reason) {
        var entry = new LoyaltyEntry();
        entry.setUserId(user.getId());
        entry.setPoints(points);
        entry.setReason(reason);
        return loyaltyEntries.save(entry);
    }

    private Session session() {
        var session = new Session();
        session.setUserId(user.getId());
        session.setTokenHash("hash-" + UUID.randomUUID());
        session.setExpiresAt(LocalDateTime.now().plusDays(7));
        return sessions.save(session);
    }
}

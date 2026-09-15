package it.commonera.backend.services;

import it.commonera.backend.dtos.PrivacyDtos;
import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.User;
import it.commonera.backend.entities.UserAddress;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.CartRepository;
import it.commonera.backend.repositories.EmailVerificationRepository;
import it.commonera.backend.repositories.LoyaltyEntryRepository;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.PasswordResetRepository;
import it.commonera.backend.repositories.ReviewRepository;
import it.commonera.backend.repositories.SessionRepository;
import it.commonera.backend.repositories.StockAlertRepository;
import it.commonera.backend.repositories.UserAddressRepository;
import it.commonera.backend.repositories.UserRepository;
import it.commonera.backend.repositories.WishlistRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * I due diritti che il GDPR rende esigibili da dentro l'area personale:
 * portabilita' (art. 20) e cancellazione (art. 17).
 *
 * <h2>Perche' la cancellazione e' logica</h2>
 *
 * {@code orders.user_id} e' {@code ON DELETE RESTRICT}: il database rifiuta di
 * cancellare un utente che ha ordinato, e fa bene. Una fattura emessa va conservata
 * dieci anni (art. 2220 c.c.) e l'art. 17 § 3 lett. b GDPR tiene fuori dal diritto
 * all'oblio proprio i dati che un obbligo di legge impone di tenere.
 *
 * Quindi la riga utente resta — e' il perno a cui gli ordini sono appesi — ma viene
 * svuotata di tutto cio' che identifica una persona. Quello che sopravvive e' un
 * numero d'ordine con degli importi, non piu' un nome.
 *
 * <h2>Cosa resta e cosa sparisce</h2>
 *
 * <table>
 *   <tr><th>Dato</th><th>Sorte</th><th>Perche'</th></tr>
 *   <tr><td>profilo (nome, email, telefono, anagrafica)</td><td>sovrascritto</td><td>identifica</td></tr>
 *   <tr><td>indirizzi mai usati in un ordine</td><td>cancellati</td><td>nessuna ragione di tenerli</td></tr>
 *   <tr><td>indirizzi stampati su una fattura</td><td>svuotati sul posto</td><td>cancellarli metterebbe a NULL {@code orders.address_id}</td></tr>
 *   <tr><td>ordini, righe, pagamenti, fatture</td><td>conservati</td><td>documenti fiscali</td></tr>
 *   <tr><td>recensioni, voti "utile", wishlist, carrello, avvisi, punti</td><td>cancellati</td><td>nessun obbligo di conservazione</td></tr>
 *   <tr><td>sessioni, token di verifica e di reimpostazione</td><td>cancellati</td><td>un cookie ancora valido renderebbe la cancellazione finta</td></tr>
 * </table>
 */
@Service
public class PrivacyService {

    /**
     * {@code .invalid} e' riservato dalla RFC 2606 e non si risolve: l'indirizzo
     * segnaposto non puo' finire per sbaglio nella casella di qualcuno.
     */
    private static final String ANONYMOUS_EMAIL_DOMAIN = "@anonimo.invalid";
    private static final String ANONYMOUS_NAME = "Utente cancellato";
    private static final String BLANKED = "—";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final UserAddressRepository addresses;
    private final OrderRepository orders;
    private final ReviewRepository reviews;
    private final WishlistRepository wishlists;
    private final LoyaltyEntryRepository loyaltyEntries;
    private final StockAlertRepository stockAlerts;
    private final CartRepository carts;
    private final SessionRepository sessions;
    private final EmailVerificationRepository verifications;
    private final PasswordResetRepository resets;
    private final PasswordEncoder encoder;

    public PrivacyService(UserRepository users, UserAddressRepository addresses, OrderRepository orders,
                          ReviewRepository reviews, WishlistRepository wishlists,
                          LoyaltyEntryRepository loyaltyEntries, StockAlertRepository stockAlerts,
                          CartRepository carts, SessionRepository sessions,
                          EmailVerificationRepository verifications, PasswordResetRepository resets,
                          PasswordEncoder encoder) {
        this.users = users;
        this.addresses = addresses;
        this.orders = orders;
        this.reviews = reviews;
        this.wishlists = wishlists;
        this.loyaltyEntries = loyaltyEntries;
        this.stockAlerts = stockAlerts;
        this.carts = carts;
        this.sessions = sessions;
        this.verifications = verifications;
        this.resets = resets;
        this.encoder = encoder;
    }

    // ─── Art. 20: portabilita' ────────────────────────────────────────────────

    /**
     * Tutto quello che il negozio tiene su una persona, in un colpo solo.
     *
     * Transazionale e non solo "di lettura a caso": le righe d'ordine sono lazy e
     * fuori dalla transazione esploderebbero con una {@code LazyInitializationException},
     * dato che qui {@code open-in-view} e' spento.
     */
    @Transactional(readOnly = true)
    public PrivacyDtos.DataExport exportPersonalData(UUID userId) {
        var user = require(userId);

        var addressRecords = addresses.findByUserIdOrderByIsDefaultDescCreatedAtAsc(userId).stream()
                .map(a -> new PrivacyDtos.Address(a.getId(), a.getLabel(), a.getFullName(), a.getPhone(),
                        a.getStreet(), a.getStreet2(), a.getCity(), a.getProvince(), a.getPostalCode(),
                        a.getCountry(), a.getIsDefault(), a.getCreatedAt()))
                .toList();

        var orderRecords = orders.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(o -> new PrivacyDtos.OrderRecord(o.getId(), o.getStatus().name(), o.getSubtotal(),
                        o.getDiscountTotal(), o.getShippingCost(), o.getTaxAmount(), o.getTotal(),
                        o.getGiftCardAmount(), o.getShippingMethod(), o.getTrackingNumber(),
                        o.getInvoiceNumber(), o.getCreatedAt(),
                        o.getItems().stream()
                                .map(i -> new PrivacyDtos.OrderItemRecord(i.getProductName(), i.getVariantLabel(),
                                        i.getSkuSnapshot(), i.getUnitPrice(), i.getQuantity(), i.getLineTotal()))
                                .toList()))
                .toList();

        var reviewRecords = reviews.findByUserId(userId).stream()
                .map(r -> new PrivacyDtos.ReviewRecord(r.getId(), r.getProductId(), r.getRating(), r.getTitle(),
                        r.getBody(), r.getStatus().name(), r.getCreatedAt()))
                .toList();

        var wishlistRecords = wishlists.findByUserId(userId).stream()
                .map(w -> new PrivacyDtos.WishlistRecord(w.getProductId(), w.getVariantId(), w.getAddedAt()))
                .toList();

        var loyaltyRecords = loyaltyEntries.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(e -> new PrivacyDtos.LoyaltyEntryRecord(e.getPoints(), e.getReason(), e.getOrderId(),
                        e.getCreatedAt()))
                .toList();

        return new PrivacyDtos.DataExport(
                LocalDateTime.now(),
                new PrivacyDtos.Profile(user.getId(), user.getEmail(), user.getFullName(), user.getPhone(),
                        user.getBirthDate(), user.getGender(), user.getRole().name(), user.getNewsletterOptIn(),
                        user.getEmailVerifiedAt(), user.getLastLoginAt(), user.getCreatedAt()),
                addressRecords,
                orderRecords,
                reviewRecords,
                wishlistRecords,
                new PrivacyDtos.Loyalty(loyaltyEntries.balanceOf(userId), loyaltyRecords));
    }

    // ─── Art. 17: cancellazione ───────────────────────────────────────────────

    /**
     * Chiude l'account per sempre.
     *
     * La password e' la conferma: senza, basterebbe una richiesta partita da una
     * pagina altrui (il cookie e' {@code SameSite=Lax}, ma una cancellazione
     * irreversibile merita una conferma esplicita e non solo una sessione aperta).
     */
    @Transactional
    public void eraseAccount(UUID userId, String password) {
        var user = require(userId);

        if (!encoder.matches(password, user.getPasswordHash())) {
            throw ApiException.unauthorized("Password non corretta");
        }

        // Un negozio senza nessun amministratore attivo non si recupera dal browser:
        // prima se ne nomina un altro, poi si chiude questo.
        if (user.isAdmin() && users.countByRoleAndDeletedAtIsNullAndIsActiveTrue(User.Role.admin) <= 1) {
            throw ApiException.badRequest(
                    "Sei l'ultimo amministratore attivo: nomina un altro amministratore prima di cancellare l'account.");
        }

        anonymiseAddresses(userId);
        reviews.deleteHelpfulVotesByUser(userId);
        reviews.deleteByUserId(userId);
        wishlists.deleteByUserId(userId);
        loyaltyEntries.deleteByUserId(userId);
        stockAlerts.deleteByUserId(userId);
        carts.findByUserId(userId).ifPresent(carts::delete);

        // Ultimo, dopo che tutto il resto e' andato: cadono le sessioni aperte e ogni
        // link di verifica o reimpostazione ancora in giro per le caselle di posta.
        sessions.deleteByUserId(userId);
        verifications.deleteByUserId(userId);
        resets.deleteByUserId(userId);

        anonymiseProfile(user);
    }

    /**
     * Il profilo, sovrascritto.
     *
     * Non si azzerano i campi obbligatori ({@code email}, {@code full_name},
     * {@code password_hash} sono {@code NOT NULL}): ci si scrive sopra. L'email porta
     * un UUID perche' la colonna e' {@code UNIQUE} e due cancellazioni si
     * scontrerebbero; la password diventa un valore casuale che nessuno conosce,
     * cosi' la vecchia non apre piu' niente nemmeno se un giorno qualcuno
     * riattivasse la riga a mano.
     */
    private void anonymiseProfile(User user) {
        user.setEmail("utente-cancellato-" + UUID.randomUUID() + ANONYMOUS_EMAIL_DOMAIN);
        user.setFullName(ANONYMOUS_NAME);
        user.setPasswordHash(encoder.encode(randomSecret()));
        user.setPhone(null);
        user.setBirthDate(null);
        user.setGender(null);
        user.setAvatarUrl(null);
        user.setNewsletterOptIn(false);
        user.setIsActive(false);
        user.setDeletedAt(LocalDateTime.now());
        users.save(user);
    }

    /**
     * Gli indirizzi: cancellati se nessun ordine li ha mai usati, svuotati sul posto
     * se compaiono su una fattura.
     *
     * La riga non si puo' togliere in quel caso: {@code orders.address_id} e'
     * {@code ON DELETE SET NULL}, e la fattura in PDF legge il destinatario proprio da
     * li' — cancellarla lascerebbe un documento fiscale senza il blocco destinatario.
     */
    private void anonymiseAddresses(UUID userId) {
        Set<UUID> usedByAnOrder = orders.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(Order::getAddressId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        List<UserAddress> all = addresses.findByUserIdOrderByIsDefaultDescCreatedAtAsc(userId);
        for (var address : all) {
            if (usedByAnOrder.contains(address.getId())) {
                address.setLabel(null);
                address.setFullName(ANONYMOUS_NAME);
                address.setPhone(null);
                address.setStreet(BLANKED);
                address.setStreet2(null);
                address.setCity(BLANKED);
                address.setProvince(null);
                address.setPostalCode(BLANKED);
                address.setIsDefault(false);
                addresses.save(address);
            } else {
                addresses.delete(address);
            }
        }
    }

    // ─── Utilita' ─────────────────────────────────────────────────────────────

    /** Stesso filtro di {@link UserService}: un account gia' cancellato non esiste piu'. */
    private User require(UUID userId) {
        return users.findById(userId)
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> ApiException.unauthorized("Unauthorized"));
    }

    private static String randomSecret() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}

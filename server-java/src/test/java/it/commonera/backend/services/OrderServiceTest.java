package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.Category;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.Product;
import it.commonera.backend.entities.ProductVariant;
import it.commonera.backend.entities.User;
import it.commonera.backend.entities.UserAddress;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.GiftCardRepository;
import it.commonera.backend.repositories.LoyaltyEntryRepository;
import it.commonera.backend.repositories.OrderRepository;
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
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
    TestFixtures fixtures;

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
    @Autowired
    private OrderRepository orderRepository;
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
        // L'ordine nasce `pending`: qui si simula la conferma del fornitore,
        // che e' cio' che accredita i punti e rende l'ordine annullabile da pagato.
        fixtures.confirmPaid(orderId);

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

    /**
     * Fix B: senza `@Version` sull'ordine, due {@link OrderService#cancel}
     * concorrenti sullo stesso ordine potevano leggere entrambi uno stato
     * annullabile e rimborsare entrambi buono regalo e punti — la protezione
     * "accidentale" del vincolo unico su {@code loyalty_entries} spariva
     * proprio quando {@link LoyaltyService#reverseForOrder} non scriveva
     * nessuna riga (delta punti netto zero). Qui si esercita direttamente
     * {@link OrderRepository#updateStatusIfCurrentIn}, la transizione atomica
     * che chiude la corsa, due volte in sequenza sullo stesso ordine: e'
     * esattamente cio' che succederebbe se due richieste concorrenti
     * superassero entrambe il controllo di stato in memoria e arrivassero qui
     * una dopo l'altra. La seconda deve toccare zero righe, a prescindere da
     * cosa succeda al saldo punti.
     */
    @Test
    void secondConditionalCancelTransitionOnSameOrderAffectsNoRows() {
        var request = new CheckoutService.Request(
                address.getId(),
                List.of(new CheckoutService.Line(variant.getId(), 1)),
                "standard",
                null,
                null,
                null,
                null);

        var result = checkout.placeOrder(buyer.getId(), request);
        UUID orderId = (UUID) result.get("orderId");
        em.flush();
        em.clear();

        int first = orderRepository.updateStatusIfCurrentIn(orderId, OrderStatus.cancelled, OrderService.CANCELLABLE);
        assertThat(first).isEqualTo(1);
        em.flush();
        em.clear();

        int second = orderRepository.updateStatusIfCurrentIn(orderId, OrderStatus.cancelled, OrderService.CANCELLABLE);
        assertThat(second).isZero();
    }

    /**
     * Fix C (2): un secondo {@link OrderService#cancel} sullo stesso ordine,
     * gia' annullato dal primo, deve essere rifiutato e non deve toccare di
     * nuovo ne' il saldo del buono ne' i punti fedelta'. Diversamente dal test
     * sopra, qui si chiama {@code cancel()} due volte per davvero (in
     * sequenza, non in corse concorrenti): il rifiuto arriva gia' dal
     * controllo di stato in memoria a inizio metodo, ma il risultato
     * finanziario e' lo stesso che deve garantire la guardia atomica.
     */
    @Test
    void cancellingAlreadyCancelledOrderIsRejectedAndDoesNotDoubleRefund() {
        loyaltyService.award(buyer.getId(), null, new BigDecimal("1000"));
        em.flush();
        em.clear();

        var card = giftCardService.issue(null, new BigDecimal("30.00"), "Test", null);
        em.flush();
        em.clear();

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

        orderService.cancel(buyer.getId(), orderId);
        em.flush();
        em.clear();

        assertThat(giftCardRepo.findById(card.getId()).orElseThrow().getCurrentBalance())
                .isEqualByComparingTo("30.00");
        assertThat(loyaltyEntries.balanceOf(buyer.getId())).isEqualTo(1000);

        assertThatThrownBy(() -> orderService.cancel(buyer.getId(), orderId))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("no longer be cancelled");
        em.flush();
        em.clear();

        // Il tentativo respinto non deve aver toccato di nuovo buono o punti.
        assertThat(giftCardRepo.findById(card.getId()).orElseThrow().getCurrentBalance())
                .isEqualByComparingTo("30.00");
        assertThat(loyaltyEntries.balanceOf(buyer.getId())).isEqualTo(1000);
    }

    /**
     * Fix C (1): buono regalo con saldo maggiore del totale dell'ordine.
     * Corretto per ispezione del codice ({@link GiftCardService#redeem} scala
     * solo {@code min(saldo, dovuto)}, e l'annullamento rimborsa esattamente
     * {@code order.getGiftCardAmount()}, cioe' quanto scalato per
     * quell'ordine e non il saldo residuo della carta) ma senza copertura di
     * test: e' il caso in cui un bug darebbe via soldi in silenzio, quindi
     * vale la pena verificarlo esplicitamente. Prodotto a 90,10, spedizione
     * standard 4,90 (sotto la soglia di spedizione gratuita a 100): totale
     * ordine 95,00 contro un buono da 200,00.
     */
    @Test
    void cancellingOrderRefundsExactlyWhatWasAppliedWhenGiftCardExceedsOrderTotal() {
        // Categoria e prodotto dedicati, con un prezzo scelto apposta (non i 50.00
        // del fixture condiviso) per ottenere un totale ordine di 95.00 esatti.
        var category = new Category();
        category.setName("Categoria Buono Grande");
        category.setSlug("categoria-buono-grande-" + UUID.randomUUID());
        em.persist(category);

        var expensiveProduct = new Product();
        expensiveProduct.setCategory(category);
        expensiveProduct.setName("Prodotto Sotto Soglia Spedizione");
        expensiveProduct.setSlug("prodotto-sotto-soglia-" + UUID.randomUUID());
        expensiveProduct.setBasePrice(new BigDecimal("90.10"));
        em.persist(expensiveProduct);

        var expensiveVariant = new ProductVariant();
        expensiveVariant.setProduct(expensiveProduct);
        expensiveVariant.setSku("SKU-" + UUID.randomUUID());
        expensiveVariant.setStockQty(5);
        em.persist(expensiveVariant);
        em.flush();

        var card = giftCardService.issue(null, new BigDecimal("200.00"), "Test", null);
        em.flush();
        em.clear();

        var request = new CheckoutService.Request(
                address.getId(),
                List.of(new CheckoutService.Line(expensiveVariant.getId(), 1)),
                "standard",
                null,
                card.getCode(),
                null,
                null);

        var result = checkout.placeOrder(buyer.getId(), request);
        UUID orderId = (UUID) result.get("orderId");
        em.flush();
        em.clear();

        // 90.10 di subtotale + 4.90 di spedizione standard = 95.00 dovuti; il buono
        // da 200 copre tutto e scala esattamente 95.00, non l'intero saldo.
        assertThat(giftCardRepo.findById(card.getId()).orElseThrow().getCurrentBalance())
                .isEqualByComparingTo("105.00");

        orderService.cancel(buyer.getId(), orderId);
        em.flush();
        em.clear();

        // Il saldo torna esattamente a 200.00: non di piu' (rimborso raddoppiato),
        // non di meno (rimborso parziale).
        assertThat(giftCardRepo.findById(card.getId()).orElseThrow().getCurrentBalance())
                .isEqualByComparingTo("200.00");
    }

    /**
     * Fix D: la guardia atomica dentro {@link OrderService#cancel} (l'`UPDATE ...
     * WHERE status IN (...)` di {@link OrderRepository#updateStatusIfCurrentIn},
     * letta per righe toccate) non aveva un test che la esercitasse per davvero
     * passando da {@code cancel()}. I due test sopra non ci arrivano: uno chiama
     * il repository direttamente (bypassa {@code cancel()} del tutto), l'altro
     * viene respinto prima, dal controllo di stato in memoria a inizio metodo
     * (l'ordine e' gia' "cancelled" quando lo si ricarica dopo un {@code em.clear()}).
     *
     * Per riprodurre in modo deterministico, senza thread veri in corsa, il caso
     * in cui il controllo in memoria vede uno stato annullabile ma la riga vera
     * nel database non lo e' piu': si carica l'ordine in un'entita' gestita
     * ({@code orderRepository.findById}) mentre lo stato e' ancora "paid", POI si
     * sposta la riga reale con la stessa query di update condizionale usata da
     * {@code cancel()} (una bulk update bypassa la persistence context, quindi
     * non tocca il campo Java dell'entita' gia' gestita). A quel punto
     * {@code cancel()} rilegge l'ordine: la persistence context Hibernate
     * restituisce l'istanza gia' gestita (stessa identita', stesso stato "paid"
     * ancora in memoria) invece di rileggere la riga fresca, quindi il controllo
     * iniziale passa — ma l'update atomica sulla riga vera (ormai "shipped")
     * tocca zero righe, ed e' quel percorso, non il controllo in memoria, che
     * deve far fallire l'annullamento qui.
     */
    @Test
    void cancelThrowsWhenAtomicGuardAffectsZeroRowsEvenIfInMemoryCheckStillSeesCancellable() {
        loyaltyService.award(buyer.getId(), null, new BigDecimal("1000"));
        em.flush();
        em.clear();

        var card = giftCardService.issue(null, new BigDecimal("30.00"), "Test", null);
        em.flush();
        em.clear();

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
        // L'ordine nasce `pending`: qui si simula la conferma del fornitore,
        // che e' cio' che accredita i punti e rende l'ordine annullabile da pagato.
        fixtures.confirmPaid(orderId);

        int stockAfterCheckout = variants.findById(variant.getId()).orElseThrow().getStockQty();
        BigDecimal giftCardAfterCheckout = giftCardRepo.findById(card.getId()).orElseThrow().getCurrentBalance();
        int loyaltyAfterCheckout = loyaltyEntries.balanceOf(buyer.getId());

        // Pin: carica l'ordine (stato "paid", annullabile) nella persistence
        // context di questa transazione, PRIMA di spostare la riga reale.
        var pinned = orderRepository.findById(orderId).orElseThrow();
        assertThat(OrderService.CANCELLABLE).contains(pinned.getStatus());

        // La riga vera passa a uno stato non annullabile con la stessa query
        // atomica usata da cancel(): bulk update, bypassa la persistence context,
        // "pinned" resta con lo stato vecchio in memoria.
        int moved = orderRepository.updateStatusIfCurrentIn(orderId, OrderStatus.shipped, Set.of(pinned.getStatus()));
        assertThat(moved).isEqualTo(1);

        // Prova diretta che il pin ha funzionato come previsto, non solo per
        // ispezione del codice: una query nativa (non passa dall'identity map
        // delle entita', restituisce una stringa scalare) vede la riga vera gia'
        // "shipped", mentre l'oggetto Java gia' gestito e' rimasto "paid".
        String realStatus = (String) em.createNativeQuery("select status::text from orders where id = ?1")
                .setParameter(1, orderId)
                .getSingleResult();
        assertThat(realStatus).isEqualTo("shipped");
        assertThat(pinned.getStatus()).isEqualTo(OrderStatus.paid);

        // cancel() rilegge l'ordine: trova l'istanza gia' gestita (stato ancora
        // "paid" in memoria, come appena verificato sopra), supera il controllo
        // iniziale, ma l'update atomica sulla riga vera (ormai "shipped") tocca
        // zero righe — e' quel percorso, non il controllo in memoria, a far
        // fallire l'annullamento qui.
        assertThatThrownBy(() -> orderService.cancel(buyer.getId(), orderId))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("no longer be cancelled");

        em.flush();
        em.clear();

        // Nessun effetto collaterale: ne' giacenza, ne' buono, ne' punti si sono
        // mossi rispetto a subito dopo il checkout.
        assertThat(variants.findById(variant.getId()).orElseThrow().getStockQty()).isEqualTo(stockAfterCheckout);
        assertThat(giftCardRepo.findById(card.getId()).orElseThrow().getCurrentBalance())
                .isEqualByComparingTo(giftCardAfterCheckout);
        assertThat(loyaltyEntries.balanceOf(buyer.getId())).isEqualTo(loyaltyAfterCheckout);
    }

    /**
     * Nota del reviewer sul bug originale: il caso specifico che faceva sparire
     * la protezione "per caso" del vecchio vincolo UNIQUE(order_id, reason) e'
     * quello in cui i punti guadagnati da un ordine sono esattamente uguali a
     * quelli spesi — delta netto zero. Con il movimento netto singolo di
     * {@link LoyaltyService#reverseForOrder} un delta zero non scrive nessun
     * movimento (early return su {@code net == 0}); qui si verifica esplicitamente
     * questo caso limite invece di fidarsi solo dell'ispezione del codice.
     *
     * Prodotto a 505.00: con 500 punti spesi (5.00 di sconto) l'imponibile
     * scontato e' 500.00 esatti, quindi vengono accreditati esattamente 500
     * punti — stesso numero di quelli spesi per questo ordine, delta netto zero.
     */
    @Test
    void cancellingOrderWithNetZeroLoyaltyDeltaLeavesBalanceUnchanged() {
        var category = new Category();
        category.setName("Categoria Punti Netti Zero");
        category.setSlug("categoria-punti-netti-zero-" + UUID.randomUUID());
        em.persist(category);

        var product = new Product();
        product.setCategory(category);
        product.setName("Prodotto Punti Netti Zero");
        product.setSlug("prodotto-punti-netti-zero-" + UUID.randomUUID());
        product.setBasePrice(new BigDecimal("505.00"));
        em.persist(product);

        var pricedVariant = new ProductVariant();
        pricedVariant.setProduct(product);
        pricedVariant.setSku("SKU-" + UUID.randomUUID());
        pricedVariant.setStockQty(5);
        em.persist(pricedVariant);
        em.flush();

        loyaltyService.award(buyer.getId(), null, new BigDecimal("1000"));
        em.flush();
        em.clear();
        int balanceBeforeOrder = loyaltyEntries.balanceOf(buyer.getId());

        var request = new CheckoutService.Request(
                address.getId(),
                List.of(new CheckoutService.Line(pricedVariant.getId(), 1)),
                "standard",
                null,
                null,
                500,
                null);

        var result = checkout.placeOrder(buyer.getId(), request);
        UUID orderId = (UUID) result.get("orderId");
        em.flush();
        em.clear();
        // L'ordine nasce `pending`: qui si simula la conferma del fornitore,
        // che e' cio' che accredita i punti e rende l'ordine annullabile da pagato.
        fixtures.confirmPaid(orderId);

        // 500 punti spesi (-5.00) e 500 punti accreditati sull'imponibile scontato
        // (505.00 - 5.00 = 500.00): il saldo non si e' mosso, il delta per questo
        // ordine e' gia' zero prima ancora di annullare.
        assertThat(loyaltyEntries.balanceOf(buyer.getId())).isEqualTo(balanceBeforeOrder);

        orderService.cancel(buyer.getId(), orderId);
        em.flush();
        em.clear();

        assertThat(loyaltyEntries.balanceOf(buyer.getId())).isEqualTo(balanceBeforeOrder);
        assertThat(variants.findById(pricedVariant.getId()).orElseThrow().getStockQty()).isEqualTo(5);
    }
}

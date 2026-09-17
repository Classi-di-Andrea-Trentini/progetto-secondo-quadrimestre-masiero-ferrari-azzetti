# Pagamenti reali con Stripe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sostituire il pagamento simulato di `CheckoutService` con un incasso reale via Stripe, spezzando l'unica transazione odierna in creazione-ordine + conferma-da-webhook, senza mai poter incassare denaro per un ordine inesistente ne' vendere due volte lo stesso pezzo.

**Architecture:** tre fasi. **A** (`POST /checkout`): PaymentIntent creata **fuori** transazione, poi in transazione ordine `pending` + riserva giacenza + riscatto buono/punti + `Payment` `pending` con `provider_tx_id`. **B** (webhook `payment_intent.succeeded`): ordine → `paid`, punti, carrello, email. **C** (webhook di fallimento **oppure** reaper periodico sugli ordini `pending` scaduti): compensazione. La compensazione e' **una sola funzione**, estratta da `OrderService.cancel`, che gia' la implementa correttamente.

**Tech Stack:** Spring Boot 4.1 / Java 21 / Gradle · `com.stripe:stripe-java` · Postgres 16 · Testcontainers 2.0.5 · Angular 21 + `@stripe/stripe-js`.

**Spec:** `docs/superpowers/specs/2026-09-15-commonera-java-production-design.md` (Blocco 1)

## Global Constraints

- Base package backend: `it.commonera.backend`. Context path: `/api`.
- `spring.jpa.hibernate.ddl-auto=validate`: lo schema nasce da `database/init/001_schema.sql`, **mai** da Hibernate. Nessuna migrazione in questo piano: le colonne servono gia' tutte.
- Timestamp = `LocalDateTime` (le colonne sono `timestamp without time zone`). `Instant` fa fallire l'avvio.
- Enum Postgres nominati: `@JdbcTypeCode(SqlTypes.NAMED_ENUM)` + `columnDefinition = "\"PaymentStatus\""`.
- `open-in-view=false`: la mappatura a DTO sta nei service, in transazione, mai nei controller.
- Importi: `BigDecimal`, `setScale(2, RoundingMode.HALF_UP)`. Stripe vuole **centesimi interi** (`long`).
- Se `STRIPE_SECRET_KEY` e' vuota il backend **parte lo stesso** e il checkout usa il percorso simulato di oggi, dichiarandolo in un log di avvio. Il progetto scolastico deve continuare a funzionare senza chiavi.
- Test: `./gradlew test` da `server-java/` (Docker necessario, Testcontainers). Ogni test su un bug va prima visto **rosso** rimettendo il bug.
- Commit: Conventional Commits in inglese, corti, tipo con iniziale maiuscola, solo `Feat`/`Fix`/`Docs`/`Chore`. Mai trailer di attribuzione AI. Mai `git add .`.

---

### Task 1: Dipendenza Stripe e configurazione opzionale

**Files:**
- Modify: `server-java/build.gradle` (blocco `dependencies`)
- Create: `server-java/src/main/java/it/commonera/backend/config/StripeProperties.java`
- Modify: `server-java/src/main/resources/application.properties`
- Modify: `.env.example`
- Test: `server-java/src/test/java/it/commonera/backend/config/StripePropertiesTest.java`

**Interfaces:**
- Consumes: niente.
- Produces: `StripeProperties` con `String secretKey()`, `String publishableKey()`, `String webhookSecret()`, `boolean enabled()` (vero solo se `secretKey` non e' vuota).

- [ ] **Step 1: Write the failing test**

```java
package it.commonera.backend.config;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class StripePropertiesTest {

    @Test
    void disabledWhenSecretKeyIsBlank() {
        var props = new StripeProperties("", "pk_test_x", "whsec_x");
        assertFalse(props.enabled(), "senza chiave segreta Stripe deve risultare spento");
    }

    @Test
    void enabledWhenSecretKeyIsPresent() {
        var props = new StripeProperties("sk_test_x", "pk_test_x", "whsec_x");
        assertTrue(props.enabled());
    }

    @Test
    void enabledRequiresWebhookSecretToo() {
        // Senza segreto del webhook non si puo' verificare la firma: incassare
        // senza poter confermare e' peggio che non incassare.
        var props = new StripeProperties("sk_test_x", "pk_test_x", "");
        assertFalse(props.enabled());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-java && ./gradlew test --tests '*StripePropertiesTest*'`
Expected: FAIL, compilazione: `cannot find symbol: class StripeProperties`

- [ ] **Step 3: Write minimal implementation**

`server-java/build.gradle`, dentro `dependencies`, dopo OpenPDF:

```groovy
    // Incasso reale. La libreria ufficiale: gestisce firma del webhook e
    // idempotenza, due cose che scritte a mano si sbagliano.
    implementation 'com.stripe:stripe-java:33.4.2'
```

`config/StripeProperties.java`:

```java
package it.commonera.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configurazione Stripe. Tutte e tre le chiavi sono facoltative: senza, il
 * checkout resta quello simulato e il progetto continua a funzionare. Il
 * segreto del webhook e' parte di `enabled` perche' incassare senza poter
 * verificare la conferma lascerebbe ordini pagati e mai confermati.
 */
@ConfigurationProperties(prefix = "app.stripe")
public record StripeProperties(String secretKey, String publishableKey, String webhookSecret) {

    public boolean enabled() {
        return notBlank(secretKey) && notBlank(webhookSecret);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
```

`application.properties`, in coda:

```properties
# Stripe. Vuote = checkout simulato, l'applicazione parte lo stesso.
app.stripe.secret-key=${STRIPE_SECRET_KEY:}
app.stripe.publishable-key=${STRIPE_PUBLISHABLE_KEY:}
app.stripe.webhook-secret=${STRIPE_WEBHOOK_SECRET:}
```

`CommonEraApplication.java`: aggiungere `@ConfigurationPropertiesScan` accanto a `@SpringBootApplication`.

`.env.example`, sezione nuova in coda:

```
# ─── Pagamenti (Stripe) ───────────────────────────────────────────────────
# Vuote: il checkout resta simulato e l'applicazione parte lo stesso.
# Chiavi di test su https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
# Firma del webhook: `stripe listen --forward-to localhost:3000/api/payments/webhook`
# la stampa all'avvio. Senza, il webhook rifiuta tutto.
STRIPE_WEBHOOK_SECRET=
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-java && ./gradlew test --tests '*StripePropertiesTest*'`
Expected: PASS, 3 test

- [ ] **Step 5: Commit**

```bash
git add server-java/build.gradle server-java/src/main/java/it/commonera/backend/config/StripeProperties.java \
        server-java/src/main/java/it/commonera/backend/CommonEraApplication.java \
        server-java/src/main/resources/application.properties \
        server-java/src/test/java/it/commonera/backend/config/StripePropertiesTest.java .env.example
git commit -m "Feat(payments): optional stripe configuration"
```

---

### Task 2: Mappare le colonne di `payments` che esistono e nessuno usa

**Files:**
- Modify: `server-java/src/main/java/it/commonera/backend/entities/Payment.java`
- Test: `server-java/src/test/java/it/commonera/backend/services/PaymentProviderFieldsTest.java`

**Interfaces:**
- Consumes: niente.
- Produces: su `Payment` i getter/setter `providerTxId` (String), `providerPayload` (String, colonna `jsonb`), `refundedAmount` (BigDecimal), `updatedAt` (LocalDateTime, non inseribile).

La tabella ha gia' `provider_tx_id TEXT UNIQUE`, `provider_payload JSONB`, `refunded_amount NUMERIC(10,2)`: l'entity ne mappa tre colonne su sette. `ddl-auto=validate` controlla le colonne **dichiarate**, non il contrario — per questo finora non se n'e' accorto nessuno.

- [ ] **Step 1: Write the failing test**

```java
package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.Payment;
import it.commonera.backend.repositories.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class PaymentProviderFieldsTest extends AbstractIntegrationTest {

    @Autowired PaymentRepository payments;
    @Autowired TestFixtures fixtures;

    @Test
    void persistsProviderColumns() {
        var order = fixtures.anOrderPending();
        var p = new Payment();
        p.setOrderId(order.getId());
        p.setUserId(order.getUserId());
        p.setStatus(Payment.PaymentStatus.pending);
        p.setMethod(Payment.PaymentMethod.credit_card);
        p.setAmount(new BigDecimal("12.34"));
        p.setProvider("stripe");
        p.setProviderTxId("pi_test_" + UUID.randomUUID());
        p.setProviderPayload("{\"ok\":true}");
        p.setRefundedAmount(new BigDecimal("0.00"));

        var saved = payments.saveAndFlush(p);

        assertEquals("stripe", saved.getProvider());
        assertNotNull(saved.getProviderTxId());
        assertEquals("{\"ok\":true}", saved.getProviderPayload());
        assertEquals(0, saved.getRefundedAmount().compareTo(BigDecimal.ZERO));
    }

    @Test
    void providerTxIdIsUniqueAndIsTheIdempotencyGuard() {
        // Stripe ripete gli eventi. La difesa e' il vincolo di database, non un if.
        var order = fixtures.anOrderPending();
        String intent = "pi_test_" + UUID.randomUUID();
        payments.saveAndFlush(fixtures.aPayment(order, intent));

        assertThrows(DataIntegrityViolationException.class,
                () -> payments.saveAndFlush(fixtures.aPayment(order, intent)));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-java && ./gradlew test --tests '*PaymentProviderFieldsTest*'`
Expected: FAIL, compilazione: `cannot find symbol: method setProviderTxId(String)`

- [ ] **Step 3: Write minimal implementation**

In `entities/Payment.java`, dopo il campo `provider`:

```java
    /**
     * Id del PaymentIntent presso il fornitore. La colonna e' UNIQUE: e' la
     * chiave di idempotenza del webhook, che Stripe puo' consegnare piu' volte.
     */
    @Column(name = "provider_tx_id")
    private String providerTxId;

    /** Evento grezzo del fornitore, per ricostruire cosa e' successo mesi dopo. */
    @Column(name = "provider_payload", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String providerPayload;

    @Column(name = "refunded_amount")
    private BigDecimal refundedAmount;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
```

Import da aggiungere: `org.hibernate.annotations.JdbcTypeCode`, `org.hibernate.type.SqlTypes`.

Il fixture `TestFixtures` va creato in `src/test/java/it/commonera/backend/services/TestFixtures.java` come `@Component` di test con `anOrderPending()` e `aPayment(Order, String intentId)`; se esiste gia' un helper equivalente nella suite, usare quello invece di duplicarlo.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-java && ./gradlew test --tests '*PaymentProviderFieldsTest*'`
Expected: PASS, 2 test

- [ ] **Step 5: Commit**

```bash
git add server-java/src/main/java/it/commonera/backend/entities/Payment.java \
        server-java/src/test/java/it/commonera/backend/services/PaymentProviderFieldsTest.java \
        server-java/src/test/java/it/commonera/backend/services/TestFixtures.java
git commit -m "Feat(payments): map provider columns"
```

---

### Task 3: Giacenza restituita in modo atomico

**Files:**
- Modify: `server-java/src/main/java/it/commonera/backend/repositories/ProductVariantRepository.java`
- Test: `server-java/src/test/java/it/commonera/backend/services/StockRestoreTest.java`

**Interfaces:**
- Consumes: niente.
- Produces: `int incrementStock(UUID id, int qty)` su `ProductVariantRepository`.

Oggi `OrderService.cancel` restituisce la merce con un leggi-modifica-scrivi (`variant.setStockQty(variant.getStockQty() + qty)`). Con la compensazione che d'ora in poi puo' partire **anche dal webhook e dal reaper**, cioe' da thread che non sono la richiesta del cliente, due compensazioni concorrenti sullo stesso ordine perderebbero un incremento. Lo scalo e' gia' condizionale e atomico; il ripristino deve esserlo altrettanto.

- [ ] **Step 1: Write the failing test**

```java
package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.repositories.ProductVariantRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.*;

class StockRestoreTest extends AbstractIntegrationTest {

    @Autowired ProductVariantRepository variants;
    @Autowired TestFixtures fixtures;

    @Test
    void incrementStockAddsTheQuantityBack() {
        var variant = fixtures.aVariantWithStock(3);
        assertEquals(1, variants.incrementStock(variant.getId(), 2));

        var reloaded = variants.findById(variant.getId()).orElseThrow();
        assertEquals(5, reloaded.getStockQty());
    }

    @Test
    void incrementStockReportsZeroRowsForAnUnknownVariant() {
        assertEquals(0, variants.incrementStock(java.util.UUID.randomUUID(), 1));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-java && ./gradlew test --tests '*StockRestoreTest*'`
Expected: FAIL, compilazione: `cannot find symbol: method incrementStock`

- [ ] **Step 3: Write minimal implementation**

In `ProductVariantRepository`, accanto a `decrementStock`:

```java
    /**
     * Restituisce merce a magazzino in un solo UPDATE. Il ripristino parte anche
     * dal webhook e dal reaper, non solo dalla richiesta del cliente: un
     * leggi-modifica-scrivi perderebbe un incremento se due compensazioni si
     * incrociassero.
     */
    @Modifying
    @Query("update ProductVariant v set v.stockQty = v.stockQty + :qty where v.id = :id")
    int incrementStock(@Param("id") UUID id, @Param("qty") int qty);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-java && ./gradlew test --tests '*StockRestoreTest*'`
Expected: PASS, 2 test

- [ ] **Step 5: Commit**

```bash
git add server-java/src/main/java/it/commonera/backend/repositories/ProductVariantRepository.java \
        server-java/src/test/java/it/commonera/backend/services/StockRestoreTest.java
git commit -m "Feat(stock): atomic stock restore"
```

---

### Task 4: Estrarre la compensazione in un solo posto

**Files:**
- Create: `server-java/src/main/java/it/commonera/backend/services/OrderCompensationService.java`
- Modify: `server-java/src/main/java/it/commonera/backend/services/OrderService.java` (metodo `cancel`)
- Test: `server-java/src/test/java/it/commonera/backend/services/OrderCompensationServiceTest.java`

**Interfaces:**
- Consumes: `ProductVariantRepository.incrementStock` (Task 3), `GiftCardService.refund(UUID giftCardId, BigDecimal amount, UUID orderId)`, `LoyaltyService.reverseForOrder(UUID userId, UUID orderId)`, `OrderRepository.updateStatusIfCurrentIn(UUID, OrderStatus, Collection<OrderStatus>)`.
- Produces: `boolean OrderCompensationService.releaseAndCancel(Order order, Collection<OrderStatus> allowedFrom, UUID actorId, String note)` — `false` se la transizione atomica non ha toccato righe (qualcun altro e' arrivato prima), `true` se ha compensato.

`OrderService.cancel` gia' implementa la compensazione giusta. Il webhook di fallimento e il reaper hanno bisogno della stessa identica cosa: va estratta, non riscritta, altrimenti nascono due implementazioni che divergono.

- [ ] **Step 1: Write the failing test**

```java
package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.repositories.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OrderCompensationServiceTest extends AbstractIntegrationTest {

    @Autowired OrderCompensationService compensation;
    @Autowired ProductVariantRepository variants;
    @Autowired GiftCardRepository giftCards;
    @Autowired LoyaltyEntryRepository loyalty;
    @Autowired TestFixtures fixtures;

    @Test
    void restoresStockGiftCardAndPoints() {
        var order = fixtures.anOrderPendingWith(
                /* stockReserved */ 2, /* giftCard */ new BigDecimal("10.00"), /* pointsSpent */ 500);
        int stockBefore = variants.findById(order.getItems().get(0).getVariantId())
                .orElseThrow().getStockQty();
        var cardBefore = giftCards.findById(order.getGiftCardId()).orElseThrow().getCurrentBalance();

        assertTrue(compensation.releaseAndCancel(order, List.of(OrderStatus.pending), null, "Pagamento fallito"));

        assertEquals(stockBefore + 2,
                variants.findById(order.getItems().get(0).getVariantId()).orElseThrow().getStockQty());
        assertEquals(0, giftCards.findById(order.getGiftCardId()).orElseThrow()
                .getCurrentBalance().subtract(cardBefore.add(new BigDecimal("10.00"))).compareTo(BigDecimal.ZERO));
        assertEquals(0, loyalty.netPointsForOrder(order.getId()),
                "punti spesi e restituiti devono sommare a zero");
        assertEquals(OrderStatus.cancelled, order.getStatus());
    }

    @Test
    void secondCompensationOnTheSameOrderDoesNothing() {
        // Il webhook di fallimento e il reaper possono arrivare insieme: il
        // secondo non deve rimborsare una seconda volta.
        var order = fixtures.anOrderPendingWith(1, new BigDecimal("10.00"), 0);
        assertTrue(compensation.releaseAndCancel(order, List.of(OrderStatus.pending), null, "primo"));

        var cardAfterFirst = giftCards.findById(order.getGiftCardId()).orElseThrow().getCurrentBalance();
        assertFalse(compensation.releaseAndCancel(order, List.of(OrderStatus.pending), null, "secondo"));
        assertEquals(0, giftCards.findById(order.getGiftCardId()).orElseThrow()
                .getCurrentBalance().compareTo(cardAfterFirst));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-java && ./gradlew test --tests '*OrderCompensationServiceTest*'`
Expected: FAIL, compilazione: `cannot find symbol: class OrderCompensationService`

- [ ] **Step 3: Write minimal implementation**

```java
package it.commonera.backend.services;

import it.commonera.backend.entities.*;
import it.commonera.backend.repositories.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.UUID;

/**
 * Disfa un ordine che non e' andato a buon fine, restituendo tutto cio' che il
 * checkout aveva impegnato: giacenza riservata, buono scalato, punti spesi.
 *
 * Esiste una sola volta apposta. Lo chiamano l'annullamento del cliente, il
 * webhook di pagamento fallito e il raccoglitore degli ordini scaduti: tre
 * strade diverse per la stessa identica compensazione, e tre copie della
 * stessa logica divergerebbero al primo cambiamento.
 */
@Service
public class OrderCompensationService {

    private final OrderRepository orders;
    private final ProductVariantRepository variants;
    private final GiftCardService giftCards;
    private final LoyaltyService loyalty;

    public OrderCompensationService(OrderRepository orders, ProductVariantRepository variants,
                                    GiftCardService giftCards, LoyaltyService loyalty) {
        this.orders = orders;
        this.variants = variants;
        this.giftCards = giftCards;
        this.loyalty = loyalty;
    }

    /**
     * @return false se nessuna riga e' stata toccata dalla transizione atomica,
     *         cioe' se qualcun altro ha gia' chiuso questo ordine. In quel caso
     *         non viene rimborsato niente: e' la difesa dal doppio rimborso.
     */
    @Transactional
    public boolean releaseAndCancel(Order order, Collection<OrderStatus> allowedFrom,
                                    UUID actorId, String note) {
        if (orders.updateStatusIfCurrentIn(order.getId(), OrderStatus.cancelled, allowedFrom) == 0) {
            return false;
        }
        order.setStatus(OrderStatus.cancelled);

        for (var item : order.getItems()) {
            variants.incrementStock(item.getVariantId(), item.getQuantity());
        }

        if (order.getGiftCardId() != null && order.getGiftCardAmount() != null
                && order.getGiftCardAmount().signum() > 0) {
            giftCards.refund(order.getGiftCardId(), order.getGiftCardAmount(), order.getId());
        }
        loyalty.reverseForOrder(order.getUserId(), order.getId());

        var entry = new OrderStatusHistory();
        entry.setOrder(order);
        entry.setStatus(OrderStatus.cancelled);
        entry.setChangedBy(actorId);
        entry.setNote(note);
        order.getStatusHistory().add(entry);
        return true;
    }
}
```

`OrderService.cancel` diventa:

```java
    @Transactional
    public Map<String, Object> cancel(UUID userId, UUID orderId) {
        var order = load(userId, orderId);
        if (!CANCELLABLE.contains(order.getStatus())) {
            throw ApiException.badRequest("Order can no longer be cancelled");
        }
        if (!compensation.releaseAndCancel(order, CANCELLABLE, userId, "Annullato dal cliente")) {
            throw ApiException.badRequest("Order can no longer be cancelled");
        }
        return view(order);
    }
```

`OrderService` perde i campi `variants`, `giftCards`, `loyalty` se non li usa altrove, e guadagna `OrderCompensationService compensation` nel costruttore.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-java && ./gradlew test`
Expected: PASS. **Tutti i 7 test di `OrderServiceTest` devono restare verdi**, compreso `secondConditionalCancelTransitionOnSameOrderAffectsNoRows`: se uno diventa rosso l'estrazione ha cambiato comportamento e va corretta, non il test.

- [ ] **Step 5: Commit**

```bash
git add server-java/src/main/java/it/commonera/backend/services/OrderCompensationService.java \
        server-java/src/main/java/it/commonera/backend/services/OrderService.java \
        server-java/src/test/java/it/commonera/backend/services/OrderCompensationServiceTest.java
git commit -m "Chore(orders): extract compensation service"
```

---

### Task 5: Il gateway di pagamento, con un doppio per i test

**Files:**
- Create: `server-java/src/main/java/it/commonera/backend/services/PaymentGateway.java`
- Create: `server-java/src/main/java/it/commonera/backend/services/StripePaymentGateway.java`
- Create: `server-java/src/main/java/it/commonera/backend/services/SimulatedPaymentGateway.java`
- Test: `server-java/src/test/java/it/commonera/backend/services/SimulatedPaymentGatewayTest.java`

**Interfaces:**
- Consumes: `StripeProperties` (Task 1).
- Produces: interfaccia `PaymentGateway` con
  - `Intent createIntent(BigDecimal amount, String currency, UUID orderId)` → `record Intent(String id, String clientSecret)`
  - `void cancelIntent(String intentId)`
  - `String refund(String intentId, BigDecimal amount)` → id del rimborso
  - `boolean isReal()`
  - `record Event(String type, String intentId, String rawJson)` e `Event parseWebhook(String payload, String signatureHeader)` che **lancia** `ApiException.badRequest` se la firma non torna.

Due implementazioni selezionate da `@ConditionalOnProperty`-equivalente: un `@Bean` di configurazione che sceglie in base a `StripeProperties.enabled()`. I test usano `SimulatedPaymentGateway`, che non fa rete: la suite non deve dipendere da Stripe.

- [ ] **Step 1: Write the failing test**

```java
package it.commonera.backend.services;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class SimulatedPaymentGatewayTest {

    private final SimulatedPaymentGateway gateway = new SimulatedPaymentGateway();

    @Test
    void createsAnIntentThatLooksLikeStripesButIsNotReal() {
        var intent = gateway.createIntent(new BigDecimal("12.34"), "EUR", UUID.randomUUID());
        assertTrue(intent.id().startsWith("sim_pi_"));
        assertNotNull(intent.clientSecret());
        assertFalse(gateway.isReal());
    }

    @Test
    void parsesItsOwnWebhookWithoutASignature() {
        var event = gateway.parseWebhook("{\"type\":\"payment_intent.succeeded\",\"intent\":\"sim_pi_1\"}", null);
        assertEquals("payment_intent.succeeded", event.type());
        assertEquals("sim_pi_1", event.intentId());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-java && ./gradlew test --tests '*SimulatedPaymentGatewayTest*'`
Expected: FAIL, compilazione: `cannot find symbol: class SimulatedPaymentGateway`

- [ ] **Step 3: Write minimal implementation**

`PaymentGateway.java`:

```java
package it.commonera.backend.services;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Il fornitore di pagamento, dietro un'interfaccia. Non e' astrazione per il
 * gusto di astrarre: senza, la suite di test dovrebbe parlare con Stripe per
 * poter provare il percorso dei soldi, e il progetto scolastico non
 * funzionerebbe piu' senza chiavi.
 */
public interface PaymentGateway {

    record Intent(String id, String clientSecret) {}

    record Event(String type, String intentId, String rawJson) {}

    Intent createIntent(BigDecimal amount, String currency, UUID orderId);

    void cancelIntent(String intentId);

    /** @return id del rimborso presso il fornitore. */
    String refund(String intentId, BigDecimal amount);

    /** Verifica la firma e traduce l'evento. Lancia se la firma non torna. */
    Event parseWebhook(String payload, String signatureHeader);

    /** Falso quando l'incasso non e' reale: va detto, non nascosto. */
    boolean isReal();
}
```

`SimulatedPaymentGateway.java`: genera `sim_pi_<uuid>`, `clientSecret` = `id + "_secret"`, `cancelIntent` e `refund` senza effetti di rete, `parseWebhook` legge `type` e `intent` dal JSON con Jackson **senza** verificare firme, `isReal()` → `false`.

`StripePaymentGateway.java`: usa `com.stripe.StripeClient` costruito con `secretKey`; `createIntent` converte l'importo in centesimi (`amount.movePointRight(2).longValueExact()`), passa `metadata.order_id`, e imposta `automatic_payment_methods.enabled=true`; `parseWebhook` usa `com.stripe.net.Webhook.constructEvent(payload, signatureHeader, webhookSecret)` e traduce `StripeException` in `ApiException.badRequest("Invalid webhook signature")`; `isReal()` → `true`.

Un `@Configuration` sceglie il bean:

```java
@Bean
PaymentGateway paymentGateway(StripeProperties props) {
    if (!props.enabled()) {
        log.warn("Stripe non configurato: il checkout resta simulato, nessun incasso reale.");
        return new SimulatedPaymentGateway();
    }
    return new StripePaymentGateway(props);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-java && ./gradlew test --tests '*SimulatedPaymentGatewayTest*'`
Expected: PASS, 2 test

- [ ] **Step 5: Commit**

```bash
git add server-java/src/main/java/it/commonera/backend/services/PaymentGateway.java \
        server-java/src/main/java/it/commonera/backend/services/StripePaymentGateway.java \
        server-java/src/main/java/it/commonera/backend/services/SimulatedPaymentGateway.java \
        server-java/src/main/java/it/commonera/backend/config/PaymentConfig.java \
        server-java/src/test/java/it/commonera/backend/services/SimulatedPaymentGatewayTest.java
git commit -m "Feat(payments): payment gateway abstraction"
```

---

### Task 6: Fase A — l'ordine nasce `pending` e la merce e' riservata

**Files:**
- Modify: `server-java/src/main/java/it/commonera/backend/services/CheckoutService.java:150-200` (blocco "4. Pagamento" e seguenti)
- Test: `server-java/src/test/java/it/commonera/backend/services/CheckoutPhaseATest.java`

**Interfaces:**
- Consumes: `PaymentGateway.createIntent` (Task 5), `Payment.setProviderTxId` (Task 2).
- Produces: `placeOrder` restituisce ora `Map` con le chiavi `orderId`, `clientSecret`, `amountToPay`, `status` (sempre `"pending"` quando c'e' un importo da incassare; `"paid"` quando `toCharge` e' zero).

Il cambiamento di comportamento piu' grosso del piano. Cosa **esce** dalla transazione di `placeOrder`: l'assegnazione dei punti (`LoyaltyService.award`), lo svuotamento del carrello, il passaggio a `paid`. Cosa **resta**: righe, promo, spedizione, riserva di giacenza, riscatto di buono e punti.

La `PaymentIntent` si crea **prima** di aprire la transazione. Se la transazione fallisce dopo, l'intent va annullato nel `catch`; se anche l'annullamento fallisce, l'intent scade da solo e il reaper (Task 9) ripulisce l'ordine.

Caso speciale: se `toCharge` e' zero (buono che copre tutto) non si crea nessun intent, l'ordine va dritto a `paid` e i punti si assegnano subito, perche' non c'e' nessuna conferma da aspettare.

- [ ] **Step 1: Write the failing test**

```java
package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.Payment;
import it.commonera.backend.repositories.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class CheckoutPhaseATest extends AbstractIntegrationTest {

    @Autowired CheckoutService checkout;
    @Autowired OrderRepository orders;
    @Autowired PaymentRepository payments;
    @Autowired ProductVariantRepository variants;
    @Autowired LoyaltyEntryRepository loyalty;
    @Autowired TestFixtures fixtures;

    @Test
    void orderStaysPendingAndStockIsReservedUntilTheWebhookConfirms() {
        var user = fixtures.aUser();
        var variant = fixtures.aVariantWithStock(5);
        int stockBefore = variant.getStockQty();

        var result = checkout.placeOrder(user.getId(), fixtures.aRequestFor(user, variant, 2));

        var order = orders.findById((java.util.UUID) result.get("orderId")).orElseThrow();
        assertEquals(OrderStatus.pending, order.getStatus(),
                "l'ordine non e' pagato finche' Stripe non conferma");
        assertNotNull(result.get("clientSecret"));

        assertEquals(stockBefore - 2,
                variants.findById(variant.getId()).orElseThrow().getStockQty(),
                "la merce e' riservata subito: due clienti non comprano lo stesso pezzo mentre pagano");

        var payment = payments.findByOrderId(order.getId()).orElseThrow();
        assertEquals(Payment.PaymentStatus.pending, payment.getStatus());
        assertEquals("stripe", payment.getProvider());
        assertNotNull(payment.getProviderTxId());
        assertNull(payment.getPaidAt());

        assertEquals(0, loyalty.netPointsForOrder(order.getId()),
                "i punti si assegnano alla conferma, non alla prenotazione");
    }

    @Test
    void anOrderFullyCoveredByAGiftCardSkipsThePaymentEntirely() {
        var user = fixtures.aUser();
        var variant = fixtures.aVariantWithStock(5);
        var card = fixtures.aGiftCardCovering(fixtures.priceOf(variant, 1));

        var result = checkout.placeOrder(user.getId(),
                fixtures.aRequestFor(user, variant, 1).withGiftCard(card.getCode()));

        assertEquals("paid", result.get("status"));
        assertNull(result.get("clientSecret"), "non c'e' niente da incassare");
        assertEquals(0, new BigDecimal(result.get("amountToPay").toString()).compareTo(BigDecimal.ZERO));

        var order = orders.findById((java.util.UUID) result.get("orderId")).orElseThrow();
        assertEquals(OrderStatus.paid, order.getStatus());
        assertTrue(loyalty.netPointsForOrder(order.getId()) > 0,
                "senza conferma da aspettare, i punti si assegnano subito");
    }

    @Test
    void insufficientStockRollsBackEverythingIncludingTheGiftCard() {
        var user = fixtures.aUser();
        var variant = fixtures.aVariantWithStock(1);
        var card = fixtures.aGiftCardWithBalance(new BigDecimal("50.00"));
        var balanceBefore = card.getCurrentBalance();

        assertThrows(Exception.class, () -> checkout.placeOrder(user.getId(),
                fixtures.aRequestFor(user, variant, 5).withGiftCard(card.getCode())));

        assertEquals(0, fixtures.reloadGiftCard(card).getCurrentBalance().compareTo(balanceBefore),
                "un buono bruciato per un ordine mai nato e' il guasto che non si sa piu' ricostruire");
        assertEquals(1, variants.findById(variant.getId()).orElseThrow().getStockQty());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-java && ./gradlew test --tests '*CheckoutPhaseATest*'`
Expected: FAIL — `orderStaysPendingAndStockIsReservedUntilTheWebhookConfirms` fallisce su `expected: pending but was: paid`, perche' oggi `placeOrder` marca l'ordine pagato incondizionatamente.

- [ ] **Step 3: Write minimal implementation**

In `CheckoutService`, sostituire il blocco "4. Pagamento" (righe ~168-181) e togliere `award` e svuotamento carrello dalla transazione. La struttura nuova del metodo pubblico:

```java
    /**
     * Fase A del checkout: l'ordine nasce **pending** e la merce viene riservata.
     * Il passaggio a `paid` avviene solo quando il fornitore conferma l'incasso
     * (vedi PaymentWebhookService). L'intent si crea **fuori** dalla transazione:
     * tenerla aperta per tutta la latenza di rete significa bloccare una
     * connessione di database su ogni checkout, e se il fornitore rispondesse
     * dopo un rollback avremmo incassato per un ordine che non esiste.
     */
    public Map<String, Object> placeOrder(UUID userId, Request request) {
        var draft = priceAndReserve(userId, request);   // @Transactional, tutto il calcolo + riserva
        if (draft.toCharge().signum() == 0) {
            return confirmWithoutPayment(draft);        // @Transactional
        }
        PaymentGateway.Intent intent;
        try {
            intent = gateway.createIntent(draft.toCharge(), "EUR", draft.orderId());
        } catch (RuntimeException e) {
            compensation.releaseAndCancel(draft.order(), List.of(OrderStatus.pending), userId,
                    "Apertura del pagamento fallita");
            throw e;
        }
        try {
            attachIntent(draft.orderId(), userId, draft.toCharge(), intent.id());  // @Transactional
        } catch (RuntimeException e) {
            gateway.cancelIntent(intent.id());
            compensation.releaseAndCancel(draft.order(), List.of(OrderStatus.pending), userId,
                    "Registrazione del pagamento fallita");
            throw e;
        }
        return Map.of("orderId", draft.orderId(), "clientSecret", intent.clientSecret(),
                "amountToPay", draft.toCharge(), "status", "pending");
    }
```

`priceAndReserve` contiene i passi 1-3 e 5-9 di oggi piu' `variants.decrementStock`, e **non** contiene `award`, svuotamento carrello, ne' il passaggio a `paid`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-java && ./gradlew test`
Expected: PASS. I test esistenti che davano per scontato l'ordine `paid` subito dopo `placeOrder` vanno aggiornati **al comportamento nuovo, che e' quello corretto**, non il contrario: elencarli nel messaggio di commit.

- [ ] **Step 5: Commit**

```bash
git add server-java/src/main/java/it/commonera/backend/services/CheckoutService.java \
        server-java/src/test/java/it/commonera/backend/services/CheckoutPhaseATest.java
git commit -m "Feat(checkout): reserve stock and defer payment"
```

---

### Task 7: Il webhook, con la firma verificata

**Files:**
- Create: `server-java/src/main/java/it/commonera/backend/controllers/PaymentWebhookController.java`
- Create: `server-java/src/main/java/it/commonera/backend/services/PaymentWebhookService.java`
- Modify: `server-java/src/main/java/it/commonera/backend/config/SecurityConfig.java`
- Test: `server-java/src/test/java/it/commonera/backend/services/PaymentWebhookServiceTest.java`

**Interfaces:**
- Consumes: `PaymentGateway.parseWebhook` (Task 5), `OrderCompensationService.releaseAndCancel` (Task 4).
- Produces: `void PaymentWebhookService.handle(String payload, String signatureHeader)`.

`POST /payments/webhook` va aggiunto ai `permitAll`: oggi `anyRequest().authenticated()` lo bloccherebbe. Il corpo va letto **grezzo** (`@RequestBody String`, non un DTO): qualunque deserializzazione intermedia cambia i byte e la firma non torna piu'.

- [ ] **Step 1: Write the failing test**

```java
package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.Payment;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.*;

class PaymentWebhookServiceTest extends AbstractIntegrationTest {

    @Autowired PaymentWebhookService webhook;
    @Autowired OrderRepository orders;
    @Autowired PaymentRepository payments;
    @Autowired LoyaltyEntryRepository loyalty;
    @Autowired CartRepository carts;
    @Autowired TestFixtures fixtures;

    @Test
    void successConfirmsTheOrderAwardsPointsAndEmptiesTheCart() {
        var draft = fixtures.aPendingCheckout();

        webhook.handle(fixtures.succeededEvent(draft.intentId()), null);

        var order = orders.findById(draft.orderId()).orElseThrow();
        assertEquals(OrderStatus.paid, order.getStatus());
        var payment = payments.findByOrderId(order.getId()).orElseThrow();
        assertEquals(Payment.PaymentStatus.succeeded, payment.getStatus());
        assertNotNull(payment.getPaidAt());
        assertNotNull(payment.getProviderPayload());
        assertTrue(loyalty.netPointsForOrder(order.getId()) > 0);
        assertTrue(fixtures.cartOf(draft.userId()).getItems().isEmpty());
    }

    @Test
    void theSameEventDeliveredTwiceAwardsPointsOnlyOnce() {
        // Stripe ripete gli eventi: e' documentato, non e' un caso limite.
        var draft = fixtures.aPendingCheckout();
        String event = fixtures.succeededEvent(draft.intentId());

        webhook.handle(event, null);
        int pointsAfterFirst = loyalty.netPointsForOrder(draft.orderId());
        webhook.handle(event, null);

        assertEquals(pointsAfterFirst, loyalty.netPointsForOrder(draft.orderId()));
    }

    @Test
    void failureReleasesTheReservationAndRefundsTheGiftCard() {
        var draft = fixtures.aPendingCheckoutWithGiftCard();
        int stockBefore = fixtures.stockOf(draft.variantId());

        webhook.handle(fixtures.failedEvent(draft.intentId()), null);

        assertEquals(OrderStatus.cancelled, orders.findById(draft.orderId()).orElseThrow().getStatus());
        assertEquals(stockBefore + draft.quantity(), fixtures.stockOf(draft.variantId()));
        assertEquals(0, fixtures.giftCardBalance(draft.giftCardId())
                .compareTo(draft.giftCardBalanceBefore()));
        assertEquals(Payment.PaymentStatus.failed,
                payments.findByOrderId(draft.orderId()).orElseThrow().getStatus());
    }

    @Test
    void anUnknownIntentIsIgnoredWithoutBlowingUp() {
        assertDoesNotThrow(() -> webhook.handle(fixtures.succeededEvent("pi_never_seen"), null));
    }

    @Test
    void aBadSignatureIsRejectedAndChangesNothing() {
        var real = new StripePaymentGateway(
                new it.commonera.backend.config.StripeProperties("sk_test_x", "pk_test_x", "whsec_x"));
        assertThrows(ApiException.class,
                () -> real.parseWebhook("{\"type\":\"payment_intent.succeeded\"}", "t=1,v1=deadbeef"));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-java && ./gradlew test --tests '*PaymentWebhookServiceTest*'`
Expected: FAIL, compilazione: `cannot find symbol: class PaymentWebhookService`

- [ ] **Step 3: Write minimal implementation**

`PaymentWebhookService.handle`:
1. `var event = gateway.parseWebhook(payload, signatureHeader)` — lancia se la firma non torna;
2. `payments.findByProviderTxId(event.intentId())` — se vuoto, esce senza errore (evento di un altro ambiente o di un ordine gia' ripulito);
3. `switch (event.type())`:
   - `payment_intent.succeeded` → `confirm(payment, event)`: transizione `pending → paid` con `orders.updateStatusIfCurrentIn`; **se tocca 0 righe, esce**: e' la seconda consegna dello stesso evento, e l'idempotenza finisce qui, prima di assegnare punti. Poi `Payment` → `succeeded`, `paidAt`, `providerPayload`, `loyalty.award`, svuotamento carrello, `mail.sendOrderConfirmation`;
   - `payment_intent.payment_failed`, `payment_intent.canceled` → `Payment` → `failed` con `failedReason`, poi `compensation.releaseAndCancel(order, List.of(OrderStatus.pending), null, "Pagamento non riuscito")`;
   - default → ignorato.

`PaymentWebhookController`:

```java
@RestController
@RequestMapping("/payments")
public class PaymentWebhookController {

    private final PaymentWebhookService service;

    public PaymentWebhookController(PaymentWebhookService service) { this.service = service; }

    /**
     * Il corpo si legge grezzo. Deserializzarlo e riserializzarlo cambia i byte,
     * e la firma calcolata sui byte originali non torna piu'.
     */
    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(@RequestBody String payload,
                                        @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        service.handle(payload, signature);
        return ResponseEntity.ok().build();
    }
}
```

`SecurityConfig`, prima di `anyRequest().authenticated()`:

```java
    // Il webhook non ha sessione: lo autentica la firma del fornitore, verificata
    // dentro il service. Lasciarlo dietro authenticated() lo renderebbe irraggiungibile.
    .requestMatchers(HttpMethod.POST, "/payments/webhook").permitAll()
```

Aggiungere a `PaymentRepository`: `Optional<Payment> findByProviderTxId(String providerTxId);` e `Optional<Payment> findByOrderId(UUID orderId);` se non esiste gia'.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-java && ./gradlew test --tests '*PaymentWebhookServiceTest*'`
Expected: PASS, 5 test

- [ ] **Step 5: Verify the idempotency test actually catches the bug**

Rimuovere temporaneamente il controllo "se tocca 0 righe, esce" e rilanciare: `theSameEventDeliveredTwiceAwardsPointsOnlyOnce` deve diventare **rosso**. Rimetterlo. Un test di idempotenza che passa anche senza la guardia non sta provando niente.

- [ ] **Step 6: Commit**

```bash
git add server-java/src/main/java/it/commonera/backend/controllers/PaymentWebhookController.java \
        server-java/src/main/java/it/commonera/backend/services/PaymentWebhookService.java \
        server-java/src/main/java/it/commonera/backend/repositories/PaymentRepository.java \
        server-java/src/main/java/it/commonera/backend/config/SecurityConfig.java \
        server-java/src/test/java/it/commonera/backend/services/PaymentWebhookServiceTest.java
git commit -m "Feat(payments): signed webhook confirmation"
```

---

### Task 8: Il raccoglitore degli ordini abbandonati

**Files:**
- Create: `server-java/src/main/java/it/commonera/backend/services/AbandonedOrderReaper.java`
- Modify: `server-java/src/main/java/it/commonera/backend/repositories/OrderRepository.java`
- Modify: `server-java/src/main/java/it/commonera/backend/CommonEraApplication.java` (`@EnableScheduling`)
- Test: `server-java/src/test/java/it/commonera/backend/services/AbandonedOrderReaperTest.java`

**Interfaces:**
- Consumes: `OrderCompensationService.releaseAndCancel` (Task 4), `PaymentGateway.cancelIntent` (Task 5).
- Produces: `int AbandonedOrderReaper.sweep(LocalDateTime now)` → quanti ordini ha compensato. Il metodo schedulato chiama `sweep(LocalDateTime.now())`.

Senza questo, un cliente che chiude il browser sulla schermata di pagamento tiene la merce riservata **per sempre**. E' il pezzo che oggi non esiste in nessuna forma, ed e' codice che gira da solo: un errore qui restituisce merce e denaro senza che nessuno l'abbia chiesto. `sweep` prende l'istante come parametro proprio per poterlo testare senza aspettare mezz'ora.

- [ ] **Step 1: Write the failing test**

```java
package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.repositories.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class AbandonedOrderReaperTest extends AbstractIntegrationTest {

    @Autowired AbandonedOrderReaper reaper;
    @Autowired OrderRepository orders;
    @Autowired TestFixtures fixtures;

    @Test
    void cancelsPendingOrdersOlderThanTheWindowAndGivesTheStockBack() {
        var draft = fixtures.aPendingCheckout();
        fixtures.backdateOrder(draft.orderId(), LocalDateTime.now().minusMinutes(45));
        int stockBefore = fixtures.stockOf(draft.variantId());

        assertEquals(1, reaper.sweep(LocalDateTime.now()));

        assertEquals(OrderStatus.cancelled, orders.findById(draft.orderId()).orElseThrow().getStatus());
        assertEquals(stockBefore + draft.quantity(), fixtures.stockOf(draft.variantId()));
    }

    @Test
    void leavesRecentPendingOrdersAlone() {
        // Un cliente che sta ancora digitando la carta non deve vedersi annullare l'ordine.
        var draft = fixtures.aPendingCheckout();
        fixtures.backdateOrder(draft.orderId(), LocalDateTime.now().minusMinutes(5));

        assertEquals(0, reaper.sweep(LocalDateTime.now()));
        assertEquals(OrderStatus.pending, orders.findById(draft.orderId()).orElseThrow().getStatus());
    }

    @Test
    void neverTouchesAnOrderThatHasAlreadyBeenPaid() {
        var draft = fixtures.aPaidCheckout();
        fixtures.backdateOrder(draft.orderId(), LocalDateTime.now().minusDays(3));

        assertEquals(0, reaper.sweep(LocalDateTime.now()));
        assertEquals(OrderStatus.paid, orders.findById(draft.orderId()).orElseThrow().getStatus());
    }

    @Test
    void aWebhookArrivingDuringTheSweepWins() {
        // Corsa reale: il pagamento riesce mentre il reaper sta raccogliendo.
        // La transizione atomica decide, e il perdente non compensa nulla.
        var draft = fixtures.aPendingCheckout();
        fixtures.backdateOrder(draft.orderId(), LocalDateTime.now().minusMinutes(45));
        fixtures.markPaid(draft.orderId());

        assertEquals(0, reaper.sweep(LocalDateTime.now()));
        assertEquals(OrderStatus.paid, orders.findById(draft.orderId()).orElseThrow().getStatus());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-java && ./gradlew test --tests '*AbandonedOrderReaperTest*'`
Expected: FAIL, compilazione: `cannot find symbol: class AbandonedOrderReaper`

- [ ] **Step 3: Write minimal implementation**

`OrderRepository`:

```java
    @Query("select o from Order o where o.status = :status and o.createdAt < :before")
    List<Order> findStaleByStatus(@Param("status") OrderStatus status,
                                  @Param("before") LocalDateTime before);
```

`AbandonedOrderReaper`:

```java
/**
 * Raccoglie gli ordini rimasti `pending` oltre la finestra di pagamento.
 *
 * Senza, un cliente che chiude il browser sulla schermata della carta tiene la
 * merce riservata per sempre. Gira da solo, quindi la transizione atomica di
 * `releaseAndCancel` e' l'unica cosa che lo separa dal rimborsare un ordine che
 * nel frattempo e' stato pagato davvero.
 */
@Service
public class AbandonedOrderReaper {

    private static final Duration WINDOW = Duration.ofMinutes(30);

    @Scheduled(fixedDelay = 5 * 60 * 1000L, initialDelay = 60 * 1000L)
    public void scheduledSweep() {
        int swept = sweep(LocalDateTime.now());
        if (swept > 0) log.info("Ordini abbandonati compensati: {}", swept);
    }

    @Transactional
    public int sweep(LocalDateTime now) {
        int done = 0;
        for (var order : orders.findStaleByStatus(OrderStatus.pending, now.minus(WINDOW))) {
            payments.findByOrderId(order.getId())
                    .map(Payment::getProviderTxId)
                    .ifPresent(this::cancelIntentQuietly);
            if (compensation.releaseAndCancel(order, List.of(OrderStatus.pending), null,
                    "Pagamento non completato entro i termini")) {
                done++;
            }
        }
        return done;
    }
}
```

`cancelIntentQuietly` cattura e logga: un intent gia' scaduto lato Stripe non deve impedire la compensazione locale.

`@EnableScheduling` su `CommonEraApplication`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-java && ./gradlew test --tests '*AbandonedOrderReaperTest*'`
Expected: PASS, 4 test

- [ ] **Step 5: Commit**

```bash
git add server-java/src/main/java/it/commonera/backend/services/AbandonedOrderReaper.java \
        server-java/src/main/java/it/commonera/backend/repositories/OrderRepository.java \
        server-java/src/main/java/it/commonera/backend/CommonEraApplication.java \
        server-java/src/test/java/it/commonera/backend/services/AbandonedOrderReaperTest.java
git commit -m "Feat(orders): reap abandoned reservations"
```

---

### Task 9: Rimborsi veri su annullo e reso

**Files:**
- Modify: `server-java/src/main/java/it/commonera/backend/services/OrderCompensationService.java`
- Modify: `server-java/src/main/java/it/commonera/backend/services/ReturnService.java` (metodo `updateStatus`)
- Test: `server-java/src/test/java/it/commonera/backend/services/RefundTest.java`

**Interfaces:**
- Consumes: `PaymentGateway.refund` (Task 5).
- Produces: `void OrderCompensationService.refundCharge(Order order, BigDecimal amount, String reason)`.

Oggi `payments` **non registra mai un rimborso**: `cancel` restituisce buono e punti ma non tocca il `Payment`, e `ReturnService.updateStatus` scrive solo un `refundAmount` battuto a mano dall'admin. Con un incasso reale questo diventa denaro che resta incassato.

- [ ] **Step 1: Write the failing test**

```java
package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.Payment;
import it.commonera.backend.repositories.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class RefundTest extends AbstractIntegrationTest {

    @Autowired OrderService orderService;
    @Autowired ReturnService returns;
    @Autowired PaymentRepository payments;
    @Autowired TestFixtures fixtures;

    @Test
    void cancellingAPaidOrderRecordsAFullRefund() {
        var draft = fixtures.aPaidCheckout();

        orderService.cancel(draft.userId(), draft.orderId());

        var payment = payments.findByOrderId(draft.orderId()).orElseThrow();
        assertEquals(Payment.PaymentStatus.refunded, payment.getStatus());
        assertEquals(0, payment.getRefundedAmount().compareTo(payment.getAmount()));
    }

    @Test
    void anApprovedReturnRecordsAPartialRefund() {
        var draft = fixtures.aPaidCheckout();
        var ret = fixtures.aReturnFor(draft, new BigDecimal("15.00"));

        returns.updateStatus(fixtures.anAdmin().getId(), ret.getId(),
                fixtures.refundedStatusRequest(new BigDecimal("15.00")));

        var payment = payments.findByOrderId(draft.orderId()).orElseThrow();
        assertEquals(Payment.PaymentStatus.partially_refunded, payment.getStatus());
        assertEquals(0, payment.getRefundedAmount().compareTo(new BigDecimal("15.00")));
    }

    @Test
    void refundsNeverExceedWhatWasActuallyCharged() {
        var draft = fixtures.aPaidCheckout();
        var ret = fixtures.aReturnFor(draft, new BigDecimal("9999.00"));

        assertThrows(Exception.class, () -> returns.updateStatus(fixtures.anAdmin().getId(),
                ret.getId(), fixtures.refundedStatusRequest(new BigDecimal("9999.00"))));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-java && ./gradlew test --tests '*RefundTest*'`
Expected: FAIL — `cancellingAPaidOrderRecordsAFullRefund` fallisce perche' lo stato del `Payment` resta `succeeded`.

- [ ] **Step 3: Write minimal implementation**

`refundCharge` su `OrderCompensationService`: carica il `Payment`, verifica che `refundedAmount + amount <= amount incassato` (altrimenti `ApiException.badRequest`), chiama `gateway.refund(providerTxId, amount)` solo se `providerTxId` non e' nullo e `gateway.isReal()`, poi aggiorna `refundedAmount` e lo stato (`refunded` se copre tutto, `partially_refunded` altrimenti). `releaseAndCancel` lo invoca quando l'ordine era gia' `paid`. `ReturnService.updateStatus` lo invoca al passaggio a `refunded`.

`Payment.PaymentStatus` deve includere `partially_refunded`: l'enum Postgres `"PaymentStatus"` ha `pending/succeeded/failed/refunded`, quindi **serve** aggiungere il valore in `database/init/001_schema.sql` con `ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'partially_refunded';` in coda al file. Questa e' l'unica modifica allo schema di tutto il piano: annotarla nel messaggio di commit.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-java && ./gradlew test --tests '*RefundTest*'`
Expected: PASS, 3 test

- [ ] **Step 5: Commit**

```bash
git add server-java/src/main/java/it/commonera/backend/services/OrderCompensationService.java \
        server-java/src/main/java/it/commonera/backend/services/ReturnService.java \
        server-java/src/main/java/it/commonera/backend/entities/Payment.java \
        database/init/001_schema.sql \
        server-java/src/test/java/it/commonera/backend/services/RefundTest.java
git commit -m "Feat(payments): real refunds on cancel and return"
```

---

### Task 10: Email di conferma d'ordine

**Files:**
- Modify: `server-java/src/main/java/it/commonera/backend/services/MailService.java`
- Modify: `server-java/src/main/java/it/commonera/backend/services/PaymentWebhookService.java`
- Test: `server-java/src/test/java/it/commonera/backend/services/OrderConfirmationMailTest.java`

**Interfaces:**
- Consumes: `MailService.send(String to, String subject, String html)`.
- Produces: `void MailService.sendOrderConfirmation(String to, Order order, List<OrderItem> items)`.

`CheckoutService` **non manda nessuna email**: oggi si compra e non arriva niente. Per un negozio vero e' il primo messaggio che il cliente si aspetta.

- [ ] **Step 1: Write the failing test**

```java
package it.commonera.backend.services;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class OrderConfirmationMailTest {

    @Test
    void confirmationBodyCarriesOrderNumberTotalAndLines() {
        var html = MailService.renderOrderConfirmation(
                "Marco Rossi", "2026-0042", new java.math.BigDecimal("94.90"),
                java.util.List.of(new MailService.Line("T-shirt nera", "M", 2, new java.math.BigDecimal("29.90"))));

        assertTrue(html.contains("2026-0042"));
        assertTrue(html.contains("94,90") || html.contains("94.90"));
        assertTrue(html.contains("T-shirt nera"));
        assertTrue(html.contains("Marco Rossi"));
    }

    @Test
    void escapesNamesThatContainMarkup() {
        var html = MailService.renderOrderConfirmation(
                "<script>alert(1)</script>", "2026-0001", java.math.BigDecimal.ONE, java.util.List.of());
        assertFalse(html.contains("<script>"));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-java && ./gradlew test --tests '*OrderConfirmationMailTest*'`
Expected: FAIL, compilazione: `cannot find symbol: method renderOrderConfirmation`

- [ ] **Step 3: Write minimal implementation**

`renderOrderConfirmation` statico (cosi' e' testabile senza contesto Spring), che usa l'`escape(...)` gia' presente nella classe; `sendOrderConfirmation` lo passa a `send(...)`. `PaymentWebhookService.confirm` lo chiama dopo l'assegnazione dei punti. Vale la regola gia' in vigore: un'email fallita non fa fallire l'operazione — `send` cattura e logga.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-java && ./gradlew test --tests '*OrderConfirmationMailTest*'`
Expected: PASS, 2 test

- [ ] **Step 5: Commit**

```bash
git add server-java/src/main/java/it/commonera/backend/services/MailService.java \
        server-java/src/main/java/it/commonera/backend/services/PaymentWebhookService.java \
        server-java/src/test/java/it/commonera/backend/services/OrderConfirmationMailTest.java
git commit -m "Feat(mail): order confirmation email"
```

---

### Task 11: Il passo di pagamento nel checkout Angular

**Files:**
- Modify: `e-commerce/package.json` (dipendenza `@stripe/stripe-js`)
- Modify: `e-commerce/src/app/pages/checkout/checkout.ts:8` (union), `:24`, `:187-199`, `:229-250`, `:287-291`
- Modify: `e-commerce/src/app/pages/checkout/checkout.html` (blocco nuovo fra riga 375 e 377; nota "pagamento simulato" alle righe 428-433 da togliere)
- Modify: `e-commerce/src/app/services/cart-service.ts:296-311` (`placeOrder`)
- Create: `e-commerce/src/app/services/stripe.service.ts`
- Test: `e-commerce/src/app/pages/checkout/checkout.spec.ts`

**Interfaces:**
- Consumes: la risposta di `POST /api/checkout`, ora `{ orderId, clientSecret, amountToPay, status }` (Task 6).
- Produces: `StripeService.confirmPayment(clientSecret: string, element: StripePaymentElement): Promise<{ ok: boolean; error?: string }>`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { nextStepFrom, stepsFor } from './checkout-steps';

describe('passi del checkout', () => {
  it('inserisce il pagamento fra spedizione e riepilogo quando c\'e\' da pagare', () => {
    expect(stepsFor(94.9).map(s => s.key)).toEqual(['address', 'shipping', 'payment', 'review']);
    expect(nextStepFrom('shipping', 94.9)).toBe('payment');
  });

  it('salta il pagamento se il buono copre tutto', () => {
    expect(stepsFor(0).map(s => s.key)).toEqual(['address', 'shipping', 'review']);
    expect(nextStepFrom('shipping', 0)).toBe('review');
  });

  it('torna indietro saltando il pagamento quando non c\'e\'', () => {
    expect(nextStepFrom('review', 0, 'back')).toBe('shipping');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd e-commerce && npm test -- checkout`
Expected: FAIL, `Cannot find module './checkout-steps'`

- [ ] **Step 3: Write minimal implementation**

Estrarre la logica dei passi in `e-commerce/src/app/pages/checkout/checkout-steps.ts` — funzioni pure, testabili senza montare il componente. `CheckoutStep` diventa `'address' | 'shipping' | 'payment' | 'review'`. `stepsFor(amountToPay)` omette `payment` quando l'importo e' zero; `nextStepFrom(current, amountToPay, direction = 'forward')` usa `stepsFor`. Il componente chiama queste due funzioni invece di avere l'array cablato alle righe 287-291.

`stripe.service.ts` carica `loadStripe(environment.stripePublishableKey)` una volta sola e monta il Payment Element. Nel blocco `@if (step() === 'payment')` di `checkout.html` vive il contenitore del Payment Element. `placeOrder()` non conclude piu' l'ordine: chiama `POST /checkout`, riceve `clientSecret`, e il bottone "Paga" invoca `confirmPayment`. Alla conferma riuscita, la schermata di successo gia' esistente. Quando `status` e' `"paid"` (buono che copre tutto) si va dritti alla schermata di successo senza toccare Stripe.

Togliere la nota "Il pagamento e' simulato — nessun addebito reale" da `checkout.html:428-433`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd e-commerce && npm test`
Expected: PASS, 20 test esistenti + 3 nuovi

- [ ] **Step 5: Commit**

```bash
git add e-commerce/package.json e-commerce/package-lock.json \
        e-commerce/src/app/pages/checkout/ e-commerce/src/app/services/stripe.service.ts \
        e-commerce/src/app/services/cart-service.ts
git commit -m "Feat(checkout): stripe payment step"
```

---

### Task 12: Verifica dal vivo con lo stack acceso

**Files:** nessuno da modificare; e' il cancello prima di dire che funziona.

- [ ] **Step 1: Suite completa verde**

Run: `cd server-java && ./gradlew test && cd ../e-commerce && npm test`
Expected: backend 59 + i nuovi, frontend 20 + i nuovi. Zero rossi. `BackendApplicationTests` richiede Docker, che dev'essere acceso.

- [ ] **Step 2: Stack su**

Run: `docker compose up -d --build`
Expected: tre servizi sani. Il build del backend scarica da Maven Central: verificato a ~800 KB/s il 2026-09-15.

- [ ] **Step 3: Percorso completo senza chiavi Stripe**

Registrarsi, aggiungere al carrello, checkout. Con `STRIPE_SECRET_KEY` vuota il gateway simulato deve portare l'ordine a `paid` e il negozio deve comportarsi come prima. **Il progetto scolastico non deve essersi rotto.**

- [ ] **Step 4: Percorso completo con chiavi di test**

Richiede `sk_test_`/`pk_test_` da Alessio e `stripe listen --forward-to localhost:3000/api/payments/webhook`. Verificare: carta `4242 4242 4242 4242` → ordine `paid`, punti assegnati, carrello vuoto, email in log; carta `4000 0000 0000 0002` (rifiutata) → ordine `cancelled`, giacenza restituita, buono restituito.

- [ ] **Step 5: Query di controllo sul database**

```sql
select o.id, o.status, p.status, p.provider, p.provider_tx_id, p.refunded_amount
from orders o left join payments p on p.order_id = o.id
order by o.created_at desc limit 10;
```

Nessun ordine `paid` senza un `payments` corrispondente, nessun `provider_tx_id` ripetuto.

- [ ] **Step 6: Commit finale**

```bash
git commit --allow-empty -m "Chore(payments): verified end to end"
```

---

## Self-review

**Copertura dello spec (Blocco 1).** Fase A → Task 6. Fase B → Task 7. Fase C, webhook → Task 7; Fase C, reaper → Task 8. Compensazione unica → Task 4. Colonne gia' esistenti mappate → Task 2. Rimborsi → Task 9. Firma del webhook → Task 5 + 7. Frontend, quarto passo e salto a importo zero → Task 11. Email di conferma → Task 10. Chiavi facoltative col percorso simulato → Task 1 + 5. Verifica dal vivo → Task 12.

**Scostamento dallo spec, dichiarato.** Lo spec diceva "nessuna migrazione del database". Il Task 9 ne richiede **una riga**: `partially_refunded` manca dall'enum Postgres `"PaymentStatus"` e serve per distinguere un reso parziale da un rimborso totale. E' l'unica, ed e' additiva.

**Coerenza dei nomi.** `releaseAndCancel` e `refundCharge` sono usati con la stessa firma in Task 4, 7, 8, 9. `incrementStock` definito in Task 3, usato in Task 4. `providerTxId` definito in Task 2, usato in Task 6, 7, 8, 9. `PaymentGateway.Intent`/`.Event` definiti in Task 5, usati in Task 6 e 7. `stepsFor`/`nextStepFrom` definiti e usati in Task 11.

**Ordine obbligato.** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12. Il Task 4 deve precedere il 6, il 7 e l'8; il Task 3 deve precedere il 4.

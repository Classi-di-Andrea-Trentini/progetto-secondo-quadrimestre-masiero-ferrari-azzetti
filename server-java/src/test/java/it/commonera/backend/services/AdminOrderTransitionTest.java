package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.User;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Transizioni di stato guidate dall'amministratore.
 *
 * Prima di questi test {@code updateOrderStatus} faceva {@code setStatus} e
 * basta: qualsiasi stringa valida dell'enum era accettata da qualsiasi stato.
 * Il caso che fa male e' `cancelled` -> `delivered`, perche' l'annullamento ha
 * gia' restituito merce, buono e punti: riportare l'ordine "consegnato" lascia
 * il negozio con la merce resa a magazzino **e** consegnata al cliente, il buono
 * ricaricato e i punti restituiti. Nessuna compensazione sa piu' disfare quello
 * stato, perche' non c'e' nessun passaggio che lo abbia mai costruito.
 */
class AdminOrderTransitionTest extends AbstractIntegrationTest {

    @Autowired
    private AdminService admin;
    @Autowired
    private OrderService orderService;
    @Autowired
    private OrderRepository orders;
    @Autowired
    private UserRepository users;
    @Autowired
    private TestFixtures fixtures;
    @PersistenceContext
    private EntityManager em;

    private UUID adminId;

    @BeforeEach
    void setUp() {
        var operator = new User();
        operator.setEmail("admin." + UUID.randomUUID() + "@example.com");
        operator.setPasswordHash("non-usato-in-questo-test");
        operator.setFullName("Amministratore Prova");
        operator.setRole(User.Role.admin);
        adminId = users.save(operator).getId();
        em.flush();
    }

    /** Il buco descritto nella specifica, nella sua forma esatta. */
    @Test
    void aCancelledOrderCannotBeMarkedDelivered() {
        var draft = fixtures.aPendingCheckout();
        // Annullato dalla strada vera del cliente, che passa dalla compensazione.
        orderService.cancel(draft.userId(), draft.orderId());
        reload();

        assertThatThrownBy(() -> admin.updateOrderStatus(adminId, draft.orderId(), "delivered", null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("cancelled");

        assertThat(statusOf(draft.orderId())).isEqualTo(OrderStatus.cancelled);
    }

    /**
     * Incassare e' del fornitore, non dell'amministratore: se bastasse un PATCH
     * per dichiarare pagato un ordine, la merce partirebbe senza che nessuno
     * abbia pagato — e il webhook, arrivando dopo, non troverebbe piu' un
     * `pending` da confermare.
     */
    @Test
    void anAdminCannotMarkAPendingOrderAsPaid() {
        var draft = fixtures.aPendingCheckout();
        reload();

        assertThatThrownBy(() -> admin.updateOrderStatus(adminId, draft.orderId(), "paid", null))
                .isInstanceOf(ApiException.class);

        assertThat(statusOf(draft.orderId())).isEqualTo(OrderStatus.pending);
    }

    /** La merce e' partita: da qui non si torna indietro con un cambio di stato. */
    @Test
    void aShippedOrderCannotGoBackToProcessing() {
        var draft = fixtures.aPaidCheckout();
        reload();
        admin.updateOrderStatus(adminId, draft.orderId(), "shipped", "TRACK-1");
        reload();

        assertThatThrownBy(() -> admin.updateOrderStatus(adminId, draft.orderId(), "processing", null))
                .isInstanceOf(ApiException.class);

        assertThat(statusOf(draft.orderId())).isEqualTo(OrderStatus.shipped);
    }

    /** Il percorso normale della lavorazione resta percorribile tutto. */
    @Test
    void theForwardFlowIsAllowed() {
        var draft = fixtures.aPaidCheckout();
        reload();

        for (String next : new String[]{"processing", "shipped", "delivered", "completed"}) {
            assertThatCode(() -> admin.updateOrderStatus(adminId, draft.orderId(), next, null))
                    .doesNotThrowAnyException();
            reload();
        }

        assertThat(statusOf(draft.orderId())).isEqualTo(OrderStatus.completed);
    }

    /**
     * Annullare dall'area amministrativa deve **compensare**, non solo cambiare
     * la scritta: la merce riservata dal checkout torna a magazzino. Se
     * l'annullamento passasse ancora da {@code setStatus}, la giacenza
     * resterebbe impegnata per sempre.
     */
    @Test
    void cancellingFromTheAdminAreaReleasesTheReservedStock() {
        var draft = fixtures.aPendingCheckout();
        reload();
        int reserved = fixtures.stockOf(draft.variantId());

        admin.updateOrderStatus(adminId, draft.orderId(), "cancelled", null);
        reload();

        assertThat(statusOf(draft.orderId())).isEqualTo(OrderStatus.cancelled);
        assertThat(fixtures.stockOf(draft.variantId())).isEqualTo(reserved + draft.quantity());
    }

    /** Uno stato che non esiste nell'enum resta un 400, non un 500. */
    @Test
    void anUnknownStatusIsStillRejected() {
        var draft = fixtures.aPendingCheckout();
        reload();

        assertThatThrownBy(() -> admin.updateOrderStatus(adminId, draft.orderId(), "teleported", null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid order status");
    }

    /**
     * Gli UPDATE atomici della compensazione non aggiornano le entita' gia' in
     * sessione: senza svuotarla, il passo successivo leggerebbe lo stato di prima.
     */
    private void reload() {
        em.flush();
        em.clear();
    }

    private OrderStatus statusOf(UUID orderId) {
        return orders.findById(orderId).map(Order::getStatus).orElseThrow();
    }
}

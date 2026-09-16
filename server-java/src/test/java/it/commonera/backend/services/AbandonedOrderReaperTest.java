package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.repositories.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Il raccoglitore degli ordini abbandonati.
 *
 * Senza, chi chiude il browser sulla schermata della carta tiene la merce
 * riservata **per sempre**. E' codice che gira da solo: un errore qui
 * restituisce merce e denaro senza che nessuno l'abbia chiesto, quindi i casi
 * che contano sono i due estremi — non raccogliere chi sta ancora pagando, non
 * toccare mai chi ha gia' pagato.
 */
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
        fixtures.confirmPaid(draft.orderId());

        assertEquals(0, reaper.sweep(LocalDateTime.now()));
        assertEquals(OrderStatus.paid, orders.findById(draft.orderId()).orElseThrow().getStatus());
    }
}

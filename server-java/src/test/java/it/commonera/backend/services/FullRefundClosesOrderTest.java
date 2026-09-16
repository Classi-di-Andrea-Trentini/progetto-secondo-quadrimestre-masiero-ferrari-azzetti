package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.dtos.ReturnDtos;
import it.commonera.backend.entities.OrderReturn;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Un ordine rimborsato per intero deve **dirlo**.
 *
 * Il pagamento passava a `refunded` ma l'ordine restava `delivered`: chi
 * guardava l'elenco vedeva merce consegnata e pagata, mentre il denaro era gia'
 * tornato indietro. Due verita' diverse sulla stessa riga.
 */
class FullRefundClosesOrderTest extends AbstractIntegrationTest {

    @Autowired ReturnService returns;
    @Autowired OrderCompensationService compensation;
    @Autowired OrderRepository orders;
    @Autowired PaymentRepository payments;
    @Autowired TestFixtures fixtures;

    @Test
    void refundingTheWholeChargeMovesTheOrderToRefunded() {
        var draft = fixtures.aPaidCheckout();
        fixtures.forceStatus(draft.orderId(), OrderStatus.delivered);
        var order = orders.findById(draft.orderId()).orElseThrow();
        var charged = payments.findByOrderId(draft.orderId()).orElseThrow().getAmount();

        compensation.refundCharge(order, charged, "reso completo");

        assertEquals(OrderStatus.refunded, orders.findById(draft.orderId()).orElseThrow().getStatus());
    }

    @Test
    void aPartialRefundLeavesTheOrderWhereItIs() {
        var draft = fixtures.aPaidCheckout();
        fixtures.forceStatus(draft.orderId(), OrderStatus.delivered);
        var ret = fixtures.aReturnFor(draft);

        returns.updateStatus(ret.getId(), new ReturnDtos.UpdateStatusRequest(
                OrderReturn.ReturnStatus.refunded, null, new BigDecimal("10.00")));

        assertEquals(OrderStatus.delivered, orders.findById(draft.orderId()).orElseThrow().getStatus(),
                "una parte restituita non annulla l'ordine: il resto e' stato comprato davvero");
    }

    @Test
    void cancellingStaysCancelledEvenThoughTheChargeIsFullyRefunded() {
        // `releaseAndCancel` rimborsa tutto: l'ordine deve restare `cancelled`,
        // che e' terminale, non diventare `refunded`.
        var draft = fixtures.aPaidCheckout();

        fixtures.cancelAsCustomer(draft);

        assertEquals(OrderStatus.cancelled, orders.findById(draft.orderId()).orElseThrow().getStatus());
    }
}

package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.dtos.ReturnDtos;
import it.commonera.backend.entities.OrderReturn;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.Payment;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * I rimborsi, registrati su `payments`.
 *
 * Fino a ieri un annullamento restituiva buono e punti ma **non toccava il
 * pagamento**, e un reso approvato scriveva solo un importo battuto a mano
 * dall'amministratore. Con un incasso simulato era una riga mancante; con un
 * incasso reale e' denaro che resta in cassa.
 */
class RefundTest extends AbstractIntegrationTest {

    @Autowired OrderService orderService;
    @Autowired ReturnService returns;
    @Autowired PaymentRepository payments;
    @Autowired OrderRepository orders;
    @Autowired OrderCompensationService compensation;
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
    void cancellingAnUnpaidOrderRefundsNothingBecauseNothingWasCharged() {
        var draft = fixtures.aPendingCheckout();

        orderService.cancel(draft.userId(), draft.orderId());

        var payment = payments.findByOrderId(draft.orderId()).orElseThrow();
        assertNotEquals(Payment.PaymentStatus.refunded, payment.getStatus(),
                "non si rimborsa un incasso che non c'e' mai stato");
    }

    @Test
    void anApprovedReturnRecordsAPartialRefund() {
        var draft = fixtures.aPaidCheckout();
        var ret = fixtures.aReturnFor(draft);

        returns.updateStatus(ret.getId(), new ReturnDtos.UpdateStatusRequest(
                OrderReturn.ReturnStatus.refunded, "Reso accettato", new BigDecimal("15.00")));

        var payment = payments.findByOrderId(draft.orderId()).orElseThrow();
        assertEquals(Payment.PaymentStatus.partially_refunded, payment.getStatus());
        assertEquals(0, payment.getRefundedAmount().compareTo(new BigDecimal("15.00")));
    }

    @Test
    void refundsNeverExceedWhatWasActuallyCharged() {
        var draft = fixtures.aPaidCheckout();
        var ret = fixtures.aReturnFor(draft);

        assertThrows(RuntimeException.class, () -> returns.updateStatus(ret.getId(),
                new ReturnDtos.UpdateStatusRequest(OrderReturn.ReturnStatus.refunded, null,
                        new BigDecimal("9999.00"))));
    }

    /**
     * Piu' rimborsi parziali si sommano. Qui si passa direttamente dal servizio
     * perche' su un ordine si puo' aprire **un solo reso**: la somma dei
     * parziali e' una regola del pagamento, non del reso.
     */
    @Test
    void partialRefundsAccumulateAndTheLastOneClosesThePayment() {
        var draft = fixtures.aPaidCheckout();
        var order = orders.findById(draft.orderId()).orElseThrow();
        var charged = payments.findByOrderId(draft.orderId()).orElseThrow().getAmount();
        var half = charged.divide(new BigDecimal("2"), 2, java.math.RoundingMode.HALF_UP);

        compensation.refundCharge(order, half, "primo parziale");
        var afterFirst = payments.findByOrderId(draft.orderId()).orElseThrow();
        assertEquals(Payment.PaymentStatus.partially_refunded, afterFirst.getStatus());
        assertEquals(0, afterFirst.getRefundedAmount().compareTo(half));

        compensation.refundCharge(order, charged.subtract(half), "secondo parziale");
        var payment = payments.findByOrderId(draft.orderId()).orElseThrow();
        assertEquals(Payment.PaymentStatus.refunded, payment.getStatus(),
                "rimborsato tutto: lo stato non puo' restare 'parziale'");
        assertEquals(0, payment.getRefundedAmount().compareTo(charged));

        assertThrows(RuntimeException.class,
                () -> compensation.refundCharge(order, new BigDecimal("0.01"), "un centesimo di troppo"),
                "finito il capiente, non si restituisce piu' niente");
    }
}

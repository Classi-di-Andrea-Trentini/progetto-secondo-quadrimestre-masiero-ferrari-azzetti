package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.Payment;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Fase B: la conferma del fornitore.
 *
 * E' l'unico posto che puo' dichiarare pagato un ordine, e deve reggere due
 * cose che non sono casi limite ma normale amministrazione: Stripe **ripete**
 * gli eventi, e chiunque conosca l'indirizzo del webhook puo' provare a
 * chiamarlo.
 */
class PaymentWebhookServiceTest extends AbstractIntegrationTest {

    @Autowired PaymentWebhookService webhook;
    @Autowired OrderRepository orders;
    @Autowired PaymentRepository payments;
    @Autowired LoyaltyEntryRepository loyalty;
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
        assertNotNull(payment.getProviderPayload(), "l'evento va conservato: e' la prova dell'incasso");

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
        assertEquals(stockBefore + draft.quantity(), fixtures.stockOf(draft.variantId()),
                "la merce riservata torna disponibile: nessuno l'ha comprata");
        assertEquals(0, fixtures.giftCardBalanceOf(draft.giftCardId())
                        .compareTo(draft.giftCardBalanceBefore()),
                "il buono scalato per un pagamento mai riuscito va restituito");
        assertEquals(Payment.PaymentStatus.failed,
                payments.findByOrderId(draft.orderId()).orElseThrow().getStatus());
    }

    @Test
    void anUnknownIntentIsIgnoredWithoutBlowingUp() {
        // Eventi di un altro ambiente, o di ordini gia' ripuliti: rispondere con
        // un errore farebbe ritentare Stripe all'infinito su qualcosa che non
        // esiste.
        assertDoesNotThrow(() -> webhook.handle(fixtures.succeededEvent("pi_mai_visto"), null));
    }

    @Test
    void aBadSignatureIsRejectedAndChangesNothing() {
        var real = new StripePaymentGateway(
                new it.commonera.backend.config.StripeProperties("sk_test_x", "pk_test_x", "whsec_x"));
        assertThrows(ApiException.class,
                () -> real.parseWebhook("{\"type\":\"payment_intent.succeeded\"}", "t=1,v1=deadbeef"));
    }
}

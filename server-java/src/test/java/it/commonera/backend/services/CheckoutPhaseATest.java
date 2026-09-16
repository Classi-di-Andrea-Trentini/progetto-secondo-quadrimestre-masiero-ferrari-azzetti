package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.Payment;
import it.commonera.backend.repositories.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Fase A del checkout: l'ordine nasce **pending** e la merce e' riservata, ma
 * nessuno ha ancora pagato.
 *
 * Fino a ieri `placeOrder` dichiarava l'ordine `paid` senza che un solo euro
 * fosse passato di mano. Questi test descrivono il comportamento giusto: si
 * prenota, si aspetta la conferma del fornitore, e solo allora si assegnano i
 * punti e si svuota il carrello.
 */
class CheckoutPhaseATest extends AbstractIntegrationTest {

    @Autowired CheckoutService checkout;
    @Autowired OrderRepository orders;
    @Autowired PaymentRepository payments;
    @Autowired GiftCardRepository giftCards;
    @Autowired LoyaltyEntryRepository loyalty;
    @Autowired TestFixtures fixtures;

    @PersistenceContext EntityManager em;

    /**
     * La giacenza si muove con un UPDATE atomico, che **non** aggiorna l'entita'
     * gia' in sessione: `findById` restituirebbe il valore di prima, preso dalla
     * cache, e l'asserzione passerebbe anche senza nessuna riserva. Una query
     * scalare legge la colonna davvero scritta.
     */
    private int stockOf(UUID variantId) {
        return em.createQuery("select v.stockQty from ProductVariant v where v.id = :id", Integer.class)
                .setParameter("id", variantId)
                .getSingleResult();
    }

    @Test
    void orderStaysPendingAndStockIsReservedUntilTheProviderConfirms() {
        var buyer = fixtures.aUser();
        var address = fixtures.anAddressFor(buyer);
        var variant = fixtures.aVariantWithStock(5);

        var result = checkout.placeOrder(buyer.getId(), new CheckoutService.Request(
                address.getId(), List.of(new CheckoutService.Line(variant.getId(), 2)),
                "standard", null, null, null, null));

        assertEquals("pending", result.get("status"));
        assertNotNull(result.get("clientSecret"), "il frontend deve poter aprire il pagamento");
        assertEquals(0, new BigDecimal(result.get("amountToPay").toString())
                .compareTo(new BigDecimal("100.00")),
                "50,00 x 2 = 100,00, che raggiunge la soglia della spedizione gratuita");

        var order = orders.findById((UUID) result.get("orderId")).orElseThrow();
        assertEquals(OrderStatus.pending, order.getStatus(),
                "l'ordine non e' pagato finche' il fornitore non conferma");

        assertEquals(3, stockOf(variant.getId()),
                "la merce e' riservata subito: due clienti non comprano lo stesso pezzo mentre pagano");

        var payment = payments.findByOrderId(order.getId()).orElseThrow();
        assertEquals(Payment.PaymentStatus.pending, payment.getStatus());
        assertNotNull(payment.getProviderTxId(), "e' la chiave di idempotenza del webhook");
        assertNull(payment.getPaidAt());
        assertEquals("simulated", payment.getProvider(),
                "senza chiavi l'incasso non e' reale e la riga a database non deve dire il contrario");

        assertEquals(0, loyalty.netPointsForOrder(order.getId()),
                "i punti si assegnano alla conferma, non alla prenotazione");
    }

    @Test
    void anOrderFullyCoveredByAGiftCardSkipsThePaymentEntirely() {
        var buyer = fixtures.aUser();
        var address = fixtures.anAddressFor(buyer);
        var variant = fixtures.aVariantWithStock(5);
        // 50,00 di prodotto + 4,90 di spedizione: il buono copre tutto.
        var card = fixtures.aGiftCardWithBalance(new BigDecimal("54.90"));

        var result = checkout.placeOrder(buyer.getId(), new CheckoutService.Request(
                address.getId(), List.of(new CheckoutService.Line(variant.getId(), 1)),
                "standard", null, card.getCode(), null, null));

        assertEquals("paid", result.get("status"));
        assertNull(result.get("clientSecret"), "non c'e' niente da incassare");
        assertEquals(0, new BigDecimal(result.get("amountToPay").toString()).compareTo(BigDecimal.ZERO));

        var order = orders.findById((UUID) result.get("orderId")).orElseThrow();
        assertEquals(OrderStatus.paid, order.getStatus());
        assertTrue(loyalty.netPointsForOrder(order.getId()) > 0,
                "senza conferma da aspettare, i punti si assegnano subito");

        var payment = payments.findByOrderId(order.getId()).orElseThrow();
        assertEquals(Payment.PaymentStatus.succeeded, payment.getStatus());
        assertEquals(Payment.PaymentMethod.gift_card, payment.getMethod());
        assertNull(payment.getProviderTxId(), "nessun fornitore esterno e' stato coinvolto");
    }

    @Test
    void insufficientStockNeverTouchesTheGiftCard() {
        var buyer = fixtures.aUser();
        var address = fixtures.anAddressFor(buyer);
        var variant = fixtures.aVariantWithStock(1);
        var card = fixtures.aGiftCardWithBalance(new BigDecimal("50.00"));
        var balanceBefore = card.getCurrentBalance();

        assertThrows(RuntimeException.class, () -> checkout.placeOrder(buyer.getId(),
                new CheckoutService.Request(address.getId(),
                        List.of(new CheckoutService.Line(variant.getId(), 5)),
                        "standard", null, card.getCode(), null, null)));

        // La garanzia non e' il rollback ma **l'ordine dei passi**: la merce si
        // riserva prima di toccare il denaro, quindi un buono bruciato per un
        // ordine mai nato non e' nemmeno possibile.
        // Il saldo si muove con un UPDATE atomico, che **non** aggiorna l'entita'
        // gia' in sessione: letto da `findById` sarebbe il valore vecchio in
        // cache, e questa riga passerebbe anche con il buono bruciato. Una query
        // scalare scavalca la cache e legge la colonna davvero scritta.
        var balanceAfter = em.createQuery(
                        "select g.currentBalance from GiftCard g where g.id = :id", BigDecimal.class)
                .setParameter("id", card.getId())
                .getSingleResult();
        assertEquals(0, balanceAfter.compareTo(balanceBefore),
                "un buono bruciato per un ordine mai nato e' il guasto che non si sa piu' ricostruire");
        assertEquals(1, stockOf(variant.getId()));
    }
}

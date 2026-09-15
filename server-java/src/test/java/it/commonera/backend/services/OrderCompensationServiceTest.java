package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.repositories.GiftCardRepository;
import it.commonera.backend.repositories.LoyaltyEntryRepository;
import it.commonera.backend.repositories.ProductVariantRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La compensazione esiste una volta sola, apposta.
 *
 * La chiamano l'annullamento chiesto dal cliente, il webhook del pagamento
 * fallito e il raccoglitore degli ordini abbandonati: tre strade per la stessa
 * identica cosa, e tre copie divergerebbero al primo cambiamento delle formule.
 *
 * Nota sulle letture: giacenza e saldo del buono si muovono con UPDATE
 * condizionali — devono essere atomici, o due compensazioni concorrenti
 * perderebbero una scrittura. Quegli UPDATE scrivono nel database senza
 * aggiornare le entita' gia' in sessione, quindi qui ogni verifica passa da un
 * {@code refresh} mirato. In produzione non serve, perche' la compensazione non
 * rilegge mai cio' che ha appena restituito.
 */
class OrderCompensationServiceTest extends AbstractIntegrationTest {

    @Autowired
    private OrderCompensationService compensation;
    @Autowired
    private ProductVariantRepository variants;
    @Autowired
    private GiftCardRepository giftCards;
    @Autowired
    private LoyaltyEntryRepository loyalty;
    @Autowired
    private TestFixtures fixtures;
    @PersistenceContext
    private EntityManager em;

    private int stockOf(UUID variantId) {
        var variant = variants.findById(variantId).orElseThrow();
        em.refresh(variant);
        return variant.getStockQty();
    }

    private BigDecimal balanceOf(UUID giftCardId) {
        var card = giftCards.findById(giftCardId).orElseThrow();
        em.refresh(card);
        return card.getCurrentBalance();
    }

    @Test
    void restoresStockRefundsTheGiftCardAndReversesThePoints() {
        var done = fixtures.aCheckoutWithGiftCardAndPoints(2, new BigDecimal("30.00"), 500);
        int stockAfterCheckout = stockOf(done.variantId());
        var balanceAfterCheckout = balanceOf(done.giftCardId());
        var spentOnCard = done.order().getGiftCardAmount();

        assertThat(compensation.releaseAndCancel(done.order(), OrderService.CANCELLABLE, null, "Prova"))
                .isTrue();

        assertThat(stockOf(done.variantId()))
                .as("la merce torna a magazzino")
                .isEqualTo(stockAfterCheckout + done.quantity());
        assertThat(balanceOf(done.giftCardId()))
                .as("il buono torna com'era prima dell'ordine")
                .isEqualByComparingTo(balanceAfterCheckout.add(spentOnCard));
        assertThat(loyalty.netPointsForOrder(done.orderId()))
                .as("punti spesi e accreditati per quest'ordine devono sommare a zero")
                .isZero();
        assertThat(done.order().getStatus()).isEqualTo(OrderStatus.cancelled);
    }

    @Test
    void aSecondCompensationOnTheSameOrderRefundsNothing() {
        // Il webhook di fallimento e il raccoglitore possono arrivare insieme: la
        // transizione atomica decide chi vince, e il perdente non tocca niente.
        // Senza quella guardia il buono verrebbe accreditato due volte.
        var done = fixtures.aCheckoutWithGiftCardAndPoints(1, new BigDecimal("30.00"), 0);
        assertThat(compensation.releaseAndCancel(done.order(), OrderService.CANCELLABLE, null, "primo")).isTrue();

        var balanceAfterFirst = balanceOf(done.giftCardId());
        int stockAfterFirst = stockOf(done.variantId());

        assertThat(compensation.releaseAndCancel(done.order(), OrderService.CANCELLABLE, null, "secondo"))
                .as("la seconda compensazione deve dichiararsi inutile")
                .isFalse();

        assertThat(balanceOf(done.giftCardId())).isEqualByComparingTo(balanceAfterFirst);
        assertThat(stockOf(done.variantId())).isEqualTo(stockAfterFirst);
    }

    @Test
    void refusesToCompensateAnOrderThatIsNotInAnAllowedState() {
        // Un ordine gia' spedito non si disfa passando da qui: se lo stato attuale
        // non e' fra quelli ammessi, non si tocca niente.
        var done = fixtures.aCheckoutWithGiftCardAndPoints(1, new BigDecimal("30.00"), 0);
        var balanceBefore = balanceOf(done.giftCardId());
        int stockBefore = stockOf(done.variantId());

        assertThat(compensation.releaseAndCancel(done.order(), List.of(OrderStatus.shipped), null, "fuori stato"))
                .isFalse();

        assertThat(balanceOf(done.giftCardId())).isEqualByComparingTo(balanceBefore);
        assertThat(stockOf(done.variantId())).isEqualTo(stockBefore);
    }
}

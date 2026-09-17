package it.commonera.backend.services;

import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.Payment;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Raccoglie gli ordini rimasti `pending` oltre la finestra di pagamento.
 *
 * Senza, un cliente che chiude il browser sulla schermata della carta tiene la
 * merce riservata **per sempre**, e il negozio si svuota di roba che nessuno ha
 * comprato.
 *
 * Gira da solo, e questo cambia cosa conta: la transizione atomica dentro
 * {@link OrderCompensationService#releaseAndCancel} e' l'unica cosa che lo
 * separa dal rimborsare un ordine che nel frattempo e' stato pagato davvero. Se
 * il webhook arriva mentre il raccoglitore passa, vince chi arriva primo alla
 * riga, e il perdente non tocca niente.
 */
@Service
public class AbandonedOrderReaper {

    private static final Logger log = LoggerFactory.getLogger(AbandonedOrderReaper.class);

    /**
     * Mezz'ora: piu' che sufficiente per inserire una carta, abbastanza poco da
     * non tenere la merce bloccata per chi la sta cercando.
     */
    private static final Duration WINDOW = Duration.ofMinutes(30);

    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final PaymentGateway gateway;
    private final OrderCompensationService compensation;

    public AbandonedOrderReaper(OrderRepository orders, PaymentRepository payments,
                                PaymentGateway gateway, OrderCompensationService compensation) {
        this.orders = orders;
        this.payments = payments;
        this.gateway = gateway;
        this.compensation = compensation;
    }

    @Scheduled(fixedDelay = 5 * 60 * 1000L, initialDelay = 60 * 1000L)
    public void scheduledSweep() {
        int swept = sweep(LocalDateTime.now());
        if (swept > 0) {
            log.info("Ordini abbandonati compensati: {}", swept);
        }
    }

    /**
     * L'istante arriva da fuori: aspettare mezz'ora vera per verificare che
     * funzioni non e' un test.
     *
     * @return quanti ordini sono stati davvero compensati
     */
    @Transactional
    public int sweep(LocalDateTime now) {
        int done = 0;
        for (var order : orders.findStaleByStatus(OrderStatus.pending, now.minus(WINDOW))) {
            // Prima si chiude l'intent, poi si libera: al contrario resterebbe
            // aperta la possibilita' di incassare per un ordine gia' annullato.
            payments.findByOrderId(order.getId())
                    .map(Payment::getProviderTxId)
                    .ifPresent(this::cancelIntentQuietly);

            if (compensation.releaseAndCancel(order, List.of(OrderStatus.pending), null,
                    "Payment not completed in time")) {
                done++;
            }
        }
        return done;
    }

    private void cancelIntentQuietly(String intentId) {
        try {
            gateway.cancelIntent(intentId);
        } catch (RuntimeException e) {
            // Un intent gia' scaduto lato fornitore non deve impedire di
            // restituire la merce qui: sono due cose indipendenti.
            log.warn("Intent {} non annullabile, si prosegue con la compensazione", intentId, e);
        }
    }
}

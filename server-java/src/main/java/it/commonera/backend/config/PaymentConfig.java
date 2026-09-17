package it.commonera.backend.config;

import it.commonera.backend.services.PaymentGateway;
import it.commonera.backend.services.SimulatedPaymentGateway;
import it.commonera.backend.services.StripePaymentGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Sceglie il fornitore di pagamento all'avvio. Manca una chiave? Si parte lo
 * stesso col simulato, ma **scritto nel log**: un negozio che crede di incassare
 * e non incassa e' il modo peggiore di scoprirlo.
 */
@Configuration
public class PaymentConfig {

    private static final Logger log = LoggerFactory.getLogger(PaymentConfig.class);

    @Bean
    PaymentGateway paymentGateway(StripeProperties props) {
        if (!props.enabled()) {
            log.warn("Stripe non configurato: il checkout resta simulato, nessun incasso reale.");
            return new SimulatedPaymentGateway();
        }
        log.info("Stripe configurato: i pagamenti sono reali.");
        return new StripePaymentGateway(props);
    }
}

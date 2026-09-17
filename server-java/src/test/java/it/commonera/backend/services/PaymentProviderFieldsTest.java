package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.repositories.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * La tabella `payments` ha da sempre `provider_tx_id`, `provider_payload` e
 * `refunded_amount`, ma l'entita' ne mappava tre colonne su sette: esistevano nello
 * schema e nessuno le usava. `ddl-auto=validate` non se n'era accorto perche'
 * controlla le colonne **dichiarate**, non il contrario — la stessa scappatoia gia'
 * sfruttata di proposito per `sessions.ip_address`.
 *
 * Sono i campi su cui si regge l'incasso reale: `provider_tx_id` e' UNIQUE, ed e'
 * la chiave di idempotenza del webhook.
 */
class PaymentProviderFieldsTest extends AbstractIntegrationTest {

    @Autowired
    private PaymentRepository payments;
    @Autowired
    private TestFixtures fixtures;

    @Test
    void persistsTheProviderColumnsThatTheEntityUsedToIgnore() {
        var order = fixtures.anOrderPending();
        var payment = fixtures.aPayment(order, "pi_test_" + UUID.randomUUID());
        payment.setProviderPayload("{\"ok\":true}");
        payment.setRefundedAmount(new BigDecimal("0.00"));

        var saved = payments.saveAndFlush(payment);

        assertThat(saved.getProvider()).isEqualTo("stripe");
        assertThat(saved.getProviderTxId()).startsWith("pi_test_");
        assertThat(saved.getProviderPayload()).isEqualTo("{\"ok\":true}");
        assertThat(saved.getRefundedAmount()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void providerTxIdIsUniqueAndIsWhatMakesTheWebhookIdempotent() {
        // Stripe ripete gli eventi: e' documentato, non e' un caso limite. La difesa
        // e' il vincolo di database, non un if applicativo che si puo' dimenticare.
        var order = fixtures.anOrderPending();
        var intent = "pi_test_" + UUID.randomUUID();
        payments.saveAndFlush(fixtures.aPayment(order, intent));

        assertThatThrownBy(() -> payments.saveAndFlush(fixtures.aPayment(order, intent)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}

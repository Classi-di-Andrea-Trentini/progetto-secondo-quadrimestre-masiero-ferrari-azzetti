package it.commonera.backend.repositories;

import it.commonera.backend.entities.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    List<Payment> findByOrderIdOrderByCreatedAtDesc(UUID orderId);

    /**
     * Il pagamento di un ordine. E' al singolare perche' il checkout ne scrive
     * uno solo per ordine: i tentativi ripetuti riusano la stessa riga, che ha
     * `provider_tx_id` UNIQUE.
     */
    Optional<Payment> findByOrderId(UUID orderId);
}

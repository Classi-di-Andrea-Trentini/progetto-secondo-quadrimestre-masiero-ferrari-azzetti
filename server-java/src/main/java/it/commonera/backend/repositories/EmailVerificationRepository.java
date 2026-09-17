package it.commonera.backend.repositories;

import it.commonera.backend.entities.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, UUID> {

    Optional<EmailVerification> findByToken(String token);

    /** Una richiesta nuova annulla la precedente: due link validi insieme non servono. */
    void deleteByUserId(UUID userId);
}

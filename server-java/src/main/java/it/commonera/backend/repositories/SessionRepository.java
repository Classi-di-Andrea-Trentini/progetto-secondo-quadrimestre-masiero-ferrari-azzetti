package it.commonera.backend.repositories;

import it.commonera.backend.entities.Session;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {
    Optional<Session> findByTokenHash(String tokenHash);
    void deleteByTokenHash(String tokenHash);

    /** Cambio password: le altre sessioni cadono, quella da cui si sta operando resta. */
    void deleteByUserIdAndIdNot(UUID userId, UUID sessionId);

    /** Reimpostazione password da link: cadono tutte, compresa quella di chi ha rubato l'account. */
    void deleteByUserId(UUID userId);
}

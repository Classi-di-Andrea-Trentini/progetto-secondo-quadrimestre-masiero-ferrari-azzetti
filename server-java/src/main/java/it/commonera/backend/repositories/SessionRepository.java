package it.commonera.backend.repositories;

import it.commonera.backend.entities.Session;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {
    Optional<Session> findByTokenHash(String tokenHash);
    void deleteByTokenHash(String tokenHash);
}

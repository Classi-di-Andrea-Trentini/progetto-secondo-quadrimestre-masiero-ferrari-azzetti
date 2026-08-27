package it.commonera.backend.repositories;

import it.commonera.backend.entities.PasswordReset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, UUID> {

    Optional<PasswordReset> findByTokenHashAndUsedAtIsNull(String tokenHash);

    void deleteByUserId(UUID userId);
}

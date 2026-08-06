package it.commonera.backend.repositories;

import it.commonera.backend.entities.UserAddress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserAddressRepository extends JpaRepository<UserAddress, UUID> {
    List<UserAddress> findByUserIdOrderByIsDefaultDescCreatedAtAsc(UUID userId);
    Optional<UserAddress> findByIdAndUserId(UUID id, UUID userId);

    /** Azzera il flag su tutti: un utente puo' avere un solo indirizzo predefinito. */
    @Modifying
    @Query("update UserAddress a set a.isDefault = false where a.userId = :userId")
    void clearDefault(@Param("userId") UUID userId);
}

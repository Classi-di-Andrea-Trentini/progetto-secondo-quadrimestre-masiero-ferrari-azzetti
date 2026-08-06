package it.commonera.backend.repositories;

import it.commonera.backend.entities.LoyaltyEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface LoyaltyEntryRepository extends JpaRepository<LoyaltyEntry, UUID> {

    /** Il saldo si somma, non si legge da un contatore che potrebbe essersi scollato. */
    @Query("select coalesce(sum(e.points), 0) from LoyaltyEntry e where e.userId = :userId")
    int balanceOf(@Param("userId") UUID userId);

    List<LoyaltyEntry> findTop50ByUserIdOrderByCreatedAtDesc(UUID userId);
}

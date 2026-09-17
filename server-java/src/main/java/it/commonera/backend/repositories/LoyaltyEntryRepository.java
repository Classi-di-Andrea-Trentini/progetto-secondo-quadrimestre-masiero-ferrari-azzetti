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

    /** Somma dei movimenti gia' scritti per un ordine: accredito e/o spesa punti insieme. */
    @Query("select coalesce(sum(e.points), 0) from LoyaltyEntry e where e.orderId = :orderId")
    int netPointsForOrder(@Param("orderId") UUID orderId);

    List<LoyaltyEntry> findTop50ByUserIdOrderByCreatedAtDesc(UUID userId);

    /** Senza il tetto di 50: l'export li deve contenere tutti. */
    List<LoyaltyEntry> findByUserIdOrderByCreatedAtDesc(UUID userId);

    void deleteByUserId(UUID userId);
}

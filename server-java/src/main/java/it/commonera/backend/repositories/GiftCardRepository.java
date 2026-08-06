package it.commonera.backend.repositories;

import it.commonera.backend.entities.GiftCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

public interface GiftCardRepository extends JpaRepository<GiftCard, UUID> {
    Optional<GiftCard> findByCodeIgnoreCase(String code);

    /**
     * Scalo **condizionale** sul saldo: due checkout con lo stesso codice
     * leggerebbero lo stesso importo e lo spenderebbero due volte. Se qui non
     * viene toccata nessuna riga, qualcun altro e' arrivato prima.
     */
    @Modifying
    @Query("update GiftCard g set g.currentBalance = g.currentBalance - :amount " +
           "where g.id = :id and g.currentBalance >= :amount")
    int redeem(@Param("id") UUID id, @Param("amount") BigDecimal amount);
}

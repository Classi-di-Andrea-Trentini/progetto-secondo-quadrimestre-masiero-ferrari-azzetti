package it.commonera.backend.repositories;

import it.commonera.backend.entities.StockAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StockAlertRepository extends JpaRepository<StockAlert, UUID> {
    List<StockAlert> findByVariantIdAndNotifiedAtIsNull(UUID variantId);
    List<StockAlert> findByUserIdAndNotifiedAtIsNull(UUID userId);
    Optional<StockAlert> findByUserIdAndVariantId(UUID userId, UUID variantId);

    /** Cancellazione dell'account: nessun avviso va mandato a un indirizzo che non c'e' piu'. */
    void deleteByUserId(UUID userId);
}

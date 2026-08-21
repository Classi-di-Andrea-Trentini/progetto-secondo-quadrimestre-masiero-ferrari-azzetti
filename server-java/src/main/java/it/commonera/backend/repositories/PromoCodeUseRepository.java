package it.commonera.backend.repositories;

import it.commonera.backend.entities.PromoCodeUse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PromoCodeUseRepository extends JpaRepository<PromoCodeUse, UUID> {
    long countByPromoCodeIdAndUserId(UUID promoCodeId, UUID userId);
    long countByPromoCodeId(UUID promoCodeId);
}

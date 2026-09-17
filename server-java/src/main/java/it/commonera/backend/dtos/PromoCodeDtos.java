package it.commonera.backend.dtos;

import it.commonera.backend.entities.PromoCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Stessi nomi di campo del backend Node (`discountType`/`discountValue`, non
 * `type`/`value` come nell'entita'): e' la forma che il frontend Angular gia'
 * consuma (`AdminPromoCode`, `CreatePromoCodePayload` in `admin.service.ts`).
 */
public class PromoCodeDtos {

    public record View(
            UUID id, String code, PromoCode.DiscountType discountType, BigDecimal discountValue,
            String description, BigDecimal minOrderAmount, Integer maxUses, Integer maxUsesPerUser,
            long currentUses, LocalDateTime startsAt, LocalDateTime expiresAt, Boolean isActive,
            LocalDateTime createdAt, Count _count) {

        public static View from(PromoCode p, long usesCount) {
            return new View(p.getId(), p.getCode(), p.getType(), p.getValue(), p.getDescription(),
                    p.getMinOrderAmount(), p.getMaxUses(), p.getMaxUsesPerUser(), p.getCurrentUses(),
                    p.getStartsAt(), p.getExpiresAt(), p.getIsActive(), p.getCreatedAt(), new Count(usesCount));
        }
    }

    public record Count(long uses) {}

    public record CreateRequest(
            String code, PromoCode.DiscountType discountType, BigDecimal discountValue,
            String description, BigDecimal minOrderAmount, Integer maxUses, Integer maxUsesPerUser,
            BigDecimal maxDiscountCap, LocalDateTime startsAt, LocalDateTime expiresAt, Boolean isActive) {}

    public record UpdateRequest(Boolean isActive, Integer maxUses, LocalDateTime expiresAt) {}

    public record ValidateRequest(String code, BigDecimal orderAmount) {}
}

package it.commonera.backend.services;

import it.commonera.backend.dtos.PromoCodeDtos;
import it.commonera.backend.entities.PromoCode;
import it.commonera.backend.entities.PromoCodeUse;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.PromoCodeRepository;
import it.commonera.backend.repositories.PromoCodeUseRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Codici promozionali.
 *
 * `appliesToCategory`/`appliesToProduct` sono salvati e amministrabili ma **non
 * sono applicati in {@link #validate}**: e' lo stesso limite del backend Node
 * (`PromoCodesService.validate` li ignora), portato qui invariato invece di
 * inventare un comportamento nuovo che i due backend non condividerebbero.
 * Farli valere davvero richiederebbe passare la composizione del carrello (non
 * solo il totale) al checkout, che e' un cambio di forma del flusso e non un
 * porting — resta un lavoro a parte, dichiarato apposta invece che nascosto.
 */
@Service
public class PromoCodeService {

    private final PromoCodeRepository codes;
    private final PromoCodeUseRepository uses;

    public PromoCodeService(PromoCodeRepository codes, PromoCodeUseRepository uses) {
        this.codes = codes;
        this.uses = uses;
    }

    /** Verifica un codice per il checkout, senza consumarlo: la registrazione dell'uso avviene solo a ordine confermato. */
    @Transactional(readOnly = true)
    public Result validate(String rawCode, BigDecimal orderAmount, UUID userId) {
        if (rawCode == null || rawCode.isBlank()) throw ApiException.badRequest("Invalid or expired promo code");
        var promo = codes.findByCodeIgnoreCase(rawCode.trim())
                .orElseThrow(() -> ApiException.badRequest("Invalid or expired promo code"));

        if (!Boolean.TRUE.equals(promo.getIsActive())) throw ApiException.badRequest("Invalid or expired promo code");

        var now = LocalDateTime.now();
        if (promo.getStartsAt() != null && promo.getStartsAt().isAfter(now)) {
            throw ApiException.badRequest("Promo code not yet active");
        }
        if (promo.getExpiresAt() != null && promo.getExpiresAt().isBefore(now)) {
            throw ApiException.badRequest("Promo code has expired");
        }
        if (promo.getMaxUses() != null && promo.getCurrentUses() >= promo.getMaxUses()) {
            throw ApiException.badRequest("Promo code usage limit reached");
        }

        BigDecimal minAmount = promo.getMinOrderAmount() == null ? BigDecimal.ZERO : promo.getMinOrderAmount();
        if (orderAmount.compareTo(minAmount) < 0) {
            throw ApiException.badRequest("Minimum order amount for this code is €" + minAmount.setScale(2, RoundingMode.HALF_UP));
        }

        if (promo.getMaxUsesPerUser() != null) {
            long userUses = uses.countByPromoCodeIdAndUserId(promo.getId(), userId);
            if (userUses >= promo.getMaxUsesPerUser()) {
                throw ApiException.badRequest("You have already used this promo code");
            }
        }

        BigDecimal discount = promo.getType() == PromoCode.DiscountType.percentage
                ? orderAmount.multiply(promo.getValue()).divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP)
                : promo.getValue();

        if (promo.getMaxDiscountCap() != null) discount = discount.min(promo.getMaxDiscountCap());
        discount = discount.min(orderAmount).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);

        return new Result(promo.getId(), promo.getCode(), discount, promo.getDescription());
    }

    /** Registra l'uso e incrementa il contatore: chiamato **dopo** che l'ordine e' stato creato davvero. */
    @Transactional
    public void recordUse(UUID promoCodeId, UUID userId, UUID orderId, BigDecimal discountValue) {
        var use = new PromoCodeUse();
        use.setPromoCodeId(promoCodeId);
        use.setUserId(userId);
        use.setOrderId(orderId);
        use.setDiscountValue(discountValue);
        uses.save(use);

        var promo = codes.findById(promoCodeId).orElseThrow(() -> ApiException.notFound("Promo code not found"));
        promo.setCurrentUses(promo.getCurrentUses() + 1);
        codes.save(promo);
    }

    // ─── Amministrazione ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> adminList(Boolean isActive, PromoCode.DiscountType type, String search, int page, int limit) {
        int capped = Math.min(Math.max(limit, 1), 100);
        var result = codes.findAll(specification(isActive, type, search),
                PageRequest.of(Math.max(0, page - 1), capped, Sort.by("createdAt").descending()));

        var views = result.getContent().stream()
                .map(p -> PromoCodeDtos.View.from(p, countUses(p.getId())))
                .toList();

        return Map.of(
                "data", views,
                "meta", Map.of(
                        "total", result.getTotalElements(),
                        "page", result.getNumber() + 1,
                        "limit", capped,
                        "totalPages", result.getTotalPages()));
    }

    private long countUses(UUID promoCodeId) {
        return uses.countByPromoCodeId(promoCodeId);
    }

    @Transactional
    public PromoCodeDtos.View create(PromoCodeDtos.CreateRequest dto) {
        String code = dto.code().trim().toUpperCase();
        if (codes.existsByCodeIgnoreCase(code)) throw ApiException.badRequest("Codice già esistente");

        var promo = new PromoCode();
        promo.setCode(code);
        promo.setType(dto.discountType());
        promo.setValue(dto.discountValue());
        promo.setDescription(dto.description());
        promo.setMinOrderAmount(dto.minOrderAmount());
        promo.setMaxUses(dto.maxUses());
        promo.setMaxUsesPerUser(dto.maxUsesPerUser());
        promo.setMaxDiscountCap(dto.maxDiscountCap());
        promo.setExpiresAt(dto.expiresAt());
        promo.setStartsAt(dto.startsAt());
        promo.setIsActive(dto.isActive() == null || dto.isActive());
        var saved = codes.save(promo);
        return PromoCodeDtos.View.from(saved, 0);
    }

    @Transactional
    public PromoCodeDtos.View update(UUID id, PromoCodeDtos.UpdateRequest dto) {
        var promo = codes.findById(id).orElseThrow(() -> ApiException.notFound("Codice promozionale non trovato"));
        if (dto.isActive() != null) promo.setIsActive(dto.isActive());
        if (dto.maxUses() != null) promo.setMaxUses(dto.maxUses());
        if (dto.expiresAt() != null) promo.setExpiresAt(dto.expiresAt());
        var saved = codes.save(promo);
        return PromoCodeDtos.View.from(saved, countUses(saved.getId()));
    }

    @Transactional
    public Map<String, String> delete(UUID id) {
        var promo = codes.findById(id).orElseThrow(() -> ApiException.notFound("Codice promozionale non trovato"));
        codes.delete(promo);
        return Map.of("message", "Codice eliminato");
    }

    private Specification<PromoCode> specification(Boolean isActive, PromoCode.DiscountType type, String search) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (isActive != null) predicates.add(cb.equal(root.get("isActive"), isActive));
            if (type != null) predicates.add(cb.equal(root.get("type"), type));
            if (search != null && !search.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("code")), "%" + search.toLowerCase() + "%"));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    public record Result(UUID promoCodeId, String code, BigDecimal discountValue, String description) {}
}

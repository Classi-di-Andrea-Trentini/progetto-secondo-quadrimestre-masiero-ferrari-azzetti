package it.commonera.backend.services;

import it.commonera.backend.entities.Discount;
import it.commonera.backend.entities.ProductVariant;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Prezzo di una variante, sconti applicati.
 *
 * Sta in un servizio solo perche' lo usano sia il carrello sia il checkout: nel
 * backend Node la stessa formula era scritta due volte, e due copie della stessa
 * formula prima o poi divergono — a quel punto il totale mostrato nel carrello non
 * combacia piu' con quello addebitato, e te ne accorgi da un cliente arrabbiato.
 *
 * `BigDecimal` e non `double`: sui soldi l'aritmetica in virgola mobile perde
 * centesimi, e qui i centesimi sono il punto.
 */
@Service
public class PricingService {

    public Price of(ProductVariant variant) {
        BigDecimal listPrice = Optional.ofNullable(variant.getPriceOverride())
                .orElseGet(() -> variant.getProduct().getBasePrice());

        Optional<Discount> active = variant.getProduct().getDiscounts().stream()
                .filter(this::isActive)
                .findFirst();

        if (active.isEmpty()) {
            return new Price(round(listPrice), round(listPrice), null);
        }

        Discount discount = active.get();
        BigDecimal discounted = discount.getType() == Discount.DiscountType.percentage
                ? listPrice.multiply(BigDecimal.ONE.subtract(discount.getValue().movePointLeft(2)))
                : listPrice.subtract(discount.getValue());

        // Uno sconto fisso maggiore del prezzo non puo' far pagare un importo negativo.
        if (discounted.signum() < 0) discounted = BigDecimal.ZERO;

        return new Price(round(listPrice), round(discounted), discount.getLabel());
    }

    private boolean isActive(Discount discount) {
        if (!Boolean.TRUE.equals(discount.getIsActive())) return false;
        LocalDateTime now = LocalDateTime.now();
        if (discount.getStartsAt() != null && discount.getStartsAt().isAfter(now)) return false;
        return discount.getEndsAt() == null || !discount.getEndsAt().isBefore(now);
    }

    private BigDecimal round(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    public record Price(BigDecimal original, BigDecimal unit, String discountLabel) {
        public BigDecimal lineTotal(int quantity) {
            return unit.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
        }
    }
}

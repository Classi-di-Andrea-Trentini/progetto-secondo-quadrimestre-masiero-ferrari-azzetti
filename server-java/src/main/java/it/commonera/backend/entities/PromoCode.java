package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "promo_codes")
@Getter
@Setter
public class PromoCode {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    /** Stesso enum Postgres `"DiscountType"` usato da {@link Discount}. */
    @Column(nullable = false, columnDefinition = "\"DiscountType\"")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    private DiscountType type;

    @Column(nullable = false)
    private BigDecimal value;

    private String description;

    @Column(name = "max_uses")
    private Integer maxUses;

    @Column(name = "max_uses_per_user")
    private Integer maxUsesPerUser;

    @Column(name = "current_uses", nullable = false)
    private Integer currentUses = 0;

    @Column(name = "min_order_amount")
    private BigDecimal minOrderAmount;

    @Column(name = "max_discount_cap")
    private BigDecimal maxDiscountCap;

    /**
     * Riferimenti sciolti (plain UUID, non relazione JPA), come `Order.promoCodeId`:
     * qui non servono per la validazione al checkout (vedi {@code PromoCodeService}),
     * solo per l'amministrazione del codice.
     */
    @Column(name = "applies_to_category", columnDefinition = "uuid")
    private UUID appliesToCategory;

    @Column(name = "applies_to_product", columnDefinition = "uuid")
    private UUID appliesToProduct;

    @Column(name = "starts_at")
    private LocalDateTime startsAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_by", columnDefinition = "uuid")
    private UUID createdBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum DiscountType {
        percentage,
        fixed_amount
    }
}

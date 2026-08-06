package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "discounts")
@Getter
@Setter
public class Discount {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    /**
     * `percentage` oppure `fixed_amount`. E' un enum Postgres creato dal SQL:
     * si legge come stringa per non doverlo ridichiarare qui e rischiare che i
     * due backend divergano sui valori ammessi.
     */
    @Column(nullable = false, columnDefinition = "discount_type")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    private DiscountType type;

    @Column(nullable = false)
    private BigDecimal value;

    private String label;

    @Column(name = "starts_at")
    private LocalDateTime startsAt;

    @Column(name = "ends_at")
    private LocalDateTime endsAt;

    @Column(name = "is_active")
    private Boolean isActive = true;

    public enum DiscountType {
        percentage,
        fixed_amount
    }
}

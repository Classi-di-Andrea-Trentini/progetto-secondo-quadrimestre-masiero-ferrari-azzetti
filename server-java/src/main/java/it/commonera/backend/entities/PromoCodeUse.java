package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "promo_code_uses")
@Getter
@Setter
public class PromoCodeUse {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "promo_code_id", nullable = false, columnDefinition = "uuid")
    private UUID promoCodeId;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "order_id", nullable = false, columnDefinition = "uuid")
    private UUID orderId;

    @Column(name = "discount_value", nullable = false)
    private BigDecimal discountValue;

    @Column(name = "used_at", insertable = false, updatable = false)
    private LocalDateTime usedAt;
}

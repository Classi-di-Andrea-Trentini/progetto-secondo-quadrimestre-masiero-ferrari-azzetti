package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Reso. Il nome della classe evita `Return` per non confondersi con la parola
 * riservata Java (che e' `return` minuscolo e non c'entrerebbe comunque, ma
 * `OrderReturn` resta piu' leggibile), la tabella e' comunque `returns`.
 */
@Entity
@Table(name = "returns")
@Getter
@Setter
public class OrderReturn {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "order_id", nullable = false, columnDefinition = "uuid")
    private UUID orderId;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(nullable = false, columnDefinition = "\"ReturnStatus\"")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    private ReturnStatus status = ReturnStatus.requested;

    @Column(nullable = false)
    private String reason;

    @Column(name = "admin_note")
    private String adminNote;

    @Column(name = "refund_amount")
    private BigDecimal refundAmount;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "orderReturn", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ReturnItem> items = new ArrayList<>();

    public enum ReturnStatus {
        requested,
        approved,
        rejected,
        received,
        refunded
    }
}

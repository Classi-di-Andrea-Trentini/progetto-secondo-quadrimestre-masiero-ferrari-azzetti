package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/** Movimento di punti. Il saldo e' la somma di questi, non un contatore a parte. */
@Entity
@Table(name = "loyalty_entries")
@Getter
@Setter
public class LoyaltyEntry {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "order_id", columnDefinition = "uuid")
    private UUID orderId;

    @Column(nullable = false)
    private Integer points;

    @Column(nullable = false)
    private String reason;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}

package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "gift_card_transactions")
@Getter
@Setter
public class GiftCardTransaction {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "gift_card_id", nullable = false, columnDefinition = "uuid")
    private UUID giftCardId;

    @Column(name = "order_id", columnDefinition = "uuid")
    private UUID orderId;

    /** Negativo quando si spende, positivo alla ricarica: il segno distingue i due. */
    @Column(nullable = false)
    private BigDecimal amount;

    @Column(name = "balance_after", nullable = false)
    private BigDecimal balanceAfter;

    private String note;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}

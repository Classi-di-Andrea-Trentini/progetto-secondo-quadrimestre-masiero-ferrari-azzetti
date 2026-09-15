package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "payments")
@Getter
@Setter
public class Payment {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "order_id", nullable = false, columnDefinition = "uuid")
    private UUID orderId;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(nullable = false, columnDefinition = "\"PaymentStatus\"")
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    private PaymentStatus status = PaymentStatus.pending;

    @Column(nullable = false, columnDefinition = "\"PaymentMethod\"")
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    private PaymentMethod method;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private String currency = "EUR";

    private String provider;

    /**
     * Identificativo della transazione presso il fornitore (il PaymentIntent, con
     * Stripe). La colonna e' **UNIQUE**: e' la chiave di idempotenza del webhook,
     * che il fornitore puo' consegnare piu' di una volta per lo stesso pagamento.
     */
    @Column(name = "provider_tx_id")
    private String providerTxId;

    /**
     * L'evento grezzo del fornitore, cosi' com'e' arrivato. Serve a ricostruire
     * cos'e' successo mesi dopo, quando il cliente contesta un addebito e la nostra
     * riga riassuntiva non basta piu'.
     */
    @Column(name = "provider_payload", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String providerPayload;

    /** Quanto e' gia' stato restituito: un reso parziale non azzera l'incasso. */
    @Column(name = "refunded_amount")
    private BigDecimal refundedAmount;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "failed_reason")
    private String failedReason;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum PaymentStatus { pending, processing, succeeded, failed, refunded, partially_refunded }

    public enum PaymentMethod { credit_card, paypal, bank_transfer, cash_on_delivery, gift_card }
}

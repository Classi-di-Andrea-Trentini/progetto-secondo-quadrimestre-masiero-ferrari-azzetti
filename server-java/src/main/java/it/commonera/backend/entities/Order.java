package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Getter
@Setter
public class Order {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "address_id", columnDefinition = "uuid")
    private UUID addressId;

    /** Enum Postgres, non varchar: va dichiarato o ogni scrittura fallisce. */
    @Column(nullable = false, columnDefinition = "\"OrderStatus\"")
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    private OrderStatus status = OrderStatus.pending;

    @Column(nullable = false)
    private BigDecimal subtotal;

    @Column(name = "discount_total", nullable = false)
    private BigDecimal discountTotal = BigDecimal.ZERO;

    @Column(name = "shipping_cost", nullable = false)
    private BigDecimal shippingCost = BigDecimal.ZERO;

    @Column(name = "tax_amount")
    private BigDecimal taxAmount;

    @Column(nullable = false)
    private BigDecimal total;

    @Column(name = "promo_code_id", columnDefinition = "uuid")
    private UUID promoCodeId;

    @Column(name = "gift_card_id", columnDefinition = "uuid")
    private UUID giftCardId;

    @Column(name = "gift_card_amount")
    private BigDecimal giftCardAmount;

    @Column(name = "shipping_method")
    private String shippingMethod;

    @Column(name = "tracking_number")
    private String trackingNumber;

    @Column(name = "tracking_url")
    private String trackingUrl;

    private String notes;

    /** Assegnato alla prima richiesta della fattura, poi non cambia piu'. */
    @Column(name = "invoice_number", unique = true)
    private String invoiceNumber;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @OrderBy("createdAt ASC")
    private List<OrderStatusHistory> statusHistory = new ArrayList<>();
}

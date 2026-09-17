package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Riga d'ordine.
 *
 * Nome, etichetta variante e SKU sono **copiati** al momento dell'acquisto, non
 * letti dal prodotto: se domani il prodotto viene rinominato o cancellato, la
 * fattura di ieri deve continuare a dire cosa e' stato comprato.
 */
@Entity
@Table(name = "order_items")
@Getter
@Setter
public class OrderItem {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "variant_id", nullable = false, columnDefinition = "uuid")
    private UUID variantId;

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(name = "variant_label")
    private String variantLabel;

    @Column(name = "sku_snapshot")
    private String skuSnapshot;

    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "discount_applied")
    private BigDecimal discountApplied = BigDecimal.ZERO;

    @Column(name = "line_total", nullable = false)
    private BigDecimal lineTotal;
}

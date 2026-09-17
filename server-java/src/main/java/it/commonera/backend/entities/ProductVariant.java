package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "product_variants")
@Getter
@Setter
public class ProductVariant {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, unique = true)
    private String sku;

    private String size;
    private String color;

    @Column(name = "color_hex")
    private String colorHex;

    private String material;

    /** Se valorizzato vince sul prezzo base del prodotto. */
    @Column(name = "price_override")
    private BigDecimal priceOverride;

    @Column(name = "stock_qty", nullable = false)
    private Integer stockQty = 0;

    /** Soglia di riordino. Nel backend Node era rimasta inutilizzata per mesi. */
    @Column(name = "low_stock_alert")
    private Integer lowStockAlert;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Etichetta leggibile: "Nero / M". */
    public String label() {
        if (color != null && size != null) return color + " / " + size;
        return color != null ? color : (size != null ? size : null);
    }
}

package it.commonera.backend.dtos;

import it.commonera.backend.entities.Product;
import it.commonera.backend.entities.ProductVariant;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Forma delle risposte del catalogo, uguale a quella del backend Node: il frontend
 * legge `data` e `meta`, e le varianti con `stockQty` e `priceOverride`.
 */
public class ProductDtos {

    public record VariantView(
            UUID id, String sku, String size, String color, String colorHex,
            BigDecimal priceOverride, Integer stockQty) {

        static VariantView from(ProductVariant v) {
            return new VariantView(v.getId(), v.getSku(), v.getSize(), v.getColor(),
                    v.getColorHex(), v.getPriceOverride(), v.getStockQty());
        }
    }

    public record ImageView(String url, String altText, Boolean isCover) {}

    public record DiscountView(String type, BigDecimal value, String label) {}

    public record CategoryView(UUID id, String name, String slug) {}

    public record ProductView(
            UUID id, String name, String slug, String description, String shortDesc,
            String brand, BigDecimal basePrice, BigDecimal avgRating, Integer soldCount,
            CategoryView category, List<ImageView> images,
            List<VariantView> variants, List<DiscountView> discounts) {

        public static ProductView from(Product p) {
            return new ProductView(
                    p.getId(), p.getName(), p.getSlug(), p.getDescription(), p.getShortDesc(),
                    p.getBrand(), p.getBasePrice(), p.getAvgRating(), p.getSoldCount(),
                    new CategoryView(p.getCategory().getId(), p.getCategory().getName(), p.getCategory().getSlug()),
                    p.getImages().stream()
                            .map(i -> new ImageView(i.getUrl(), i.getAltText(), i.getIsCover()))
                            .toList(),
                    p.getVariants().stream()
                            .filter(v -> Boolean.TRUE.equals(v.getIsActive()))
                            .map(VariantView::from)
                            .toList(),
                    p.getDiscounts().stream()
                            .filter(d -> Boolean.TRUE.equals(d.getIsActive()))
                            .map(d -> new DiscountView(d.getType().name(), d.getValue(), d.getLabel()))
                            .toList());
        }
    }
}

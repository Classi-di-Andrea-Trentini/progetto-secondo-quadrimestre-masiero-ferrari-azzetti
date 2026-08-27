package it.commonera.backend.dtos;

import java.math.BigDecimal;
import java.util.UUID;

/** Corpi delle richieste dell'area amministrativa non gia' coperte da altri dtos. */
public class AdminDtos {

    public record CreateProductRequest(
            String name, String slug, String description, String shortDesc, String brand,
            UUID categoryId, BigDecimal basePrice, Boolean isActive,
            Boolean isFeatured, Boolean isNewArrival) {}

    public record UpdateProductRequest(
            String name, String description, String shortDesc, String brand,
            UUID categoryId, BigDecimal basePrice, Boolean isActive,
            Boolean isFeatured, Boolean isNewArrival) {}

    /** Categoria creata dall'admin: il negozio non e' obbligato a restare dentro quelle del seed. */
    public record CreateCategoryRequest(String name, String slug, String description, UUID parentId) {}

    public record CreateVariantRequest(
            String sku, String size, String color, String colorHex, String material,
            BigDecimal priceOverride, Integer stockQty, Boolean isActive) {}

    public record UpdateVariantRequest(
            String sku, String size, String color, String colorHex, String material,
            BigDecimal priceOverride, Integer stockQty, Boolean isActive) {}

    public record CreateImageRequest(String url, String altText, Integer sortOrder, Boolean isCover) {}

    public record UpdateUserRoleRequest(String role) {}
}

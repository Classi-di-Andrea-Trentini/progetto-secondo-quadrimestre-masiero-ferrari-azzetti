package it.commonera.backend.controllers;

import it.commonera.backend.services.ProductService;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/products")
public class ProductsController {

    private final ProductService products;

    public ProductsController(ProductService products) {
        this.products = products;
    }

    @GetMapping
    public Map<String, Object> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) List<String> colors,
            @RequestParam(required = false) List<String> sizes,
            @RequestParam(required = false) String sortBy,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "24") int limit) {

        // Tetto al numero di righe: senza, `?limit=100000` diventa un modo gratuito
        // per mettere in ginocchio il database.
        int capped = Math.min(Math.max(limit, 1), 100);

        var result = products.findAllAsView(
                new ProductService.Filters(search, categoryId, brand, minPrice, maxPrice, colors, sizes, sortBy),
                page, capped);

        return Map.of("data", result.getContent(), "meta", ProductService.meta(result, capped));
    }

    @GetMapping("/{slug}")
    public Map<String, Object> bySlug(@PathVariable String slug) {
        return products.findBySlugAsView(slug);
    }
}

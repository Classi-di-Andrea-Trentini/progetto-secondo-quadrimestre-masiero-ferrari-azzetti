package it.commonera.backend.controllers;

import it.commonera.backend.dtos.ProductDtos;
import it.commonera.backend.services.ProductService;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
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

    /**
     * Valori possibili dei filtri del catalogo.
     *
     * Sta **prima** di `/{slug}` per leggibilita', ma non e' l'ordine a salvarlo:
     * Spring preferisce comunque il percorso letterale alla variabile. Finche' questo
     * endpoint non esisteva, `/products/filters` finiva su `bySlug("filters")` e la
     * barra dei filtri restava vuota per un 404.
     */
    @GetMapping("/filters")
    public Map<String, Object> filters() {
        return products.filters();
    }

    /** Prodotti per id, nell'ordine chiesto: i "visti di recente" del browser. */
    @GetMapping("/by-ids")
    public List<ProductDtos.ProductView> byIds(@RequestParam(required = false) String ids) {
        if (ids == null || ids.isBlank()) return List.of();

        List<UUID> parsed = new ArrayList<>();
        for (String raw : ids.split(",")) {
            String candidate = raw.trim();
            if (candidate.isEmpty()) continue;
            try {
                parsed.add(UUID.fromString(candidate));
            } catch (IllegalArgumentException ignored) {
                // La lista arriva dal localStorage del browser: un id storto e' roba
                // vecchia o modificata a mano, non un motivo per rispondere 400.
            }
        }
        return products.findByIdsAsView(parsed);
    }

    @GetMapping("/{slug}")
    public Map<String, Object> bySlug(@PathVariable String slug) {
        return products.findBySlugAsView(slug);
    }
}

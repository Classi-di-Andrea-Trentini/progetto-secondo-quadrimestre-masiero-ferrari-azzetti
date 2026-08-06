package it.commonera.backend.services;

import it.commonera.backend.entities.Product;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.ProductRepository;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import it.commonera.backend.dtos.ProductDtos;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Lettura del catalogo.
 *
 * La ricerca testuale e' collegata **davvero** alla query. Nel backend Node il
 * parametro veniva letto e poi mai usato, e la barra di ricerca restituiva l'intero
 * catalogo per qualunque parola: qui e' un pezzo della `Specification`, quindi non
 * puo' restare scollegato senza che qualcosa smetta di compilare.
 */
@Service
public class ProductService {

    private final ProductRepository products;

    public ProductService(ProductRepository products) {
        this.products = products;
    }

    /**
     * La conversione in DTO avviene **dentro** la transazione.
     *
     * Con `open-in-view=false` — che e' la scelta giusta: tenere aperta una sessione
     * per tutta la richiesta nasconde le query lente dentro la resa della vista — le
     * associazioni lazy non si possono piu' toccare nel controller. Mappare qui e'
     * l'alternativa onesta: quello che serve viene caricato mentre la sessione c'e'
     * ancora, e cosa costa quella pagina resta scritto in un punto solo.
     */
    @Transactional(readOnly = true)
    public Page<ProductDtos.ProductView> findAllAsView(Filters filters, int page, int limit) {
        return findAll(filters, page, limit).map(ProductDtos.ProductView::from);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> findBySlugAsView(String slug) {
        var product = findBySlug(slug);
        return Map.of(
                "product", ProductDtos.ProductView.from(product),
                "related", related(product, 4).stream().map(ProductDtos.ProductView::from).toList());
    }

    public Page<Product> findAll(Filters filters, int page, int limit) {
        Sort sort = switch (filters.sortBy() == null ? "newest" : filters.sortBy()) {
            case "price_asc" -> Sort.by("basePrice").ascending();
            case "price_desc" -> Sort.by("basePrice").descending();
            case "popular" -> Sort.by("soldCount").descending();
            case "rating" -> Sort.by("avgRating").descending();
            default -> Sort.by("createdAt").descending();
        };

        return products.findAll(specification(filters), PageRequest.of(Math.max(0, page - 1), limit, sort));
    }

    public Product findBySlug(String slug) {
        return products.findBySlugAndDeletedAtIsNull(slug)
                .orElseThrow(() -> ApiException.notFound("Product not found!"));
    }

    /** Prodotti della stessa categoria, i piu' venduti per primi. */
    public List<Product> related(Product product, int limit) {
        var filters = new Filters(null, product.getCategory().getId(), null, null, null, null, null, "popular");
        return products.findAll(specification(filters), PageRequest.of(0, limit + 1, Sort.by("soldCount").descending()))
                .stream()
                .filter(other -> !other.getId().equals(product.getId()))
                .limit(limit)
                .toList();
    }

    private Specification<Product> specification(Filters f) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isTrue(root.get("isActive")));
            predicates.add(cb.isNull(root.get("deletedAt")));

            if (f.categoryId() != null) {
                predicates.add(cb.equal(root.get("category").get("id"), f.categoryId()));
            }
            if (f.brand() != null) {
                predicates.add(cb.equal(root.get("brand"), f.brand()));
            }
            if (f.minPrice() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("basePrice"), f.minPrice()));
            }
            if (f.maxPrice() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("basePrice"), f.maxPrice()));
            }

            if (f.colors() != null && !f.colors().isEmpty() || f.sizes() != null && !f.sizes().isEmpty()) {
                var variants = root.join("variants", JoinType.INNER);
                predicates.add(cb.isTrue(variants.get("isActive")));
                if (f.colors() != null && !f.colors().isEmpty()) {
                    predicates.add(variants.get("colorHex").in(f.colors()));
                }
                if (f.sizes() != null && !f.sizes().isEmpty()) {
                    predicates.add(variants.get("size").in(f.sizes()));
                }
                // Il join sulle varianti duplica il prodotto una volta per variante
                // che combacia: senza `distinct` la stessa maglietta compare tre volte.
                if (query != null) query.distinct(true);
            }

            String term = f.search() == null ? "" : f.search().trim();
            if (term.length() >= 2) {
                // Ogni parola deve comparire da qualche parte: "t-shirt nera" trova la
                // maglietta nera, non tutte le t-shirt piu' tutto cio' che e' nero.
                for (String word : term.split("\\s+")) {
                    String like = "%" + word.toLowerCase() + "%";
                    predicates.add(cb.or(
                            cb.like(cb.lower(root.get("name")), like),
                            cb.like(cb.lower(cb.coalesce(root.get("brand"), "")), like),
                            cb.like(cb.lower(cb.coalesce(root.get("shortDesc"), "")), like),
                            cb.like(cb.lower(cb.coalesce(root.get("description"), "")), like),
                            cb.like(cb.lower(root.get("category").get("name")), like),
                            // Nome ripulito da trattini e spazi: a catalogo e' "T-Shirt"
                            // e la gente scrive "tshirt".
                            cb.like(
                                    cb.function("regexp_replace", String.class,
                                            cb.lower(root.get("name")),
                                            cb.literal("[^a-z0-9]"), cb.literal(""), cb.literal("g")),
                                    "%" + word.toLowerCase().replaceAll("[^a-z0-9]", "") + "%")));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /** Filtri della lista prodotti: tutti opzionali. */
    public record Filters(
            String search,
            UUID categoryId,
            String brand,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            List<String> colors,
            List<String> sizes,
            String sortBy) {}

    public static Map<String, Object> meta(Page<?> page, int limit) {
        return Map.of(
                "total", page.getTotalElements(),
                "page", page.getNumber() + 1,
                "limit", limit,
                "totalPages", page.getTotalPages());
    }
}

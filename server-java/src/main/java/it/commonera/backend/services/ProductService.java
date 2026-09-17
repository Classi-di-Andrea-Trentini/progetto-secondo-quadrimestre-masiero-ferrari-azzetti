package it.commonera.backend.services;

import it.commonera.backend.entities.Category;
import it.commonera.backend.entities.Product;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.CategoryRepository;
import it.commonera.backend.repositories.ProductRepository;
import it.commonera.backend.repositories.ProductVariantRepository;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import it.commonera.backend.dtos.ProductDtos;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
    private final ProductVariantRepository variants;
    private final CategoryRepository categories;

    public ProductService(ProductRepository products, ProductVariantRepository variants,
                          CategoryRepository categories) {
        this.products = products;
        this.variants = variants;
        this.categories = categories;
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

    /**
     * Prodotti per id, nell'ordine chiesto dal client.
     *
     * Serve ai "visti di recente": la cronologia sta nel browser — non e' un dato che
     * valga la pena legare a un account, e cosi' funziona anche da sloggati — e qui si
     * recuperano solo prezzo e immagini aggiornati. L'ordine dato va rispettato,
     * altrimenti la fila si rimescola a ogni caricamento.
     */
    @Transactional(readOnly = true)
    public List<ProductDtos.ProductView> findByIdsAsView(List<UUID> ids) {
        // Tetto ai venti: la lista arriva dal client, che potrebbe chiederne mille.
        var wanted = ids.stream().distinct().limit(20).toList();
        if (wanted.isEmpty()) return List.of();

        var found = products.findByIdInAndIsActiveTrueAndDeletedAtIsNull(wanted);
        var byId = new HashMap<UUID, Product>();
        for (var product : found) byId.put(product.getId(), product);

        return wanted.stream()
                .map(byId::get)
                .filter(java.util.Objects::nonNull)
                .map(ProductDtos.ProductView::from)
                .toList();
    }

    /**
     * Valori possibili della barra dei filtri: categorie, colori, taglie, marche e
     * fascia di prezzo, calcolati sul catalogo **attivo**.
     *
     * I conteggi arrivano da query di aggregazione, non da un caricamento in memoria:
     * questa risposta la chiede ogni apertura del catalogo.
     *
     * Differenza voluta rispetto al backend Node: le taglie sono una lista di
     * stringhe, non di oggetti `{size, count}`. Il frontend le stampa direttamente
     * (`{{ s }}`), e con la forma di Node scriveva "[object Object]" su ogni bottone.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> filters() {
        var visible = categories.findByIsActiveTrueOrderBySortOrderAscNameAsc();

        Map<UUID, Long> own = new HashMap<>();
        for (Object[] row : products.countActiveByCategory()) {
            own.put((UUID) row[0], (Long) row[1]);
        }
        var rolledUp = rollUpCategoryCounts(visible, own);

        List<Map<String, Object>> categoryViews = new ArrayList<>();
        for (var category : visible) {
            var view = new LinkedHashMap<String, Object>();
            view.put("id", category.getId());
            view.put("name", category.getName());
            view.put("slug", category.getSlug());
            view.put("parentId", category.getParentId());
            // L'illustrazione di categoria c'era a database e non usciva mai dall'API.
            view.put("imageUrl", category.getImageUrl());
            view.put("count", rolledUp.getOrDefault(category.getId(), 0L));
            categoryViews.add(view);
        }

        List<Map<String, Object>> colors = new ArrayList<>();
        for (Object[] row : variants.availableColors()) {
            var view = new LinkedHashMap<String, Object>();
            view.put("color", row[0]);
            view.put("colorHex", row[1]);
            view.put("count", row[2]);
            colors.add(view);
        }

        var sizes = variants.availableSizes().stream()
                .map(row -> (String) row[0])
                .sorted(Comparator.comparingInt(ProductService::sizeRank).thenComparing(s -> s))
                .toList();

        List<Map<String, Object>> brands = new ArrayList<>();
        for (Object[] row : products.countActiveByBrand()) {
            var view = new LinkedHashMap<String, Object>();
            view.put("brand", row[0]);
            view.put("count", row[1]);
            brands.add(view);
        }

        var range = products.activePriceRange();
        BigDecimal min = range.isEmpty() || range.get(0)[0] == null ? BigDecimal.ZERO : (BigDecimal) range.get(0)[0];
        BigDecimal max = range.isEmpty() || range.get(0)[1] == null ? BigDecimal.valueOf(1000) : (BigDecimal) range.get(0)[1];

        return Map.of(
                "categories", categoryViews,
                "colors", colors,
                "sizes", sizes,
                "brands", brands,
                "priceRange", Map.of("min", min, "max", max));
    }

    /**
     * I prodotti stanno nelle categorie foglia: senza sommare i figli, un padre come
     * "Abbigliamento" mostrerebbe 0 pur avendo sotto tutto il guardaroba.
     */
    private static Map<UUID, Long> rollUpCategoryCounts(List<Category> categories, Map<UUID, Long> own) {
        Map<UUID, List<UUID>> children = new HashMap<>();
        for (var category : categories) {
            if (category.getParentId() == null) continue;
            children.computeIfAbsent(category.getParentId(), k -> new ArrayList<>()).add(category.getId());
        }

        Map<UUID, Long> total = new HashMap<>();
        for (var category : categories) {
            visitCategory(category.getId(), children, own, total, new java.util.HashSet<>());
        }
        return total;
    }

    private static long visitCategory(UUID id, Map<UUID, List<UUID>> children, Map<UUID, Long> own,
                                      Map<UUID, Long> total, java.util.Set<UUID> seen) {
        // La guardia sui cicli evita la ricorsione infinita se i dati fossero storti
        // (una categoria che discende da se stessa).
        if (!seen.add(id)) return 0;
        long sum = own.getOrDefault(id, 0L);
        for (UUID child : children.getOrDefault(id, List.of())) {
            sum += visitCategory(child, children, own, total, seen);
        }
        total.put(id, sum);
        return sum;
    }

    /** Ordine delle taglie: XS < S < M < L < XL..., e tutto il resto in fondo. */
    private static int sizeRank(String size) {
        return switch (size == null ? "" : size.trim().toUpperCase()) {
            case "XXS" -> 0;
            case "XS" -> 1;
            case "S" -> 2;
            case "M" -> 3;
            case "L" -> 4;
            case "XL" -> 5;
            case "XXL", "2XL" -> 6;
            case "XXXL", "3XL" -> 7;
            default -> 100;
        };
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

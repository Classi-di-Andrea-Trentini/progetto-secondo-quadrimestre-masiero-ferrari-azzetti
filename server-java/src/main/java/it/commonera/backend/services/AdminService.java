package it.commonera.backend.services;

import it.commonera.backend.dtos.AdminDtos;
import it.commonera.backend.entities.*;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.*;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Area amministrativa: numeri di vendita, magazzino, moderazione, e (aggiunto qui)
 * gestione utenti, catalogo (prodotti/varianti/immagini), lista/dettaglio ordini
 * e recensioni — la parte che nel backend Java mancava del tutto e che il
 * frontend Angular gia' si aspetta (`admin.service.ts`), portata dal backend
 * Node mantenendo gli stessi nomi di campo nelle risposte JSON.
 *
 * Il magazzino usa `low_stock_alert`, la soglia che nel backend Node era rimasta
 * inutilizzata per tutto il progetto — c'era su ogni variante e non avvisava nessuno.
 */
@Service
public class AdminService {

    private final OrderRepository orders;
    private final UserRepository users;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final ProductImageRepository images;
    private final CategoryRepository categories;
    private final ReviewRepository reviews;
    private final StockAlertRepository stockAlerts;
    private final UserAddressRepository addresses;
    private final PaymentRepository payments;
    private final PromoCodeRepository promoCodeRepo;
    private final MailService mail;
    private final String uploadsDir;

    public AdminService(OrderRepository orders, UserRepository users, ProductRepository products,
                        ProductVariantRepository variants, ProductImageRepository images,
                        CategoryRepository categories, ReviewRepository reviews,
                        StockAlertRepository stockAlerts, UserAddressRepository addresses,
                        PaymentRepository payments, PromoCodeRepository promoCodeRepo, MailService mail,
                        @org.springframework.beans.factory.annotation.Value("${app.uploads-dir:uploads}") String uploadsDir) {
        this.orders = orders;
        this.users = users;
        this.products = products;
        this.variants = variants;
        this.images = images;
        this.categories = categories;
        this.reviews = reviews;
        this.stockAlerts = stockAlerts;
        this.addresses = addresses;
        this.payments = payments;
        this.promoCodeRepo = promoCodeRepo;
        this.mail = mail;
        this.uploadsDir = uploadsDir;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        var all = orders.findAll();
        var paid = all.stream()
                .filter(o -> EnumSet.of(OrderStatus.paid, OrderStatus.processing, OrderStatus.shipped,
                        OrderStatus.delivered, OrderStatus.completed).contains(o.getStatus()))
                .toList();

        BigDecimal revenue = paid.stream()
                .map(Order::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        var byStatus = new LinkedHashMap<String, Long>();
        for (var order : all) {
            byStatus.merge(order.getStatus().name(), 1L, Long::sum);
        }
        // Il frontend legge un array di {status, count}, non l'oggetto: cosi' com'era
        // prima, `ordersByStatus.length` su un oggetto era sempre `undefined`, e la
        // sezione "Ordini per stato" della dashboard mostrava sempre "Nessun ordine
        // ancora" anche con ordini veri.
        var ordersByStatusList = byStatus.entrySet().stream()
                .map(e -> Map.of("status", e.getKey(), "count", e.getValue()))
                .toList();

        long pendingOrders = all.stream().filter(o -> o.getStatus() == OrderStatus.pending).count();

        var recentOrders = all.stream()
                .sorted(Comparator.comparing(Order::getCreatedAt).reversed())
                .limit(5)
                .map(this::orderSummaryView)
                .toList();

        var topProducts = products.findAll(Sort.by("soldCount").descending()).stream()
                .limit(5)
                .map(p -> Map.of("id", p.getId(), "name", p.getName(), "slug", p.getSlug(),
                        "soldCount", p.getSoldCount(), "basePrice", p.getBasePrice()))
                .toList();

        var low = lowStock(null);

        return Map.of(
                "totalUsers", users.count(),
                "totalOrders", all.size(),
                "totalProducts", products.count(),
                "totalRevenue", revenue,
                "pendingOrders", pendingOrders,
                "recentOrders", recentOrders,
                "topProducts", topProducts,
                // Scontrino medio sui **soli ordini incassati**: annullati e pendenti
                // abbasserebbero un numero che serve a leggere le vendite vere.
                "averageOrderValue", paid.isEmpty()
                        ? BigDecimal.ZERO
                        : revenue.divide(BigDecimal.valueOf(paid.size()), 2, RoundingMode.HALF_UP),
                "ordersByStatus", ordersByStatusList,
                "inventory", Map.of(
                        "outOfStock", low.get("outOfStock"),
                        "lowStock", low.get("lowStock")));
    }

    /** Varianti esaurite o sotto soglia, le esaurite per prime. */
    @Transactional(readOnly = true)
    public Map<String, Object> lowStock(Integer threshold) {
        List<Map<String, Object>> rows = new ArrayList<>();
        long out = 0;
        long low = 0;

        for (var variant : variants.findAll()) {
            if (!Boolean.TRUE.equals(variant.getIsActive())) continue;
            var product = variant.getProduct();
            if (!Boolean.TRUE.equals(product.getIsActive()) || product.getDeletedAt() != null) continue;

            // La soglia del prodotto ha la precedenza; `threshold` serve a guardare
            // piu' in la' di quanto impostato, non a sovrascriverlo.
            int limit = threshold != null ? threshold
                    : (variant.getLowStockAlert() == null ? 0 : variant.getLowStockAlert());

            String level = variant.getStockQty() <= 0 ? "out"
                    : variant.getStockQty() <= limit ? "low" : "ok";
            if ("ok".equals(level)) continue;

            if ("out".equals(level)) out++; else low++;

            rows.add(Map.of(
                    "variantId", variant.getId(),
                    "sku", variant.getSku(),
                    "productName", product.getName(),
                    "label", String.valueOf(variant.label()),
                    "stockQty", variant.getStockQty(),
                    "level", level));
        }

        rows.sort(Comparator.comparingInt(r -> (Integer) r.get("stockQty")));
        return Map.of("rows", rows, "outOfStock", out, "lowStock", low);
    }

    /**
     * Rettifica di giacenza.
     *
     * `delta` somma, `set` fissa il valore contato: sono due gesti diversi — "ne sono
     * arrivati 20" e "contati, sono 3" — e confonderli sballa l'inventario.
     */
    @Transactional
    public Map<String, Object> adjustStock(UUID variantId, Integer delta, Integer set) {
        if (delta == null && set == null) throw ApiException.badRequest("Provide either delta or set");
        if (delta != null && set != null) throw ApiException.badRequest("Provide only one of delta or set");

        var variant = variants.findById(variantId)
                .orElseThrow(() -> ApiException.notFound("Variant not found"));

        int previous = variant.getStockQty();
        int next = set != null ? set : previous + delta;
        if (next < 0) throw ApiException.badRequest("Stock cannot go below zero (current " + previous + ")");

        variant.setStockQty(next);
        variants.save(variant);

        // Se era esaurita e ora c'e', partono gli avvisi. **Dopo** la scrittura,
        // altrimenti si invita a comprare qualcosa che non c'e' ancora.
        int notified = 0;
        if (previous <= 0 && next > 0) notified = notifyBackInStock(variant);

        return Map.of("variantId", variantId, "stockQty", next, "previous", previous, "notified", notified);
    }

    private int notifyBackInStock(ProductVariant variant) {
        var pending = stockAlerts.findByVariantIdAndNotifiedAtIsNull(variant.getId());
        for (var alert : pending) {
            users.findById(alert.getUserId()).ifPresent(user ->
                    mail.sendBackInStock(user.getEmail(), user.getFullName(),
                            variant.getProduct().getName(), String.valueOf(variant.label()),
                            variant.getProduct().getSlug()));
            // Segnato comunque: riprovare all'infinito su un indirizzo morto significa
            // rimandare l'email a ogni carico di magazzino, per sempre.
            alert.setNotifiedAt(java.time.LocalDateTime.now());
            stockAlerts.save(alert);
        }
        return pending.size();
    }

    @Transactional
    public Map<String, Object> updateOrderStatus(UUID adminId, UUID orderId, String status, String trackingNumber) {
        var order = orders.findById(orderId)
                .orElseThrow(() -> ApiException.notFound("Order not found"));

        var next = parseOrderStatus(status);
        order.setStatus(next);
        if (trackingNumber != null) order.setTrackingNumber(trackingNumber);

        var entry = new OrderStatusHistory();
        entry.setOrder(order);
        entry.setStatus(next);
        entry.setChangedBy(adminId);
        entry.setNote("Aggiornato dall'amministratore");
        order.getStatusHistory().add(entry);

        orders.save(order);
        return Map.of("id", order.getId(), "status", next.name());
    }

    // ─── Utenti ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getUsers(String role, String search, int page, int limit) {
        int capped = Math.min(Math.max(limit, 1), 100);
        User.Role roleFilter = (role == null || role.isBlank()) ? null : parseUserRole(role);

        var result = users.findAll(userSpecification(roleFilter, search),
                PageRequest.of(Math.max(0, page - 1), capped, Sort.by("createdAt").descending()));

        var data = result.getContent().stream().map(this::userListView).toList();

        return Map.of("data", data,
                "meta", meta(result.getTotalElements(), result.getNumber() + 1, capped, result.getTotalPages()));
    }

    private Map<String, Object> userListView(User u) {
        var view = new LinkedHashMap<String, Object>();
        view.put("id", u.getId());
        view.put("email", u.getEmail());
        view.put("fullName", u.getFullName());
        view.put("role", u.getRole().name());
        view.put("emailVerifiedAt", u.getEmailVerifiedAt());
        view.put("createdAt", u.getCreatedAt());
        view.put("_count", Map.of("orders", orders.findAll(orderByUserSpec(u.getId())).size()));
        return view;
    }

    private Specification<Order> orderByUserSpec(UUID userId) {
        return (root, query, cb) -> cb.equal(root.get("userId"), userId);
    }

    /**
     * Impedisce di restare senza amministratori: prima non c'era nessun controllo,
     * un admin poteva declassare o cancellare se stesso, o l'ultimo admin rimasto —
     * e con zero admin non c'e' piu' un modo per rientrare dall'API.
     */
    private void assertNotLastAdmin(UUID targetUserId, UUID adminId, String action) {
        if (targetUserId.equals(adminId)) {
            throw ApiException.badRequest("Non puoi " + action + " il tuo stesso account");
        }
        var target = users.findById(targetUserId).orElse(null);
        if (target == null || target.getRole() != User.Role.admin) return;

        long admins = users.countByRoleAndDeletedAtIsNullAndIsActiveTrue(User.Role.admin);
        if (admins <= 1) {
            throw ApiException.badRequest("Non puoi " + action + " l'ultimo amministratore rimasto");
        }
    }

    @Transactional
    public Map<String, Object> updateUserRole(UUID id, String role, UUID adminId) {
        var user = users.findById(id).orElseThrow(() -> ApiException.notFound("Utente non trovato"));
        var next = parseUserRole(role);
        if (next != User.Role.admin) assertNotLastAdmin(id, adminId, "declassare");
        user.setRole(next);
        users.save(user);
        return Map.of("id", user.getId(), "email", user.getEmail(), "fullName", user.getFullName(),
                "role", user.getRole().name());
    }

    /**
     * Cancellazione **logica** (`deletedAt`), non l'`DELETE` diretto del backend Node:
     * `orders.user_id` ha `ON DELETE RESTRICT`, quindi un `DELETE` vero fallirebbe con
     * un vincolo di integrita' per qualunque utente che abbia gia' ordinato — un limite
     * di Node non riprodotto qui apposta, non un comportamento nuovo da inventare.
     */
    @Transactional
    public Map<String, String> deleteUser(UUID id, UUID adminId) {
        var user = users.findById(id).orElseThrow(() -> ApiException.notFound("Utente non trovato"));
        assertNotLastAdmin(id, adminId, "cancellare");
        user.setDeletedAt(LocalDateTime.now());
        user.setIsActive(false);
        users.save(user);
        return Map.of("message", "Utente eliminato");
    }

    @Transactional(readOnly = true)
    public String exportUsers() {
        var all = users.findAll(Sort.by("createdAt").descending());
        var lines = new ArrayList<String>();
        lines.add("id,email,fullName,role,createdAt,emailVerifiedAt,ordersCount");
        for (var u : all) {
            long ordersCount = orders.findAll(orderByUserSpec(u.getId())).size();
            lines.add(String.join(",",
                    String.valueOf(u.getId()),
                    csvCell(u.getEmail()),
                    csvCell(u.getFullName()),
                    u.getRole().name(),
                    String.valueOf(u.getCreatedAt()),
                    u.getEmailVerifiedAt() == null ? "" : String.valueOf(u.getEmailVerifiedAt()),
                    String.valueOf(ordersCount)));
        }
        return String.join("\n", lines);
    }

    private Specification<User> userSpecification(User.Role role, String search) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (role != null) predicates.add(cb.equal(root.get("role"), role));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("fullName")), like),
                        cb.like(cb.lower(root.get("email")), like)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    // ─── Prodotti ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getProducts(Boolean isActive, String search, int page, int limit) {
        int capped = Math.min(Math.max(limit, 1), 100);
        var result = products.findAll(productSpecification(isActive, search),
                PageRequest.of(Math.max(0, page - 1), capped, Sort.by("createdAt").descending()));

        var data = result.getContent().stream().map(this::productListView).toList();
        return Map.of("data", data,
                "meta", meta(result.getTotalElements(), result.getNumber() + 1, capped, result.getTotalPages()));
    }

    private Map<String, Object> productListView(Product p) {
        var view = new LinkedHashMap<String, Object>();
        view.put("id", p.getId());
        view.put("name", p.getName());
        view.put("slug", p.getSlug());
        view.put("description", p.getDescription());
        view.put("basePrice", p.getBasePrice());
        view.put("isActive", p.getIsActive());
        view.put("soldCount", p.getSoldCount());
        view.put("avgRating", p.getAvgRating());
        view.put("createdAt", p.getCreatedAt());
        view.put("category", p.getCategory() == null ? null : Map.of("name", p.getCategory().getName()));
        view.put("images", p.getImages().stream()
                .filter(i -> Boolean.TRUE.equals(i.getIsCover()))
                .limit(1)
                .map(i -> Map.of("url", i.getUrl()))
                .toList());
        view.put("discounts", p.getDiscounts().stream()
                .filter(d -> Boolean.TRUE.equals(d.getIsActive()))
                .limit(1)
                .map(d -> Map.of("type", d.getType().name(), "value", d.getValue(), "isActive", d.getIsActive()))
                .toList());
        view.put("_count", Map.of("variants", p.getVariants().size()));
        return view;
    }

    @Transactional
    public Map<String, Object> createProduct(AdminDtos.CreateProductRequest dto) {
        if (products.existsBySlug(dto.slug())) throw ApiException.badRequest("Slug già in uso");
        if (dto.categoryId() == null) throw ApiException.badRequest("categoryId is required");
        var category = categories.findById(dto.categoryId())
                .orElseThrow(() -> ApiException.badRequest("Category not found"));

        var product = new Product();
        product.setCategory(category);
        product.setName(dto.name());
        product.setSlug(dto.slug());
        product.setDescription(dto.description());
        product.setShortDesc(dto.shortDesc());
        product.setBrand(blankToNull(dto.brand()));
        product.setBasePrice(dto.basePrice());
        product.setIsActive(dto.isActive() == null || dto.isActive());
        product.setIsFeatured(Boolean.TRUE.equals(dto.isFeatured()));
        product.setIsNewArrival(Boolean.TRUE.equals(dto.isNewArrival()));
        var saved = products.save(product);
        return productListView(saved);
    }

    @Transactional
    public Map<String, Object> updateProduct(UUID id, AdminDtos.UpdateProductRequest dto) {
        var product = products.findById(id).orElseThrow(() -> ApiException.notFound("Prodotto non trovato"));
        if (dto.name() != null) product.setName(dto.name());
        if (dto.description() != null) product.setDescription(dto.description());
        if (dto.shortDesc() != null) product.setShortDesc(blankToNull(dto.shortDesc()));
        if (dto.brand() != null) product.setBrand(blankToNull(dto.brand()));
        if (dto.categoryId() != null) {
            product.setCategory(categories.findById(dto.categoryId())
                    .orElseThrow(() -> ApiException.badRequest("Category not found")));
        }
        if (dto.basePrice() != null) product.setBasePrice(dto.basePrice());
        if (dto.isActive() != null) product.setIsActive(dto.isActive());
        if (dto.isFeatured() != null) product.setIsFeatured(dto.isFeatured());
        if (dto.isNewArrival() != null) product.setIsNewArrival(dto.isNewArrival());
        var saved = products.save(product);
        return productListView(saved);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    // ─── Categorie ──────────────────────────────────────────────────────────

    /**
     * Le categorie, tutte: qui servono a riempire la tendina della scheda prodotto, e
     * una categoria spenta resta comunque una casella dove mettere la merce.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getCategories() {
        return categories.findAllByOrderBySortOrderAscNameAsc().stream()
                .map(c -> {
                    var view = new LinkedHashMap<String, Object>();
                    view.put("id", c.getId());
                    view.put("name", c.getName());
                    view.put("slug", c.getSlug());
                    view.put("parentId", c.getParentId());
                    view.put("isActive", c.getIsActive());
                    return (Map<String, Object>) view;
                })
                .toList();
    }

    @Transactional
    public Map<String, Object> createCategory(AdminDtos.CreateCategoryRequest dto) {
        if (dto.name() == null || dto.name().isBlank()) throw ApiException.badRequest("Il nome e' obbligatorio");

        String slug = dto.slug() == null || dto.slug().isBlank() ? slugify(dto.name()) : dto.slug().trim().toLowerCase();
        if (!slug.matches("^[a-z0-9-]+$")) throw ApiException.badRequest("Slug non valido");
        if (categories.existsBySlugIgnoreCase(slug)) throw ApiException.badRequest("Slug gia' in uso");

        if (dto.parentId() != null && categories.findById(dto.parentId()).isEmpty()) {
            throw ApiException.badRequest("Category not found");
        }

        var category = new Category();
        category.setName(dto.name().trim());
        category.setSlug(slug);
        category.setDescription(blankToNull(dto.description()));
        category.setParentId(dto.parentId());
        category.setIsActive(true);
        var saved = categories.save(category);

        var view = new LinkedHashMap<String, Object>();
        view.put("id", saved.getId());
        view.put("name", saved.getName());
        view.put("slug", saved.getSlug());
        view.put("parentId", saved.getParentId());
        view.put("isActive", saved.getIsActive());
        return view;
    }

    /** "Felpe & Maglie" -> "felpe-maglie". */
    private static String slugify(String name) {
        String slug = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        if (slug.isBlank()) throw ApiException.badRequest("Dal nome non esce uno slug valido: scrivilo a mano");
        return slug;
    }

    @Transactional
    public Map<String, String> deleteProduct(UUID id) {
        var product = products.findById(id).orElseThrow(() -> ApiException.notFound("Prodotto non trovato"));
        if (product.getDeletedAt() != null) throw ApiException.notFound("Prodotto non trovato");
        product.setDeletedAt(LocalDateTime.now());
        products.save(product);
        return Map.of("message", "Prodotto eliminato");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getProductDetail(UUID id) {
        var product = products.findById(id).orElseThrow(() -> ApiException.notFound("Prodotto non trovato"));
        var view = new LinkedHashMap<>(productListView(product));
        view.put("category", product.getCategory() == null ? null
                : Map.of("id", product.getCategory().getId(), "name", product.getCategory().getName()));
        view.put("variants", variants.findByProductId(id).stream().map(this::variantView).toList());
        view.put("images", images.findByProductIdOrderBySortOrderAsc(id).stream().map(this::imageView).toList());
        return view;
    }

    private Specification<Product> productSpecification(Boolean isActive, String search) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isNull(root.get("deletedAt")));
            if (isActive != null) predicates.add(cb.equal(root.get("isActive"), isActive));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("slug")), like)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Transactional(readOnly = true)
    public String exportProducts() {
        var all = products.findAll(productSpecification(null, null), Sort.by("name").ascending());
        var lines = new ArrayList<String>();
        lines.add("product_id,name,slug,category,brand,base_price,active,sku,size,color,stock,price_override");
        for (var p : all) {
            var productVariants = variants.findByProductId(p.getId());
            var rows = productVariants.isEmpty() ? Collections.<ProductVariant>singletonList(null) : productVariants;
            for (var v : rows) {
                lines.add(String.join(",",
                        String.valueOf(p.getId()), csvCell(p.getName()), csvCell(p.getSlug()),
                        csvCell(p.getCategory() == null ? null : p.getCategory().getName()),
                        csvCell(p.getBrand()), csvCell(String.valueOf(p.getBasePrice())),
                        csvCell(Boolean.TRUE.equals(p.getIsActive()) ? "yes" : "no"),
                        csvCell(v == null ? null : v.getSku()), csvCell(v == null ? null : v.getSize()),
                        csvCell(v == null ? null : v.getColor()),
                        csvCell(v == null ? "" : String.valueOf(v.getStockQty())),
                        csvCell(v == null || v.getPriceOverride() == null ? "" : String.valueOf(v.getPriceOverride()))));
            }
        }
        return String.join("\n", lines);
    }

    // ─── Varianti ───────────────────────────────────────────────────────────

    private Map<String, Object> variantView(ProductVariant v) {
        var view = new LinkedHashMap<String, Object>();
        view.put("id", v.getId());
        view.put("sku", v.getSku());
        view.put("size", v.getSize());
        view.put("color", v.getColor());
        view.put("colorHex", v.getColorHex());
        view.put("material", v.getMaterial());
        view.put("priceOverride", v.getPriceOverride());
        view.put("stockQty", v.getStockQty());
        view.put("isActive", v.getIsActive());
        view.put("createdAt", v.getCreatedAt());
        return view;
    }

    @Transactional
    public Map<String, Object> createVariant(UUID productId, AdminDtos.CreateVariantRequest dto) {
        var product = products.findById(productId).orElseThrow(() -> ApiException.notFound("Prodotto non trovato"));
        if (variants.existsBySkuIgnoreCase(dto.sku())) throw ApiException.badRequest("SKU già in uso");

        var variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSku(dto.sku());
        variant.setSize(dto.size());
        variant.setColor(dto.color());
        variant.setColorHex(dto.colorHex());
        variant.setMaterial(dto.material());
        variant.setPriceOverride(dto.priceOverride());
        variant.setStockQty(dto.stockQty() == null ? 0 : dto.stockQty());
        variant.setIsActive(dto.isActive() == null || dto.isActive());
        var saved = variants.save(variant);
        return variantView(saved);
    }

    @Transactional
    public Map<String, Object> updateVariant(UUID productId, UUID variantId, AdminDtos.UpdateVariantRequest dto) {
        var variant = variants.findByIdAndProductId(variantId, productId)
                .orElseThrow(() -> ApiException.notFound("Variante non trovata"));
        if (dto.sku() != null && !dto.sku().equalsIgnoreCase(variant.getSku())) {
            if (variants.existsBySkuIgnoreCase(dto.sku())) throw ApiException.badRequest("SKU già in uso");
            variant.setSku(dto.sku());
        }
        if (dto.size() != null) variant.setSize(dto.size().isBlank() ? null : dto.size());
        if (dto.color() != null) variant.setColor(dto.color().isBlank() ? null : dto.color());
        if (dto.colorHex() != null) variant.setColorHex(dto.colorHex().isBlank() ? null : dto.colorHex());
        if (dto.material() != null) variant.setMaterial(dto.material().isBlank() ? null : dto.material());
        if (dto.priceOverride() != null) variant.setPriceOverride(dto.priceOverride());
        if (dto.stockQty() != null) variant.setStockQty(dto.stockQty());
        if (dto.isActive() != null) variant.setIsActive(dto.isActive());
        var saved = variants.save(variant);
        return variantView(saved);
    }

    @Transactional
    public Map<String, String> deleteVariant(UUID productId, UUID variantId) {
        var variant = variants.findByIdAndProductId(variantId, productId)
                .orElseThrow(() -> ApiException.notFound("Variante non trovata"));
        variants.delete(variant);
        return Map.of("message", "Variante eliminata");
    }

    // ─── Immagini ───────────────────────────────────────────────────────────

    private Map<String, Object> imageView(ProductImage i) {
        return Map.of("id", i.getId(), "url", i.getUrl(),
                "altText", i.getAltText() == null ? "" : i.getAltText(),
                "sortOrder", i.getSortOrder(), "isCover", i.getIsCover());
    }

    @Transactional
    public Map<String, Object> addImage(UUID productId, String url, String altText, Integer sortOrder, Boolean isCover) {
        var product = products.findById(productId).orElseThrow(() -> ApiException.notFound("Prodotto non trovato"));
        long count = images.countByProductId(productId);
        boolean shouldBeCover = Boolean.TRUE.equals(isCover) || count == 0;
        if (shouldBeCover) images.clearCover(productId);

        var image = new ProductImage();
        image.setProduct(product);
        image.setUrl(url);
        image.setAltText(altText);
        image.setSortOrder(sortOrder == null ? (int) count : sortOrder);
        image.setIsCover(shouldBeCover);
        var saved = images.save(image);
        return imageView(saved);
    }

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp");

    /**
     * Salva il file su disco e crea l'immagine come {@link #addImage}.
     *
     * L'estensione viene decisa **dal content-type dichiarato**, non dal nome
     * originale del file: un nome come {@code foto.jpg.php} con un content-type
     * `image/jpeg` genuino verrebbe comunque salvato come `.jpg`, non `.php` —
     * l'estensione del file scritto su disco non e' mai scelta dal client.
     */
    @Transactional
    public Map<String, Object> uploadImage(UUID productId, org.springframework.web.multipart.MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("Nessun file ricevuto");
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw ApiException.badRequest("Solo file immagine sono consentiti (jpeg, png, gif, webp)");
        }

        String extension = switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            default -> ".webp";
        };
        String filename = System.currentTimeMillis() + "-" + (int) (Math.random() * 1_000_000) + extension;

        try {
            var dir = java.nio.file.Path.of(uploadsDir, "products");
            java.nio.file.Files.createDirectories(dir);
            // Sempre e solo `filename` (generato qui sopra, mai dall'utente):
            // e' quello che tiene questo path dentro `dir` a prescindere da cosa
            // contenesse il nome originale del file caricato.
            var target = dir.resolve(filename);
            file.transferTo(target);
        } catch (java.io.IOException e) {
            throw ApiException.badRequest("Impossibile salvare il file: " + e.getMessage());
        }

        // URL **relativo**, non `backendUrl + ...`: l'indirizzo del backend finirebbe
        // scritto dentro ogni riga di `product_images`, e il giorno che il sito cambia
        // host tutte le foto gia' caricate punterebbero al vecchio. Relativo passa dal
        // proxy `/api` che il frontend ha gia', qualunque sia il dominio.
        String url = "/api/uploads/products/" + filename;
        return addImage(productId, url, null, null, null);
    }

    @Transactional
    public Map<String, String> deleteImage(UUID productId, UUID imageId) {
        var image = images.findByIdAndProductId(imageId, productId)
                .orElseThrow(() -> ApiException.notFound("Immagine non trovata"));
        boolean wasCover = Boolean.TRUE.equals(image.getIsCover());
        images.delete(image);
        if (wasCover) {
            images.findFirstByProductIdOrderBySortOrderAsc(productId).ifPresent(next -> {
                next.setIsCover(true);
                images.save(next);
            });
        }
        return Map.of("message", "Immagine eliminata");
    }

    @Transactional
    public Map<String, String> setCoverImage(UUID productId, UUID imageId) {
        var image = images.findByIdAndProductId(imageId, productId)
                .orElseThrow(() -> ApiException.notFound("Immagine non trovata"));
        images.clearCover(productId);
        image.setIsCover(true);
        images.save(image);
        return Map.of("message", "Cover aggiornata");
    }

    // ─── Ordini ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getOrders(String status, String search, int page, int limit) {
        int capped = Math.min(Math.max(limit, 1), 100);
        OrderStatus statusFilter = (status == null || status.isBlank()) ? null : parseOrderStatus(status);

        List<UUID> matchingUserIds = List.of();
        UUID searchId = null;
        if (search != null && !search.isBlank()) {
            matchingUserIds = users.findByEmailContainingIgnoreCaseOrFullNameContainingIgnoreCase(search, search)
                    .stream().map(User::getId).toList();
            searchId = tryParseUuid(search);
        }

        var result = orders.findAll(orderSpecification(statusFilter, search, matchingUserIds, searchId),
                PageRequest.of(Math.max(0, page - 1), capped, Sort.by("createdAt").descending()));

        var data = result.getContent().stream().map(this::orderSummaryView).toList();
        return Map.of("data", data,
                "meta", meta(result.getTotalElements(), result.getNumber() + 1, capped, result.getTotalPages()));
    }

    private Map<String, Object> orderSummaryView(Order o) {
        var view = new LinkedHashMap<String, Object>();
        view.put("id", o.getId());
        view.put("status", o.getStatus().name());
        view.put("total", o.getTotal());
        view.put("createdAt", o.getCreatedAt());
        var user = users.findById(o.getUserId()).orElse(null);
        view.put("user", user == null ? null : Map.of("fullName", user.getFullName(), "email", user.getEmail()));
        view.put("items", o.getItems().stream()
                .map(i -> Map.of("productName", i.getProductName(), "quantity", i.getQuantity(), "lineTotal", i.getLineTotal()))
                .toList());
        return view;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getOrderDetail(UUID id) {
        var order = orders.findById(id).orElseThrow(() -> ApiException.notFound("Ordine non trovato"));
        var view = new LinkedHashMap<>(orderSummaryView(order));
        view.put("subtotal", order.getSubtotal());
        view.put("discountTotal", order.getDiscountTotal());
        view.put("shippingCost", order.getShippingCost());
        view.put("shippingMethod", order.getShippingMethod());
        view.put("notes", order.getNotes());

        // `Map.of(...)` non ammette valori null e lancia NullPointerException appena
        // ne incontra uno — qui sotto capita davvero (`street2`, `paidAt` prima del
        // pagamento, `note` sullo storico stato): serve `LinkedHashMap`, che i null
        // li accetta senza drammi.
        var address = order.getAddressId() == null ? null : addresses.findById(order.getAddressId()).orElse(null);
        if (address == null) {
            view.put("address", null);
        } else {
            var addressView = new LinkedHashMap<String, Object>();
            addressView.put("fullName", address.getFullName());
            addressView.put("street", address.getStreet());
            addressView.put("street2", address.getStreet2());
            addressView.put("city", address.getCity());
            addressView.put("province", address.getProvince());
            addressView.put("postalCode", address.getPostalCode());
            addressView.put("country", address.getCountry());
            view.put("address", addressView);
        }

        view.put("payments", payments.findByOrderIdOrderByCreatedAtDesc(id).stream()
                .map(p -> {
                    var paymentView = new LinkedHashMap<String, Object>();
                    paymentView.put("status", p.getStatus().name());
                    paymentView.put("method", p.getMethod().name());
                    paymentView.put("amount", p.getAmount());
                    paymentView.put("paidAt", p.getPaidAt());
                    return paymentView;
                })
                .toList());

        view.put("statusHistory", order.getStatusHistory().stream()
                .sorted(Comparator.comparing(OrderStatusHistory::getCreatedAt))
                .map(h -> {
                    var stepView = new LinkedHashMap<String, Object>();
                    stepView.put("status", h.getStatus().name());
                    stepView.put("note", h.getNote());
                    stepView.put("createdAt", h.getCreatedAt());
                    return stepView;
                })
                .toList());

        if (order.getPromoCodeId() != null) {
            promoCodeRepo.findById(order.getPromoCodeId())
                    .ifPresentOrElse(pc -> view.put("promoCode", Map.of("code", pc.getCode())),
                            () -> view.put("promoCode", null));
        } else {
            view.put("promoCode", null);
        }

        return view;
    }

    private Specification<Order> orderSpecification(OrderStatus status, String search,
                                                      List<UUID> matchingUserIds, UUID searchId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (search != null && !search.isBlank()) {
                List<Predicate> or = new ArrayList<>();
                if (!matchingUserIds.isEmpty()) or.add(root.get("userId").in(matchingUserIds));
                if (searchId != null) or.add(cb.equal(root.get("id"), searchId));
                predicates.add(or.isEmpty() ? cb.disjunction() : cb.or(or.toArray(new Predicate[0])));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Transactional(readOnly = true)
    public String exportOrders(String status, String dateFrom, String dateTo) {
        OrderStatus statusFilter = (status == null || status.isBlank()) ? null : parseOrderStatus(status);
        LocalDateTime from = (dateFrom == null || dateFrom.isBlank()) ? null : LocalDateTime.parse(dateFrom + "T00:00:00");
        LocalDateTime to = (dateTo == null || dateTo.isBlank()) ? null : LocalDateTime.parse(dateTo + "T23:59:59");

        var all = orders.findAll(dateRangeSpecification(statusFilter, from, to), Sort.by("createdAt").descending());
        var lines = new ArrayList<String>();
        lines.add("id,createdAt,status,user.email,user.fullName,total");
        for (var o : all) {
            var user = users.findById(o.getUserId()).orElse(null);
            lines.add(String.join(",",
                    String.valueOf(o.getId()), String.valueOf(o.getCreatedAt()), o.getStatus().name(),
                    csvCell(user == null ? null : user.getEmail()), csvCell(user == null ? null : user.getFullName()),
                    o.getTotal().setScale(2, RoundingMode.HALF_UP).toString()));
        }
        return String.join("\n", lines);
    }

    private Specification<Order> dateRangeSpecification(OrderStatus status, LocalDateTime from, LocalDateTime to) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            if (to != null) predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    // ─── Recensioni ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getReviews(String status, String search, int page, int limit) {
        int capped = Math.min(Math.max(limit, 1), 100);
        Review.ReviewStatus statusFilter = (status == null || status.isBlank()) ? null : parseReviewStatus(status);

        var result = reviews.findAll(reviewSpecification(statusFilter),
                PageRequest.of(Math.max(0, page - 1), capped, Sort.by("createdAt").descending()));

        var data = result.getContent().stream().map(this::reviewView).toList();
        return Map.of("data", data,
                "meta", meta(result.getTotalElements(), result.getNumber() + 1, capped, result.getTotalPages()));
    }

    private Map<String, Object> reviewView(Review r) {
        var user = users.findById(r.getUserId()).orElse(null);
        var product = products.findById(r.getProductId()).orElse(null);
        var view = new LinkedHashMap<String, Object>();
        view.put("id", r.getId());
        view.put("rating", r.getRating());
        view.put("title", r.getTitle());
        view.put("body", r.getBody());
        view.put("status", r.getStatus().name());
        view.put("createdAt", r.getCreatedAt());
        view.put("user", user == null ? null : Map.of("fullName", user.getFullName(), "email", user.getEmail()));
        view.put("product", product == null ? null : Map.of("name", product.getName(), "slug", product.getSlug()));
        return view;
    }

    @Transactional
    public Map<String, Object> moderateReview(UUID reviewId, String status) {
        var review = reviews.findById(reviewId)
                .orElseThrow(() -> ApiException.notFound("Review not found"));
        review.setStatus(parseReviewStatus(status));
        reviews.save(review);
        return Map.of("id", review.getId(), "status", review.getStatus().name());
    }

    @Transactional
    public Map<String, String> deleteReview(UUID id) {
        var review = reviews.findById(id).orElseThrow(() -> ApiException.notFound("Recensione non trovata"));
        reviews.delete(review);
        return Map.of("message", "Recensione eliminata");
    }

    private Specification<Review> reviewSpecification(Review.ReviewStatus status) {
        return (root, query, cb) -> status == null ? cb.conjunction() : cb.equal(root.get("status"), status);
    }

    // ─── Comuni ─────────────────────────────────────────────────────────────

    private Map<String, Object> meta(long total, int page, int limit, int totalPages) {
        return Map.of("total", total, "page", page, "limit", limit, "totalPages", totalPages);
    }

    /**
     * Mette un apice davanti alle celle che iniziano con `=`, `+`, `-` o `@`:
     * Excel/Sheets le tratterebbero come formule, e `fullName` e' scelto in fase di
     * registrazione — senza questo un export diventa un foglio che esegue roba scritta
     * da un estraneo (OWASP CSV/formula injection).
     */
    private String csvCell(String value) {
        String raw = value == null ? "" : value;
        String safe = raw.matches("^[=+\\-@\\t\\r].*") ? "'" + raw : raw;
        return "\"" + safe.replace("\"", "\"\"") + "\"";
    }

    private static UUID tryParseUuid(String value) {
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Review.ReviewStatus parseReviewStatus(String status) {
        try {
            return Review.ReviewStatus.valueOf(status);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid review status: " + status);
        }
    }

    private OrderStatus parseOrderStatus(String status) {
        try {
            return OrderStatus.valueOf(status);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid order status: " + status);
        }
    }

    private User.Role parseUserRole(String role) {
        try {
            return User.Role.valueOf(role);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid role: " + role);
        }
    }
}

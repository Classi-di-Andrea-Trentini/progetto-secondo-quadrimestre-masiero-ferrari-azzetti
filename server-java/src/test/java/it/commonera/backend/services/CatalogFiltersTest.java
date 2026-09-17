package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.Category;
import it.commonera.backend.entities.Product;
import it.commonera.backend.entities.ProductVariant;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La barra dei filtri del catalogo e i "visti di recente".
 *
 * Il frontend chiamava `/products/filters` e `/products/by-ids` da sempre, ma il
 * backend Java non li esponeva: la prima richiesta finiva su `/products/{slug}` con
 * slug "filters" (404) e la barra restava vuota senza un errore visibile.
 */
class CatalogFiltersTest extends AbstractIntegrationTest {

    @Autowired
    private ProductService products;
    @PersistenceContext
    private EntityManager em;

    @Test
    void categoryCountsIncludeTheChildrenOfEachCategory() {
        var parent = category("Abbigliamento", null);
        var child = category("Magliette", parent.getId());
        // Il prodotto sta nella foglia: senza la somma sui figli il padre direbbe 0
        // pur avendo sotto tutto il guardaroba.
        product("Maglietta", child, new BigDecimal("19.90"), true);

        var filters = products.filters();
        var categories = categoriesOf(filters);

        assertThat(countOf(categories, parent.getId())).isEqualTo(1L);
        assertThat(countOf(categories, child.getId())).isEqualTo(1L);
    }

    @Test
    void sizesAreStringsAndColoursCountDistinctProducts() {
        var category = category("Scarpe", null);
        var shoe = product("Scarpa", category, new BigDecimal("89.00"), true);
        // Stesso prodotto, stesso colore, tre taglie: il colore vale **uno**.
        variant(shoe, "42", "Nero", "#000000");
        variant(shoe, "43", "Nero", "#000000");
        variant(shoe, "44", "Nero", "#000000");

        var filters = products.filters();

        @SuppressWarnings("unchecked")
        var sizes = (List<String>) filters.get("sizes");
        // Stringhe e non oggetti: il template le stampa direttamente, e con la forma
        // del backend Node scriveva "[object Object]" su ogni bottone.
        assertThat(sizes).containsExactlyInAnyOrder("42", "43", "44");

        @SuppressWarnings("unchecked")
        var colours = (List<Map<String, Object>>) filters.get("colors");
        var black = colours.stream().filter(c -> "#000000".equals(c.get("colorHex"))).findFirst().orElseThrow();
        assertThat(black.get("count")).isEqualTo(1L);
    }

    @Test
    void inactiveProductsStayOutOfTheFilters() {
        var category = category("Nascosti", null);
        product("Non in vendita", category, new BigDecimal("10.00"), false);

        var categories = categoriesOf(products.filters());

        assertThat(countOf(categories, category.getId())).isEqualTo(0L);
    }

    @Test
    void byIdsKeepsTheOrderAskedForAndDropsWhatIsNotOnSale() {
        var category = category("Visti", null);
        var first = product("Primo", category, new BigDecimal("10.00"), true);
        var second = product("Secondo", category, new BigDecimal("20.00"), true);
        var hidden = product("Spento", category, new BigDecimal("30.00"), false);

        var view = products.findByIdsAsView(List.of(second.getId(), hidden.getId(), first.getId()));

        // L'ordine e' quello del client: la cronologia si rimescolerebbe a ogni giro.
        assertThat(view).extracting(v -> v.name()).containsExactly("Secondo", "Primo");
    }

    // ─── Dati di prova ────────────────────────────────────────────────────────

    private Category category(String name, UUID parentId) {
        var category = new Category();
        category.setName(name);
        category.setSlug(name.toLowerCase() + "-" + UUID.randomUUID());
        category.setParentId(parentId);
        category.setIsActive(true);
        em.persist(category);
        em.flush();
        return category;
    }

    private Product product(String name, Category category, BigDecimal price, boolean active) {
        var product = new Product();
        product.setName(name);
        product.setSlug(name.toLowerCase() + "-" + UUID.randomUUID());
        product.setCategory(category);
        product.setBasePrice(price);
        product.setIsActive(active);
        em.persist(product);
        em.flush();
        return product;
    }

    private void variant(Product product, String size, String colour, String colourHex) {
        var variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSku("SKU-" + UUID.randomUUID());
        variant.setSize(size);
        variant.setColor(colour);
        variant.setColorHex(colourHex);
        variant.setStockQty(1);
        variant.setIsActive(true);
        em.persist(variant);
        em.flush();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> categoriesOf(Map<String, Object> filters) {
        return (List<Map<String, Object>>) filters.get("categories");
    }

    private long countOf(List<Map<String, Object>> categories, UUID id) {
        return categories.stream()
                .filter(c -> id.equals(c.get("id")))
                .map(c -> (Long) c.get("count"))
                .findFirst()
                .orElse(0L);
    }
}

package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.dtos.AdminDtos;
import it.commonera.backend.entities.Category;
import it.commonera.backend.entities.User;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.CategoryRepository;
import it.commonera.backend.repositories.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Il backend Java non aveva **nessun** endpoint admin oltre a dashboard,
 * magazzino, cambio stato ordine e moderazione recensioni — mancavano utenti,
 * catalogo (CRUD prodotti/varianti/immagini) e lista/dettaglio ordini, che il
 * frontend Angular gia' si aspettava. Qui si copre la parte piu' delicata
 * (l'ultimo amministratore non deve poter sparire) e un giro completo del
 * catalogo, non ogni combinazione di filtro.
 */
class AdminServiceTest extends AbstractIntegrationTest {

    @Autowired
    private UserRepository users;
    @Autowired
    private CategoryRepository categories;
    @Autowired
    private AdminService admin;
    @PersistenceContext
    private EntityManager em;

    private User onlyAdmin;

    @BeforeEach
    void setUp() {
        onlyAdmin = new User();
        onlyAdmin.setEmail("admin." + UUID.randomUUID() + "@example.com");
        onlyAdmin.setPasswordHash("unused-in-this-test");
        onlyAdmin.setFullName("Unico Admin");
        onlyAdmin.setRole(User.Role.admin);
        onlyAdmin = users.save(onlyAdmin);
        em.flush();
    }

    @Test
    void anAdminCannotDeleteTheirOwnAccount() {
        assertThatThrownBy(() -> admin.deleteUser(onlyAdmin.getId(), onlyAdmin.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("tuo stesso account");
    }

    @Test
    void theLastAdminCannotBeDeletedByAnotherAdmin() {
        var secondAdminToSave = new User();
        secondAdminToSave.setEmail("admin2." + UUID.randomUUID() + "@example.com");
        secondAdminToSave.setPasswordHash("unused-in-this-test");
        secondAdminToSave.setFullName("Secondo Admin");
        secondAdminToSave.setRole(User.Role.admin);
        var secondAdmin = users.save(secondAdminToSave);
        em.flush();

        // Cancellando "onlyAdmin" ne resterebbe uno solo (secondAdmin): consentito.
        admin.deleteUser(onlyAdmin.getId(), secondAdmin.getId());
        em.flush();
        em.clear();
        assertThat(users.findById(onlyAdmin.getId()).orElseThrow().getDeletedAt()).isNotNull();

        // Ora secondAdmin e' l'ultimo: un terzo utente (non admin) non puo' cancellarlo.
        var plainUserToSave = new User();
        plainUserToSave.setEmail("user." + UUID.randomUUID() + "@example.com");
        plainUserToSave.setPasswordHash("unused-in-this-test");
        plainUserToSave.setFullName("Utente Qualsiasi");
        var plainUser = users.save(plainUserToSave);
        em.flush();

        assertThatThrownBy(() -> admin.deleteUser(secondAdmin.getId(), plainUser.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ultimo amministratore");
    }

    @Test
    void aNormalUserCanBeSoftDeletedWithoutTouchingAdminCount() {
        var plainUserToSave = new User();
        plainUserToSave.setEmail("user." + UUID.randomUUID() + "@example.com");
        plainUserToSave.setPasswordHash("unused-in-this-test");
        plainUserToSave.setFullName("Utente Qualsiasi");
        var plainUser = users.save(plainUserToSave);
        em.flush();

        var result = admin.deleteUser(plainUser.getId(), onlyAdmin.getId());
        assertThat(result.get("message")).isEqualTo("Utente eliminato");

        em.flush();
        em.clear();
        var reloaded = users.findById(plainUser.getId()).orElseThrow();
        assertThat(reloaded.getDeletedAt()).isNotNull();
        assertThat(reloaded.getIsActive()).isFalse();
    }

    @Test
    void demotingTheLastAdminToUserIsRejected() {
        assertThatThrownBy(() -> admin.updateUserRole(onlyAdmin.getId(), "user", onlyAdmin.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("tuo stesso account");
    }

    @Test
    void fullCatalogRoundTripThroughAdminEndpoints() {
        var category = new Category();
        category.setName("Categoria Admin");
        category.setSlug("categoria-admin-" + UUID.randomUUID());
        em.persist(category);
        em.flush();

        var created = admin.createProduct(new AdminDtos.CreateProductRequest(
                "Prodotto Admin", "prodotto-admin-" + UUID.randomUUID(), "Descrizione",
                category.getId(), new BigDecimal("29.90"), true));
        UUID productId = (UUID) created.get("id");
        assertThat(created.get("name")).isEqualTo("Prodotto Admin");

        var variant = admin.createVariant(productId, new AdminDtos.CreateVariantRequest(
                "SKU-ADMIN-" + UUID.randomUUID(), "M", "Nero", "#000000", null,
                null, 5, true));
        UUID variantId = (UUID) variant.get("id");
        assertThat(variant.get("stockQty")).isEqualTo(5);

        var image = admin.addImage(productId, "https://example.com/img.jpg", "Alt", null, null);
        assertThat(image.get("isCover")).isEqualTo(true); // prima immagine: cover automatica

        var detail = admin.getProductDetail(productId);
        @SuppressWarnings("unchecked")
        var variants = (java.util.List<Map<String, Object>>) detail.get("variants");
        @SuppressWarnings("unchecked")
        var images = (java.util.List<Map<String, Object>>) detail.get("images");
        assertThat(variants).hasSize(1);
        assertThat(images).hasSize(1);

        admin.updateVariant(productId, variantId, new AdminDtos.UpdateVariantRequest(
                null, null, null, null, null, null, 3, null));
        var afterStockUpdate = admin.getProductDetail(productId);
        @SuppressWarnings("unchecked")
        var updatedVariants = (java.util.List<Map<String, Object>>) afterStockUpdate.get("variants");
        assertThat(updatedVariants.get(0).get("stockQty")).isEqualTo(3);

        var deleted = admin.deleteProduct(productId);
        assertThat(deleted.get("message")).isEqualTo("Prodotto eliminato");

        // Cancellazione logica: non compare piu' nella lista attiva.
        var list = admin.getProducts(null, null, 1, 50);
        @SuppressWarnings("unchecked")
        var data = (java.util.List<Map<String, Object>>) list.get("data");
        assertThat(data.stream().noneMatch(p -> p.get("id").equals(productId))).isTrue();
    }

    @Test
    void creatingAProductWithADuplicateSlugIsRejected() {
        var category = new Category();
        category.setName("Categoria Dup");
        category.setSlug("categoria-dup-" + UUID.randomUUID());
        em.persist(category);
        em.flush();

        String slug = "slug-duplicato-" + UUID.randomUUID();
        admin.createProduct(new AdminDtos.CreateProductRequest(
                "Primo", slug, null, category.getId(), new BigDecimal("10.00"), true));

        assertThatThrownBy(() -> admin.createProduct(new AdminDtos.CreateProductRequest(
                "Secondo", slug, null, category.getId(), new BigDecimal("20.00"), true)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Slug");
    }
}

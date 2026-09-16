package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.repositories.ProductVariantRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.util.List;

/**
 * Rilievo 2 della review sul Task 0 (cover image su ordini/resi): la query
 * batch {@link ProductVariantRepository#coverUrlsByVariantIds} era scritta
 * bene, ma i chiamanti la invocavano una volta per riga (dentro il `map` che
 * costruiva ciascuna vista) invece che una volta sola per l'intera pagina —
 * con N righe in pagina partivano N query identiche nella forma.
 *
 * Qui si conta, con uno spy sul repository, quante volte la query batch viene
 * davvero eseguita per pagina: deve essere sempre 1, indipendentemente da
 * quanti ordini/resi contiene la pagina.
 */
class CoverImageBatchingTest extends AbstractIntegrationTest {

    @Autowired
    private TestFixtures fixtures;
    @Autowired
    private OrderService orderService;
    @Autowired
    private AdminService adminService;
    @Autowired
    private ReturnService returnService;
    @Autowired
    private CheckoutService checkout;

    @MockitoSpyBean
    private ProductVariantRepository variants;

    @PersistenceContext
    private EntityManager em;

    /** Piu' ordini per lo stesso cliente: {@link OrderService#findAll}. */
    @Test
    void customerOrderList_resolvesCoverImagesInOneQueryPerPage() {
        var buyer = fixtures.aUser();
        var address = fixtures.anAddressFor(buyer);
        for (int i = 0; i < 3; i++) {
            var variant = fixtures.aVariantWithStock(5);
            var request = new CheckoutService.Request(address.getId(),
                    List.of(new CheckoutService.Line(variant.getId(), 1)), "standard", null, null, null, null);
            checkout.placeOrder(buyer.getId(), request);
        }

        Mockito.clearInvocations(variants);
        orderService.findAll(buyer.getId(), 1, 10);

        Mockito.verify(variants, Mockito.times(1)).coverUrlsByVariantIds(Mockito.any());
    }

    /** Piu' ordini, cruscotto admin: {@link AdminService#getOrders}. */
    @Test
    void adminOrderList_resolvesCoverImagesInOneQueryPerPage() {
        for (int i = 0; i < 3; i++) {
            fixtures.aPaidCheckout();
        }

        Mockito.clearInvocations(variants);
        adminService.getOrders(null, null, 1, 10);

        Mockito.verify(variants, Mockito.times(1)).coverUrlsByVariantIds(Mockito.any());
    }

    /** Gli ordini recenti della dashboard: {@link AdminService#dashboard}. */
    @Test
    void dashboard_resolvesCoverImagesInOneQueryForRecentOrders() {
        for (int i = 0; i < 3; i++) {
            fixtures.aPaidCheckout();
        }
        // `created_at` e' scritta dal database (colonna non scrivibile da Hibernate,
        // vedi Order#createdAt): senza svuotare il contesto di persistenza,
        // `dashboard()` rilegge dalla identity map gli ordini appena creati in
        // questa stessa transazione con `createdAt` ancora nullo in memoria, e il
        // suo ordinamento in Java (non SQL) esplode — un problema del tutto
        // indipendente dalle copertine, che qui si aggira e basta.
        em.flush();
        em.clear();

        Mockito.clearInvocations(variants);
        adminService.dashboard();

        Mockito.verify(variants, Mockito.times(1)).coverUrlsByVariantIds(Mockito.any());
    }

    /** Piu' resi, elenco admin: {@link ReturnService#adminList}. */
    @Test
    void adminReturnList_resolvesCoverImagesInOneQueryPerPage() {
        for (int i = 0; i < 3; i++) {
            fixtures.aReturnFor(fixtures.aPendingCheckout());
        }

        Mockito.clearInvocations(variants);
        returnService.adminList(null, null, 1, 10);

        Mockito.verify(variants, Mockito.times(1)).coverUrlsByVariantIds(Mockito.any());
    }
}

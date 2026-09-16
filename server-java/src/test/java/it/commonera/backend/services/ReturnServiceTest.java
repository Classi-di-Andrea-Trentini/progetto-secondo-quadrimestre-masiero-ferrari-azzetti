package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.dtos.ReturnDtos;
import it.commonera.backend.entities.*;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReturnServiceTest extends AbstractIntegrationTest {

    @Autowired
    private TestFixtures fixtures;

    @Autowired
    private UserRepository users;
    @Autowired
    private UserAddressRepository addresses;
    @Autowired
    private ProductVariantRepository variants;
    @Autowired
    private CheckoutService checkout;
    @Autowired
    private ReturnService returnService;
    @Autowired
    private OrderRepository orderRepository;
    @PersistenceContext
    private EntityManager em;

    private User buyer;
    private UserAddress address;
    private ProductVariant variant;
    private UUID orderId;
    private UUID orderItemId;

    @BeforeEach
    void setUp() {
        buyer = new User();
        buyer.setEmail("buyer." + UUID.randomUUID() + "@example.com");
        buyer.setPasswordHash("unused-in-this-test");
        buyer.setFullName("Compratore Prova");
        buyer.setEmailVerifiedAt(LocalDateTime.now());
        buyer = users.save(buyer);

        address = new UserAddress();
        address.setUserId(buyer.getId());
        address.setFullName("Compratore Prova");
        address.setStreet("Via Roma 1");
        address.setCity("Trento");
        address.setPostalCode("38100");
        address = addresses.save(address);

        var category = new Category();
        category.setName("Categoria Prova");
        category.setSlug("categoria-prova-" + UUID.randomUUID());
        em.persist(category);

        var product = new Product();
        product.setCategory(category);
        product.setName("Prodotto Prova");
        product.setSlug("prodotto-prova-" + UUID.randomUUID());
        product.setBasePrice(new BigDecimal("50.00"));
        em.persist(product);

        variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSku("SKU-" + UUID.randomUUID());
        variant.setStockQty(10);
        em.persist(variant);
        em.flush();

        var request = new CheckoutService.Request(
                address.getId(), List.of(new CheckoutService.Line(variant.getId(), 2)),
                "standard", null, null, null, null);
        var result = checkout.placeOrder(buyer.getId(), request);
        orderId = (UUID) result.get("orderId");
        em.flush();
        em.clear();

        orderItemId = orderRepository.findById(orderId).orElseThrow().getItems().get(0).getId();
    }

    /**
     * Porta l'ordine a consegnato passando **davvero** dall'incasso: dalla fase A
     * in poi il checkout lo lascia `pending`, e un ordine consegnato senza un
     * pagamento riuscito e' uno stato che non deve esistere — tant'e' che
     * rimborsarlo, giustamente, viene rifiutato.
     */
    private void markDelivered() {
        fixtures.confirmPaid(orderId);
        var order = orderRepository.findById(orderId).orElseThrow();
        order.setStatus(OrderStatus.delivered);
        orderRepository.save(order);
        em.flush();
        em.clear();
    }

    @Test
    void cannotRequestAReturnBeforeTheOrderIsDeliveredOrCompleted() {
        // Appena creato il checkout l'ordine e' "paid", non ancora consegnato.
        var dto = new ReturnDtos.CreateRequest(orderId, "Non mi piace il colore",
                List.of(new ReturnDtos.ItemRequest(orderItemId, 1)));

        assertThatThrownBy(() -> returnService.create(buyer.getId(), dto))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("delivered or completed");
    }

    @Test
    void createsAReturnForADeliveredOrder() {
        markDelivered();
        var dto = new ReturnDtos.CreateRequest(orderId, "Non mi piace il colore",
                List.of(new ReturnDtos.ItemRequest(orderItemId, 1)));

        var view = returnService.create(buyer.getId(), dto);

        assertThat(view.status()).isEqualTo(OrderReturn.ReturnStatus.requested);
        assertThat(view.items()).hasSize(1);
        assertThat(view.items().get(0).quantity()).isEqualTo(1);
    }

    @Test
    void cannotReturnMoreUnitsThanWerePurchased() {
        markDelivered();
        var dto = new ReturnDtos.CreateRequest(orderId, "Ne voglio restituire troppi",
                List.of(new ReturnDtos.ItemRequest(orderItemId, 99)));

        assertThatThrownBy(() -> returnService.create(buyer.getId(), dto))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Cannot return more than");
    }

    @Test
    void repeatingTheSameOrderItemCannotSmuggleInMoreUnitsThanWerePurchased() {
        markDelivered();
        // Ne sono stati comprati 2. Tre righe da 1 passavano il controllo una per
        // una — il confronto era per riga e non sulla somma — e finivano a
        // database come tre righe di reso separate sullo stesso articolo.
        var dto = new ReturnDtos.CreateRequest(orderId, "Provo a gonfiare il reso",
                List.of(new ReturnDtos.ItemRequest(orderItemId, 1),
                        new ReturnDtos.ItemRequest(orderItemId, 1),
                        new ReturnDtos.ItemRequest(orderItemId, 1)));

        assertThatThrownBy(() -> returnService.create(buyer.getId(), dto))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Cannot return more than");
    }

    @Test
    void duplicateLinesWithinTheAvailableQuantityAreMergedIntoOne() {
        markDelivered();
        // Due righe da 1 su 2 pezzi comprati sono legittime: vanno accettate, ma
        // fuse in una sola riga da 2 — non due righe da 1.
        var dto = new ReturnDtos.CreateRequest(orderId, "Restituisco entrambi i pezzi",
                List.of(new ReturnDtos.ItemRequest(orderItemId, 1),
                        new ReturnDtos.ItemRequest(orderItemId, 1)));

        var view = returnService.create(buyer.getId(), dto);

        assertThat(view.items()).hasSize(1);
        assertThat(view.items().get(0).quantity()).isEqualTo(2);
    }

    @Test
    void aSecondReturnRequestOnTheSameOrderIsRejectedWhileOneIsAlreadyPending() {
        markDelivered();
        var dto = new ReturnDtos.CreateRequest(orderId, "Prima richiesta di reso",
                List.of(new ReturnDtos.ItemRequest(orderItemId, 1)));
        returnService.create(buyer.getId(), dto);
        em.flush();
        em.clear();

        assertThatThrownBy(() -> returnService.create(buyer.getId(), dto))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void anotherCustomerCannotSeeSomeoneElsesReturn() {
        markDelivered();
        var created = returnService.create(buyer.getId(), new ReturnDtos.CreateRequest(orderId, "Reso di prova",
                List.of(new ReturnDtos.ItemRequest(orderItemId, 1))));
        em.flush();
        em.clear();

        var strangerToSave = new User();
        strangerToSave.setEmail("stranger." + UUID.randomUUID() + "@example.com");
        strangerToSave.setPasswordHash("unused-in-this-test");
        strangerToSave.setFullName("Estraneo");
        var stranger = users.save(strangerToSave);

        assertThatThrownBy(() -> returnService.findOne(stranger.getId(), created.id()))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void adminCanUpdateStatusAndSetsResolvedAtWhenRefunded() {
        markDelivered();
        var created = returnService.create(buyer.getId(), new ReturnDtos.CreateRequest(orderId, "Reso di prova",
                List.of(new ReturnDtos.ItemRequest(orderItemId, 1))));
        em.flush();
        em.clear();

        var updated = returnService.updateStatus(created.id(),
                new ReturnDtos.UpdateStatusRequest(OrderReturn.ReturnStatus.refunded, "Rimborsato via bonifico",
                        new BigDecimal("50.00")));

        assertThat(updated.status()).isEqualTo(OrderReturn.ReturnStatus.refunded);
        assertThat(updated.adminNote()).isEqualTo("Rimborsato via bonifico");
        assertThat(updated.refundAmount()).isEqualByComparingTo("50.00");
        assertThat(updated.resolvedAt()).isNotNull();
    }
}

package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.repositories.ProductVariantRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La merce torna a magazzino con un solo UPDATE.
 *
 * Finche' l'unico a restituire giacenza era `OrderService.cancel`, chiamato dalla
 * richiesta del cliente, un leggi-modifica-scrivi bastava. Da qui in avanti
 * compensano anche il webhook del fornitore e il raccoglitore degli ordini
 * abbandonati: due thread che non sono la richiesta di nessuno e che possono
 * incrociarsi sullo stesso ordine, perdendo un incremento.
 */
class StockRestoreTest extends AbstractIntegrationTest {

    @Autowired
    private ProductVariantRepository variants;
    @Autowired
    private TestFixtures fixtures;
    @PersistenceContext
    private EntityManager em;

    @Test
    void incrementStockAddsTheQuantityBack() {
        var variant = fixtures.aVariantWithStock(3);

        assertThat(variants.incrementStock(variant.getId(), 2)).isEqualTo(1);

        em.clear();
        assertThat(variants.findById(variant.getId()).orElseThrow().getStockQty()).isEqualTo(5);
    }

    @Test
    void incrementStockReportsZeroRowsForAnUnknownVariant() {
        assertThat(variants.incrementStock(UUID.randomUUID(), 1)).isZero();
    }
}

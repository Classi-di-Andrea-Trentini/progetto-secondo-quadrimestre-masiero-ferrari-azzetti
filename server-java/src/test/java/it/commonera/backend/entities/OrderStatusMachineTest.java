package it.commonera.backend.entities;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le proprieta' del grafo, non la sua trascrizione riga per riga: un test che
 * ricopiasse la tabella fallirebbe a ogni modifica legittima senza dire mai
 * niente di utile. Qui si fissa cio' che **non deve** cambiare.
 */
class OrderStatusMachineTest {

    /** Un ordine chiuso resta chiuso: e' l'invariante che tiene in piedi il resto. */
    @Test
    void closedStatesHaveNoWayOut() {
        for (OrderStatus target : OrderStatus.values()) {
            assertThat(OrderStatusMachine.allows(OrderStatus.cancelled, target))
                    .as("cancelled -> %s", target).isFalse();
            assertThat(OrderStatusMachine.allows(OrderStatus.refunded, target))
                    .as("refunded -> %s", target).isFalse();
        }
    }

    /** Quello che l'amministratore puo' fare e' sempre anche ammesso dal dominio. */
    @Test
    void theAdminGraphIsContainedInTheDomainGraph() {
        for (OrderStatus from : OrderStatus.values()) {
            for (OrderStatus to : OrderStatusMachine.adminTargetsFrom(from)) {
                assertThat(OrderStatusMachine.allows(from, to))
                        .as("%s -> %s ammessa all'admin ma non al dominio", from, to).isTrue();
            }
        }
    }

    /**
     * I due passaggi che muovono denaro non si comandano da un PATCH: `paid` lo
     * dichiara il fornitore col webhook, `refunded` lo registra il percorso dei
     * resi insieme al rimborso vero.
     */
    @Test
    void theAdminCanNeverReachPaidOrRefunded() {
        for (OrderStatus from : OrderStatus.values()) {
            assertThat(OrderStatusMachine.adminTargetsFrom(from))
                    .as("da %s", from)
                    .doesNotContain(OrderStatus.paid, OrderStatus.refunded);
        }
    }

    /** Il webhook, invece, quel passaggio lo deve avere. */
    @Test
    void theProviderCanConfirmAPendingOrder() {
        assertThat(OrderStatusMachine.allows(OrderStatus.pending, OrderStatus.paid)).isTrue();
    }

    /**
     * Gli stati annullabili sono esattamente quelli in cui la merce non e'
     * ancora partita. Da `shipped` in poi si rimborsa, non si annulla.
     */
    @Test
    void onlyOrdersStillInTheWarehouseCanBeCancelled() {
        assertThat(OrderStatusMachine.cancellableFrom())
                .containsExactlyInAnyOrder(OrderStatus.pending, OrderStatus.paid, OrderStatus.processing);
    }
}

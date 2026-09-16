package it.commonera.backend.repositories;

import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {
    Page<Order> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    /** Senza pagina: l'export dei dati personali li deve contenere tutti. */
    List<Order> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<Order> findByIdAndUserId(UUID id, UUID userId);
    long countByInvoiceNumberStartingWith(String prefix);

    /**
     * Transizione di stato **condizionale**: senza `@Version` sull'ordine, due
     * `cancel()` concorrenti sullo stesso ordine leggerebbero entrambi uno
     * stato annullabile e rimborserebbero entrambi buono regalo e punti. Se
     * qui non viene toccata nessuna riga, qualcun altro e' arrivato prima (o
     * l'ordine non era piu' annullabile), e chi chiama non deve procedere col
     * rimborso.
     */
    /** Ordini fermi in uno stato oltre la loro finestra: li raccoglie il reaper. */
    @Query("select o from Order o where o.status = :status and o.createdAt < :before")
    List<Order> findStaleByStatus(@Param("status") OrderStatus status,
                                  @Param("before") LocalDateTime before);

    @Modifying
    @Query("update Order o set o.status = :newStatus where o.id = :id and o.status in :from")
    int updateStatusIfCurrentIn(@Param("id") UUID id, @Param("newStatus") OrderStatus newStatus,
                                 @Param("from") Collection<OrderStatus> from);
}

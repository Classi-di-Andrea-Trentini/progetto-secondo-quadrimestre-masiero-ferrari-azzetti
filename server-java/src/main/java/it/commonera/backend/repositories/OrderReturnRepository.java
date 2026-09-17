package it.commonera.backend.repositories;

import it.commonera.backend.entities.OrderReturn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderReturnRepository extends JpaRepository<OrderReturn, UUID>, JpaSpecificationExecutor<OrderReturn> {
    List<OrderReturn> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<OrderReturn> findByIdAndUserId(UUID id, UUID userId);

    /** Un solo reso "vivo" per ordine: i rifiutati non contano piu' come esistenti. */
    boolean existsByOrderIdAndStatusNot(UUID orderId, OrderReturn.ReturnStatus status);
}

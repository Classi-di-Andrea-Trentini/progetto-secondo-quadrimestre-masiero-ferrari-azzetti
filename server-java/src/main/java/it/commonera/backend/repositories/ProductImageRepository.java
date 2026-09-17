package it.commonera.backend.repositories;

import it.commonera.backend.entities.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductImageRepository extends JpaRepository<ProductImage, UUID> {
    List<ProductImage> findByProductIdOrderBySortOrderAsc(UUID productId);
    Optional<ProductImage> findByIdAndProductId(UUID id, UUID productId);
    long countByProductId(UUID productId);
    Optional<ProductImage> findFirstByProductIdOrderBySortOrderAsc(UUID productId);

    @Modifying
    @Query("update ProductImage i set i.isCover = false where i.product.id = :productId")
    void clearCover(@Param("productId") UUID productId);
}

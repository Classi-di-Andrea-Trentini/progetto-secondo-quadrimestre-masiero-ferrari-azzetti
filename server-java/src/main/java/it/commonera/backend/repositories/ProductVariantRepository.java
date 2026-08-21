package it.commonera.backend.repositories;

import it.commonera.backend.entities.ProductVariant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, UUID> {

    List<ProductVariant> findByProductId(UUID productId);
    Optional<ProductVariant> findByIdAndProductId(UUID id, UUID productId);
    Optional<ProductVariant> findBySkuIgnoreCase(String sku);
    boolean existsBySkuIgnoreCase(String sku);

    /**
     * Decremento **condizionale** della giacenza.
     *
     * Il controllo fatto prima non basta: due checkout sull'ultimo pezzo leggono
     * entrambi `stockQty = 1` e scalano entrambi, lasciando -1. Qui la riga viene
     * toccata solo se la merce c'e' ancora nel momento della scrittura, e un
     * risultato `0` significa che qualcun altro e' arrivato prima.
     */
    @Modifying
    @Query("update ProductVariant v set v.stockQty = v.stockQty - :qty " +
           "where v.id = :id and v.stockQty >= :qty")
    int decrementStock(@Param("id") UUID id, @Param("qty") int qty);
}

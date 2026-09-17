package it.commonera.backend.repositories;

import it.commonera.backend.entities.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * `JpaSpecificationExecutor` perche' la lista prodotti ha molti filtri opzionali
 * (categoria, marca, prezzo, colore, taglia, ricerca): comporre una Specification
 * evita la scala di query diverse per ogni combinazione.
 */
public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {
    Optional<Product> findBySlugAndDeletedAtIsNull(String slug);
    Optional<Product> findBySlug(String slug);
    boolean existsBySlug(String slug);

    /**
     * Quanti prodotti attivi per categoria. Serve alla barra dei filtri: contare in
     * Java caricando tutto il catalogo funziona con 24 prodotti e smette di funzionare
     * con 24.000.
     */
    @Query("select p.category.id, count(p) from Product p " +
           "where p.isActive = true and p.deletedAt is null group by p.category.id")
    List<Object[]> countActiveByCategory();

    @Query("select p.brand, count(p) from Product p " +
           "where p.isActive = true and p.deletedAt is null and p.brand is not null " +
           "group by p.brand order by count(p) desc")
    List<Object[]> countActiveByBrand();

    @Query("select min(p.basePrice), max(p.basePrice) from Product p " +
           "where p.isActive = true and p.deletedAt is null")
    List<Object[]> activePriceRange();

    List<Product> findByIdInAndIsActiveTrueAndDeletedAtIsNull(Collection<UUID> ids);
}

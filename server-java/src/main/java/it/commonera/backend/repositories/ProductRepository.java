package it.commonera.backend.repositories;

import it.commonera.backend.entities.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.UUID;

/**
 * `JpaSpecificationExecutor` perche' la lista prodotti ha molti filtri opzionali
 * (categoria, marca, prezzo, colore, taglia, ricerca): comporre una Specification
 * evita la scala di query diverse per ogni combinazione.
 */
public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {
    Optional<Product> findBySlugAndDeletedAtIsNull(String slug);
}

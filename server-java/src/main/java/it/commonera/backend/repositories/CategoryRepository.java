package it.commonera.backend.repositories;

import it.commonera.backend.entities.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    /** Categorie visibili a catalogo, nell'ordine deciso dal negozio. */
    List<Category> findByIsActiveTrueOrderBySortOrderAscNameAsc();

    List<Category> findAllByOrderBySortOrderAscNameAsc();

    Optional<Category> findBySlugIgnoreCase(String slug);

    boolean existsBySlugIgnoreCase(String slug);
}

package it.commonera.backend.repositories;

import it.commonera.backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);

    /** Per la ricerca testuale nella lista ordini/resi in admin: prima si trovano gli utenti, poi si filtrano gli ordini per id. */
    List<User> findByEmailContainingIgnoreCaseOrFullNameContainingIgnoreCase(String email, String fullName);

    long countByRoleAndDeletedAtIsNullAndIsActiveTrue(User.Role role);
}

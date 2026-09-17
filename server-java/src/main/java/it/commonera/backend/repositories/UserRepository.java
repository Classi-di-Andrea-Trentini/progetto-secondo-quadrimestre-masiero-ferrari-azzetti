package it.commonera.backend.repositories;

import it.commonera.backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmailIgnoreCase(String email);

    /**
     * L'account collegato a un'identita' Google.
     *
     * Si cerca per `sub` e non per email perche' e' l'unico identificativo che Google
     * garantisce stabile: l'indirizzo puo' cambiare sotto lo stesso account.
     */
    Optional<User> findByGoogleSub(String googleSub);
    boolean existsByEmailIgnoreCase(String email);

    /** Per la ricerca testuale nella lista ordini/resi in admin: prima si trovano gli utenti, poi si filtrano gli ordini per id. */
    List<User> findByEmailContainingIgnoreCaseOrFullNameContainingIgnoreCase(String email, String fullName);

    long countByRoleAndDeletedAtIsNullAndIsActiveTrue(User.Role role);
}

package it.commonera.backend.dtos;

import it.commonera.backend.entities.User;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * L'utente come lo vede il frontend.
 *
 * Contiene **tutti** i campi che il frontend usa: nel backend Node era gia' successo
 * che una risposta parziale lasciasse il segnale con valori nulli fino al refresh
 * della pagina. Non contiene mai `passwordHash`.
 *
 * `birthDate`, `gender` e `newsletterOptIn` mancavano: la scheda profilo li mostrava
 * sempre vuoti ("—") anche subito dopo averli salvati, perche' la risposta non li
 * riportava indietro.
 */
public record UserResponse(
        UUID id,
        String email,
        String fullName,
        String role,
        String avatarUrl,
        String phone,
        LocalDate birthDate,
        String gender,
        Boolean newsletterOptIn,
        LocalDateTime emailVerifiedAt,
        LocalDateTime createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole().name(),
                user.getAvatarUrl(),
                user.getPhone(),
                user.getBirthDate(),
                user.getGender(),
                user.getNewsletterOptIn(),
                user.getEmailVerifiedAt(),
                user.getCreatedAt());
    }
}

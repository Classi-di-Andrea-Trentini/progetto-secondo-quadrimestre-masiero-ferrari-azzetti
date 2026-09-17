package it.commonera.backend.dtos;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Corpi delle richieste dell'area profilo, con gli stessi vincoli del backend Node. */
public class UserDtos {

    /** Tutti i campi sono opzionali: la form di /me manda solo quelli che tocca. */
    public record UpdateProfileRequest(
            @Size(min = 2, max = 255) String fullName,
            @Size(max = 30) String phone,
            String birthDate,
            @Size(max = 20) String gender,
            Boolean newsletterOptIn) {}

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 72) String currentPassword,
            @NotBlank
            @Size(min = 8, max = 72, message = "must be longer than or equal to 8 characters")
            @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*$",
                    message = "The new password must contain at least one lowercase letter, one uppercase letter and one number")
            String newPassword) {}

    public record ChangeEmailRequest(
            @Email(message = "must be an email") @NotBlank @Size(max = 255) String newEmail,
            @NotBlank @Size(max = 72) String currentPassword) {}

    public record ForgotPasswordRequest(
            @Email(message = "must be an email") @NotBlank String email) {}

    public record ResetPasswordRequest(
            @NotBlank String token,
            @NotBlank
            @Size(min = 8, max = 72, message = "must be longer than or equal to 8 characters")
            @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*$",
                    message = "The password must contain at least one lowercase letter, one uppercase letter and one number")
            String password) {}
}

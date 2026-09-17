package it.commonera.backend.dtos;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Corpi delle richieste di autenticazione, con gli stessi vincoli del backend Node. */
public class AuthDtos {

    public record RegisterRequest(
            @Email(message = "must be an email") @NotBlank String email,
            @NotBlank @Size(min = 8, message = "must be longer than or equal to 8 characters") String password,
            @NotBlank @Size(min = 2, max = 255) String fullName) {}

    public record LoginRequest(
            @Email(message = "must be an email") @NotBlank String email,
            @NotBlank String password) {}
}

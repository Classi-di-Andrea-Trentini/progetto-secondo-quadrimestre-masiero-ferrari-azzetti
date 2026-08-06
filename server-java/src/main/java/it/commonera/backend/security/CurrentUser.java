package it.commonera.backend.security;

import it.commonera.backend.entities.User;

import java.util.UUID;

/** L'utente della richiesta in corso, messo nel contesto di sicurezza dal filtro. */
public record CurrentUser(UUID id, String email, User.Role role, UUID sessionId) {
    public boolean isAdmin() {
        return role == User.Role.admin;
    }
}

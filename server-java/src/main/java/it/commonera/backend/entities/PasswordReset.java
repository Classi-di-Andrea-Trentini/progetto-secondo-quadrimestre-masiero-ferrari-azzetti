package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Richiesta di reimpostazione password.
 *
 * Nel database finisce **l'hash** del token, non il token: la tabella la puo' leggere
 * chiunque abbia accesso al backup, e da un hash non si torna indietro al link da
 * cliccare. Stessa scelta del backend Node, che scrive le stesse righe.
 */
@Entity
@Table(name = "password_resets")
@Getter
@Setter
public class PasswordReset {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}

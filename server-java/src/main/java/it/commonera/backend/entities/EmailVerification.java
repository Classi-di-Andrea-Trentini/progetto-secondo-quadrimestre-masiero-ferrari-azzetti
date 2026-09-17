package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Token di verifica dell'indirizzo email, usato sia per confermare l'email della
 * registrazione sia per confermare un cambio di indirizzo.
 *
 * La riga serve a rendere il token **usabile una volta sola**: la firma del JWT dice
 * che il contenuto e' autentico, non che il link non e' gia' stato cliccato.
 */
@Entity
@Table(name = "email_verifications")
@Getter
@Setter
public class EmailVerification {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}

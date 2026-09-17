package it.commonera.backend.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Sessione associata a un JWT.
 *
 * Il token da solo non basta a decidere se qualcuno e' ancora dentro: senza una
 * riga qui il logout non potrebbe invalidare nulla, perche' un JWT firmato resta
 * valido finche' non scade.
 */
@Entity
@Table(name = "sessions")
@Getter
@Setter
public class Session {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    // `ip_address` e' di tipo `inet`, non varchar: mapparlo come stringa fa fallire
    // ogni inserimento. Qui non serve, quindi resta fuori dall'entita' — `validate`
    // controlla che le colonne dichiarate esistano, non il contrario.

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public boolean isExpired() {
        return expiresAt.isBefore(LocalDateTime.now());
    }
}

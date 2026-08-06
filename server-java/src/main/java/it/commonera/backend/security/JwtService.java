package it.commonera.backend.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Firma e verifica dei JWT, piu' l'impronta con cui la sessione viene ritrovata.
 *
 * Nel database non finisce il token ma il suo **hash**: chi legge la tabella
 * `sessions` non deve poter impersonare nessuno. E' la stessa scelta del backend
 * Node, e va mantenuta perche' i due condividono le righe.
 */
@Service
public class JwtService {

    private final String secret;
    private final long ttlDays;
    private SecretKey key;

    public JwtService(
            @Value("${app.jwt.secret:}") String secret,
            @Value("${app.jwt.ttl-days:7}") long ttlDays) {
        this.secret = secret;
        this.ttlDays = ttlDays;
    }

    /**
     * Meglio non partire affatto che partire firmando con un segreto vuoto o
     * indovinabile: un backend che accetta token falsificabili e' peggio di uno
     * spento, perche' sembra funzionare.
     */
    @PostConstruct
    void validateSecret() {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET mancante o piu' corto di 32 caratteri: generane uno con `openssl rand -base64 64`");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String issue(UUID userId, UUID sessionId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .claim("sid", sessionId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(ttlDays * 86_400)))
                .signWith(key)
                .compact();
    }

    /** `null` se il token e' scaduto, manomesso o semplicemente non e' un JWT. */
    public Claims parse(String token) {
        try {
            var body = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return new Claims(
                    UUID.fromString(body.getSubject()),
                    UUID.fromString(body.get("sid", String.class)));
        } catch (Exception ignored) {
            return null;
        }
    }

    /** SHA-256 del token: e' l'impronta salvata in `sessions.token_hash`. */
    public String fingerprint(String token) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 non disponibile", e);
        }
    }

    public long ttlSeconds() {
        return ttlDays * 86_400;
    }

    public record Claims(UUID userId, UUID sessionId) {}
}

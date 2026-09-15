package it.commonera.backend.security;

import org.springframework.http.ResponseCookie;

import java.time.Duration;

/**
 * Il cookie di sessione, in un posto solo.
 *
 * Login, logout e cancellazione dell'account devono scrivere **esattamente** gli
 * stessi attributi: un `path` o un `sameSite` diverso fra chi lo crea e chi lo
 * cancella lascia nel browser un cookie che nessuno riesce piu' a togliere.
 */
public final class AuthCookie {

    private AuthCookie() {}

    /** Il cookie che tiene dentro l'utente. */
    public static ResponseCookie session(String token, long maxAgeSeconds, boolean secure) {
        return build(token, maxAgeSeconds, secure);
    }

    /**
     * Il cookie svuotato e gia' scaduto.
     *
     * Cancellare la sessione lato server non basta se il browser continua a mandare
     * il vecchio valore a ogni richiesta.
     */
    public static ResponseCookie cleared(boolean secure) {
        return build("", 0, secure);
    }

    private static ResponseCookie build(String value, long maxAge, boolean secure) {
        return ResponseCookie.from(JwtCookieFilter.COOKIE_NAME, value)
                // HttpOnly: un token leggibile da JavaScript e' un token rubabile con
                // una sola XSS.
                .httpOnly(true)
                // Secure e' pilotato da COOKIE_SECURE, non fisso: acceso qui sopra
                // HTTPS il browser smette di mandare il cookie su http:// (SSL strip
                // e sniffing in chiaro), ma acceso su un deploy in HTTP — la LAN di
                // classe, http://<host>:4200 — il cookie sparisce e il login smette
                // di funzionare senza un solo messaggio d'errore. Va acceso insieme
                // al reverse proxy TLS, non prima.
                .secure(secure)
                .path("/")
                .sameSite("Lax")
                .maxAge(Duration.ofSeconds(maxAge))
                .build();
    }
}

package it.commonera.backend.controllers;

import it.commonera.backend.dtos.AuthDtos;
import it.commonera.backend.dtos.UserResponse;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.UserRepository;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.security.JwtCookieFilter;
import it.commonera.backend.services.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService auth;
    private final UserRepository users;
    private final long ttlSeconds;
    private final boolean secureCookies;

    public AuthController(AuthService auth, UserRepository users,
                          it.commonera.backend.security.JwtService jwt,
                          @Value("${app.cookie.secure:false}") boolean secureCookies) {
        this.auth = auth;
        this.users = users;
        this.ttlSeconds = jwt.ttlSeconds();
        this.secureCookies = secureCookies;
    }

    @PostMapping("/register")
    public Map<String, Object> register(@Valid @RequestBody AuthDtos.RegisterRequest body) {
        var user = auth.register(body.email(), body.password(), body.fullName());
        return Map.of("message", "Registrazione completata", "user", UserResponse.from(user));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @Valid @RequestBody AuthDtos.LoginRequest body,
            HttpServletRequest request) {

        var issued = auth.login(body.email(), body.password(), request.getHeader("User-Agent"));

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie(issued.token(), ttlSeconds).toString())
                .body(Map.of("user", UserResponse.from(issued.user())));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request) {
        auth.logout(readToken(request));
        // Cookie svuotato e scaduto: cancellarlo lato server non basta se il browser
        // continua a mandarlo.
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie("", 0).toString())
                .body(Map.of("message", "Logout effettuato"));
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal CurrentUser current) {
        if (current == null) throw ApiException.unauthorized("Unauthorized");
        return users.findById(current.id())
                .map(UserResponse::from)
                .orElseThrow(() -> ApiException.unauthorized("Unauthorized"));
    }

    private ResponseCookie cookie(String value, long maxAge) {
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
                .secure(secureCookies)
                .path("/")
                .sameSite("Lax")
                .maxAge(Duration.ofSeconds(maxAge))
                .build();
    }

    private String readToken(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (var c : request.getCookies()) {
            if (JwtCookieFilter.COOKIE_NAME.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}

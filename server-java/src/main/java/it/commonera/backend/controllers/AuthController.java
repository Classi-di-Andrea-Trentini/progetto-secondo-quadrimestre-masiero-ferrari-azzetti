package it.commonera.backend.controllers;

import it.commonera.backend.dtos.AuthDtos;
import it.commonera.backend.dtos.UserDtos;
import it.commonera.backend.dtos.UserResponse;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.UserRepository;
import it.commonera.backend.security.AuthCookie;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.security.JwtCookieFilter;
import it.commonera.backend.services.AuthService;
import it.commonera.backend.services.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService auth;
    private final UserRepository users;
    private final UserService profiles;
    private final long ttlSeconds;
    private final boolean secureCookies;

    public AuthController(AuthService auth, UserRepository users, UserService profiles,
                          it.commonera.backend.security.JwtService jwt,
                          @Value("${app.cookie.secure:false}") boolean secureCookies) {
        this.auth = auth;
        this.users = users;
        this.profiles = profiles;
        this.ttlSeconds = jwt.ttlSeconds();
        this.secureCookies = secureCookies;
    }

    @PostMapping("/register")
    public Map<String, Object> register(@Valid @RequestBody AuthDtos.RegisterRequest body) {
        var user = auth.register(body.email(), body.password(), body.fullName());
        return Map.of("message", "Registration completed", "user", UserResponse.from(user));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @Valid @RequestBody AuthDtos.LoginRequest body,
            HttpServletRequest request) {

        var issued = auth.login(body.email(), body.password(), request.getHeader("User-Agent"));

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        AuthCookie.session(issued.token(), ttlSeconds, secureCookies).toString())
                .body(Map.of("user", UserResponse.from(issued.user())));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request) {
        auth.logout(readToken(request));
        // Cookie svuotato e scaduto: cancellarlo lato server non basta se il browser
        // continua a mandarlo.
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, AuthCookie.cleared(secureCookies).toString())
                .body(Map.of("message", "Logged out"));
    }

    /**
     * Richiesta di reimpostazione password.
     *
     * Risponde sempre lo stesso messaggio, esista o no l'indirizzo: distinguere i due
     * casi regalerebbe a chiunque un modo di sapere chi e' cliente.
     */
    @PostMapping("/forgot-password")
    public Map<String, Object> forgotPassword(@Valid @RequestBody UserDtos.ForgotPasswordRequest body) {
        profiles.requestPasswordReset(body.email());
        return Map.of("message", "If this address is registered, you'll receive an email with instructions.");
    }

    @PostMapping("/reset-password")
    public Map<String, Object> resetPassword(@Valid @RequestBody UserDtos.ResetPasswordRequest body) {
        return Map.of("message", profiles.resetPassword(body.token(), body.password()));
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal CurrentUser current) {
        if (current == null) throw ApiException.unauthorized("Unauthorized");
        return users.findById(current.id())
                .map(UserResponse::from)
                .orElseThrow(() -> ApiException.unauthorized("Unauthorized"));
    }

    private String readToken(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (var c : request.getCookies()) {
            if (JwtCookieFilter.COOKIE_NAME.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}

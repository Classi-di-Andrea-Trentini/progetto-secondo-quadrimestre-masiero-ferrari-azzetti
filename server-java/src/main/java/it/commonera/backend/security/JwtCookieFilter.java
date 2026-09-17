package it.commonera.backend.security;

import it.commonera.backend.repositories.SessionRepository;
import it.commonera.backend.repositories.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Riconosce l'utente dal cookie HttpOnly.
 *
 * Il token da solo non basta: si controlla anche che la **sessione esista ancora**
 * e non sia scaduta. Senza quel passaggio il logout non avrebbe alcun effetto, dato
 * che un JWT firmato resta valido fino alla scadenza anche dopo che l'utente ha
 * chiuso tutto.
 */
@Component
public class JwtCookieFilter extends OncePerRequestFilter {

    /** Stesso nome usato dal backend Node: i due devono riconoscere lo stesso cookie. */
    public static final String COOKIE_NAME = "access_token";

    private final JwtService jwt;
    private final SessionRepository sessions;
    private final UserRepository users;

    public JwtCookieFilter(JwtService jwt, SessionRepository sessions, UserRepository users) {
        this.jwt = jwt;
        this.sessions = sessions;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String token = readCookie(request);
        if (token != null) {
            var claims = jwt.parse(token);
            if (claims != null) {
                sessions.findByTokenHash(jwt.fingerprint(token))
                        .filter(session -> !session.isExpired())
                        .flatMap(session -> users.findById(claims.userId())
                                .filter(user -> user.getIsActive() && user.getDeletedAt() == null)
                                .map(user -> new CurrentUser(user.getId(), user.getEmail(), user.getRole(), session.getId())))
                        .ifPresent(this::authenticate);
            }
        }

        chain.doFilter(request, response);
    }

    private void authenticate(CurrentUser user) {
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.role().name().toUpperCase()));
        var auth = new UsernamePasswordAuthenticationToken(user, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private String readCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (var cookie : request.getCookies()) {
            if (COOKIE_NAME.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }
}

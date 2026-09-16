package it.commonera.backend.config;

import it.commonera.backend.security.JwtCookieFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final String frontendUrl;

    public SecurityConfig(@Value("${app.frontend-url}") String frontendUrl) {
        this.frontendUrl = frontendUrl;
    }

    /**
     * BCrypt con lo stesso costo del backend Node: i due leggono gli **stessi**
     * hash dalla stessa tabella, quindi l'algoritmo non e' una scelta libera.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtCookieFilter jwtFilter) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Niente CSRF token: l'autenticazione e' un cookie SameSite=Lax e
                // l'API e' consumata da un frontend sullo stesso sito.
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Catalogo e recensioni sono pubblici: sono le pagine che devono
                        // essere indicizzate.
                        .requestMatchers(HttpMethod.GET, "/products/**", "/reviews/product/**").permitAll()
                        // Le foto prodotto caricate dall'admin: senza questa riga
                        // rispondevano 401 a chi non era collegato, cioe' proprio ai
                        // clienti che devono vedere la merce. Solo GET: caricarle
                        // resta una rotta /admin/**.
                        .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                        .requestMatchers("/auth/register", "/auth/login").permitAll()
                        // Password dimenticata e conferma dell'indirizzo email: ci si
                        // arriva **senza** essere collegati, e' tutto il loro senso.
                        .requestMatchers("/auth/forgot-password", "/auth/reset-password").permitAll()
                        .requestMatchers(HttpMethod.GET, "/users/verify-email/**", "/users/confirm-email/**").permitAll()
                        // Chiunque puo' iscriversi, anche senza account: stesso comportamento
                        // pubblico del backend Node (nessun JwtAuthGuard su questa rotta).
                        .requestMatchers("/newsletter/subscribe").permitAll()
                        // Il webhook non ha sessione: lo autentica la firma del
                        // fornitore, verificata dentro il service. Lasciarlo dietro
                        // authenticated() lo renderebbe irraggiungibile.
                        .requestMatchers(HttpMethod.POST, "/payments/webhook").permitAll()
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        // Senza questo Spring risponde 403 a chi non e' autenticato,
                        // mentre il backend Node risponde 401 — e il frontend usa il 401
                        // per capire che deve mandare al login.
                        .authenticationEntryPoint((request, response, authException) ->
                                writeError(response, 401, "Unauthorized"))
                        .accessDeniedHandler((request, response, denied) ->
                                writeError(response, 403, "Forbidden")))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /** Stessa forma di errore del backend Node: `{ message, error, statusCode }`. */
    private static void writeError(jakarta.servlet.http.HttpServletResponse response, int status, String message)
            throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"message\":\"" + message + "\",\"error\":\"" + message + "\",\"statusCode\":" + status + "}");
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        var config = new CorsConfiguration();
        // Origine esplicita e non `*`: con `allowCredentials` il carattere jolly
        // non e' ammesso, ed e' il cookie a portare l'autenticazione.
        config.setAllowedOrigins(List.of(frontendUrl));
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}

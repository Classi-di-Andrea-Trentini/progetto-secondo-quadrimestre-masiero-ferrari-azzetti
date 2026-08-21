package it.commonera.backend.services;

import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Iscrizione alla newsletter.
 *
 * Stesso limite del backend Node: non esiste una tabella di iscritti separata,
 * solo il flag `newsletter_opt_in` su `users`. Un'email che non corrisponde a un
 * account riceve comunque la mail di conferma ma non lascia traccia persistita —
 * e' cosi' anche in Node, non e' un buco introdotto qui.
 */
@Service
public class NewsletterService {

    private final UserRepository users;
    private final MailService mail;

    public NewsletterService(UserRepository users, MailService mail) {
        this.users = users;
        this.mail = mail;
    }

    @Transactional
    public Map<String, String> subscribe(String rawEmail) {
        if (rawEmail == null || !rawEmail.contains("@")) throw ApiException.badRequest("Invalid email");
        String email = rawEmail.trim().toLowerCase();

        var user = users.findByEmailIgnoreCase(email).orElse(null);
        if (user != null) {
            if (Boolean.TRUE.equals(user.getNewsletterOptIn())) {
                throw ApiException.badRequest("This email is already subscribed.");
            }
            user.setNewsletterOptIn(true);
            users.save(user);
            mail.sendNewsletterConfirmation(email, user.getFullName());
        } else {
            mail.sendNewsletterConfirmation(email, email.split("@")[0]);
        }

        return Map.of("message", "Subscription confirmed — check your inbox!");
    }
}

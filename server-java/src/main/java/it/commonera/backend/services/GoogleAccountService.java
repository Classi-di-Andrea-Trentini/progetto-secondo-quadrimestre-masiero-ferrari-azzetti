package it.commonera.backend.services;

import it.commonera.backend.entities.User;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Da un'identita' Google a una sessione nostra.
 *
 * <h2>Le regole di fusione, e perche' sono queste</h2>
 *
 * <ol>
 *   <li><b>Google deve aver verificato l'indirizzo.</b> Con
 *       {@code email_verified: false} nemmeno Google sa se quella casella e' di chi
 *       sta entrando: sarebbe un campo scritto a mano, e su quel campo si decide
 *       dentro quale account far entrare qualcuno.</li>
 *   <li><b>Si cerca prima per {@code sub}.</b> E' l'unico identificativo stabile.
 *       Se l'utente cambia indirizzo su Google, deve ritrovare il suo account, non
 *       trovarsene uno nuovo.</li>
 *   <li><b>Email gia' presente e <i>verificata</i> da noi → si collegano.</b> Sono
 *       due prove indipendenti dello stesso possesso: noi abbiamo mandato un link a
 *       quella casella e qualcuno l'ha aperto, Google dice la stessa cosa.</li>
 *   <li><b>Email gia' presente ma <i>non</i> verificata → si rifiuta.</b> E' il
 *       punto in cui si perde un account. Chiunque puo' registrare l'indirizzo di un
 *       altro senza mai aprirlo: se bastasse l'indirizzo per collegare, al primo
 *       "Accedi con Google" della vittima il suo account Google finirebbe dentro
 *       l'account di chi ha registrato per primo. Si dice di entrare con la password
 *       e di collegare Google dal profilo, cioe' dall'unico posto in cui a
 *       dimostrare chi sei e' gia' stata la sessione.</li>
 *   <li><b>Email gia' collegata a un <i>altro</i> account Google → si rifiuta.</b>
 *       O l'indirizzo e' stato riassegnato, o qualcuno sta provando a scavalcare un
 *       collegamento esistente. In entrambi i casi non si sovrascrive da soli.</li>
 *   <li><b>Account cancellato o disattivato → si rifiuta.</b> Un account sospeso da
 *       un amministratore non deve poter rientrare da una porta laterale.</li>
 * </ol>
 *
 * Quello che questo servizio <b>non</b> fa: non cambia mai l'email, il nome o la
 * password di un account che esiste gia'. Google si collega a un profilo, non lo
 * riscrive — altrimenti chi controlla l'account Google controllerebbe anche i dati
 * del nostro.
 */
@Service
public class GoogleAccountService {

    private final UserRepository users;
    private final AuthService auth;

    public GoogleAccountService(UserRepository users, AuthService auth) {
        this.users = users;
        this.auth = auth;
    }

    /**
     * Entra (o registra) con Google e restituisce la sessione, nella stessa forma
     * del login con password: da qui in avanti il resto del backend non distingue
     * piu' come si e' entrati.
     */
    @Transactional
    public AuthService.Issued signIn(GoogleIdentity identity, String userAgent) {
        if (identity == null || identity.sub() == null || identity.sub().isBlank()) {
            throw ApiException.unauthorized("Risposta di Google incompleta");
        }
        if (!identity.emailVerified()) {
            throw ApiException.unauthorized(
                    "Google non ha confermato questo indirizzo email: non possiamo usarlo per accedere.");
        }
        if (identity.email() == null || identity.email().isBlank()) {
            throw ApiException.unauthorized("Google non ha comunicato nessun indirizzo email");
        }

        String email = identity.email().trim().toLowerCase();

        // 1. Chi e' gia' passato di qui: si riconosce dal `sub`, non dall'indirizzo.
        var bySub = users.findByGoogleSub(identity.sub());
        if (bySub.isPresent()) {
            return auth.issueSession(usable(bySub.get()), userAgent);
        }

        // 2. Un account nostro con lo stesso indirizzo.
        var byEmail = users.findByEmailIgnoreCase(email);
        if (byEmail.isPresent()) {
            var existing = byEmail.get();

            // Cancellato o sospeso prima di ogni altra valutazione: non deve nemmeno
            // arrivare a farsi collegare.
            usable(existing);

            if (existing.hasGoogleIdentity()) {
                throw ApiException.conflict(
                        "Questo indirizzo e' gia' collegato a un altro account Google. "
                                + "Accedi con la password e controlla i collegamenti dal tuo profilo.");
            }
            if (!existing.isEmailVerified()) {
                throw ApiException.conflict(
                        "Esiste gia' un account con questo indirizzo, ma l'indirizzo non e' mai stato confermato. "
                                + "Accedi con la password e collega Google dal tuo profilo.");
            }

            existing.setGoogleSub(identity.sub());
            users.save(existing);
            return auth.issueSession(existing, userAgent);
        }

        // 3. Nessuno: si registra adesso.
        return auth.issueSession(users.save(createFrom(identity, email)), userAgent);
    }

    private User createFrom(GoogleIdentity identity, String email) {
        var user = new User();
        user.setEmail(email);
        user.setFullName(displayName(identity, email));
        user.setGoogleSub(identity.sub());
        // Nessuna password: la colonna e' nullable proprio per questo caso. Chi vuole
        // anche la password puo' impostarsela da "Password dimenticata", che manda il
        // link sulla casella che Google ha appena dimostrato essere sua.
        user.setPasswordHash(null);
        // Nessun secondo giro di conferma: l'indirizzo e' gia' dimostrato da Google,
        // e senza questo `login()` rifiuterebbe l'account come "non verificato".
        user.setEmailVerifiedAt(LocalDateTime.now());
        return user;
    }

    /**
     * `full_name` e' NOT NULL: se Google non condivide il nome bisogna comunque
     * scriverci qualcosa, altrimenti l'inserimento fallisce e l'accesso non riesce
     * mai. La parte prima della chiocciola e' un segnaposto che la persona riconosce
     * e puo' correggere dal profilo.
     */
    private static String displayName(GoogleIdentity identity, String email) {
        if (identity.fullName() != null && !identity.fullName().isBlank()) {
            return identity.fullName().trim();
        }
        return email.substring(0, email.indexOf('@'));
    }

    /** Lo stesso filtro del login con password: cancellato o sospeso non entra. */
    private static User usable(User user) {
        if (user.getDeletedAt() != null || !Boolean.TRUE.equals(user.getIsActive())) {
            throw ApiException.unauthorized("Account non disponibile");
        }
        return user;
    }
}

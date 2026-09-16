package it.commonera.backend.controllers;

import it.commonera.backend.dtos.PrivacyDtos;
import it.commonera.backend.dtos.UserDtos;
import it.commonera.backend.dtos.UserResponse;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.security.AuthCookie;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.PrivacyService;
import it.commonera.backend.services.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Il profilo di chi e' collegato.
 *
 * Sono le rotte che la tab "Impostazioni" di `/me` chiama da sempre e che il backend
 * Java non esponeva: cambiare nome, telefono, password o indirizzo email falliva con
 * un 401 fuorviante, perche' Spring risponde cosi' anche a una rotta che non esiste.
 */
@RestController
@RequestMapping("/users")
public class UsersController {

    private final UserService users;
    private final PrivacyService privacy;
    private final boolean secureCookies;

    public UsersController(UserService users, PrivacyService privacy,
                           @Value("${app.cookie.secure:false}") boolean secureCookies) {
        this.users = users;
        this.privacy = privacy;
        this.secureCookies = secureCookies;
    }

    @PatchMapping("/me")
    public UserResponse updateProfile(@AuthenticationPrincipal CurrentUser current,
                                      @Valid @RequestBody UserDtos.UpdateProfileRequest body) {
        return UserResponse.from(users.updateProfile(required(current).id(), body));
    }

    @PostMapping("/me/change-password")
    public Map<String, String> changePassword(@AuthenticationPrincipal CurrentUser current,
                                              @Valid @RequestBody UserDtos.ChangePasswordRequest body) {
        var user = required(current);
        return Map.of("message", users.changePassword(user.id(), user.sessionId(), body));
    }

    @PostMapping("/me/change-email")
    public Map<String, String> changeEmail(@AuthenticationPrincipal CurrentUser current,
                                           @Valid @RequestBody UserDtos.ChangeEmailRequest body) {
        return Map.of("message", users.requestEmailChange(required(current).id(), body));
    }

    @PostMapping("/me/send-verification")
    public Map<String, String> sendVerification(@AuthenticationPrincipal CurrentUser current) {
        return Map.of("message", users.sendVerificationEmail(required(current).id()));
    }

    // ─── GDPR ──────────────────────────────────────────────────────────────────

    /**
     * Art. 20: i propri dati, in un file.
     *
     * Scaricato e non solo mostrato: `Content-Disposition: attachment` fa aprire al
     * browser la finestra di salvataggio invece di stampare il JSON nella pagina, ed
     * e' un file che la persona deve poter conservare o dare a un altro negozio.
     */
    @GetMapping("/me/export")
    public ResponseEntity<PrivacyDtos.DataExport> exportMyData(@AuthenticationPrincipal CurrentUser current) {
        var export = privacy.exportPersonalData(required(current).id());
        var filename = "common-era-dati-personali-" + LocalDate.now() + ".json";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(export);
    }

    /**
     * Art. 17: chiusura dell'account.
     *
     * La cancellazione e' **logica**: gli ordini restano appesi a questa riga
     * ({@code ON DELETE RESTRICT}) perche' una fattura emessa va conservata per legge.
     * Quello che sparisce sono i dati personali — vedi {@link PrivacyService}.
     *
     * Il cookie viene svuotato nella stessa risposta: la sessione da cui si e' chiesta
     * la cancellazione e' appena stata cancellata anche lei, e senza questo il browser
     * continuerebbe a mandare un token che non apre piu' niente.
     */
    @DeleteMapping("/me")
    public ResponseEntity<Map<String, String>> eraseMyAccount(@AuthenticationPrincipal CurrentUser current,
                                                              @Valid @RequestBody PrivacyDtos.EraseAccountRequest body) {
        privacy.eraseAccount(required(current).id(), body.password());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, AuthCookie.cleared(secureCookies).toString())
                .body(Map.of("message", "Account deleted. Your personal data has been removed; "
                        + "orders already placed remain stored as tax documents."));
    }

    /** Pubblica: ci si arriva cliccando il link nell'email, senza essere collegati. */
    @GetMapping("/verify-email/{token}")
    public Map<String, String> confirmVerification(@PathVariable String token) {
        return Map.of("message", users.confirmVerification(token));
    }

    /** Pubblica, per lo stesso motivo: e' il link mandato al nuovo indirizzo. */
    @GetMapping("/confirm-email/{token}")
    public Map<String, String> confirmEmailChange(@PathVariable String token) {
        return Map.of("message", users.confirmEmailChange(token));
    }

    private CurrentUser required(CurrentUser current) {
        if (current == null) throw ApiException.unauthorized("Unauthorized");
        return current;
    }
}

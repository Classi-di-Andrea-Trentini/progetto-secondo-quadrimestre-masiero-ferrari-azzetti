package it.commonera.backend.controllers;

import it.commonera.backend.dtos.UserDtos;
import it.commonera.backend.dtos.UserResponse;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.UserService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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

    public UsersController(UserService users) {
        this.users = users;
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

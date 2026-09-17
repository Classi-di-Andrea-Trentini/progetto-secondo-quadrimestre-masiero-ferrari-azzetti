package it.commonera.backend.controllers;

import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.CheckoutService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/checkout")
public class CheckoutController {

    private final CheckoutService checkout;

    public CheckoutController(CheckoutService checkout) {
        this.checkout = checkout;
    }

    @PostMapping
    public Map<String, Object> place(@AuthenticationPrincipal CurrentUser user,
                                     @RequestBody CheckoutService.Request body) {
        return checkout.placeOrder(user.id(), body);
    }
}

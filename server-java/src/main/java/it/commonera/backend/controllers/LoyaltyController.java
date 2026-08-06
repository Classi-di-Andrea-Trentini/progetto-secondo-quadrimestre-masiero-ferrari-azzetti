package it.commonera.backend.controllers;

import it.commonera.backend.entities.LoyaltyEntry;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.LoyaltyService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/loyalty")
public class LoyaltyController {

    private final LoyaltyService loyalty;

    public LoyaltyController(LoyaltyService loyalty) {
        this.loyalty = loyalty;
    }

    @GetMapping
    public Map<String, Object> summary(@AuthenticationPrincipal CurrentUser user) {
        return loyalty.summary(user.id());
    }

    @GetMapping("/history")
    public List<LoyaltyEntry> history(@AuthenticationPrincipal CurrentUser user) {
        return loyalty.history(user.id());
    }
}

package it.commonera.backend.controllers;

import it.commonera.backend.dtos.PromoCodeDtos;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.PromoCodeService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/promo-codes")
public class PromoCodesController {

    private final PromoCodeService promoCodes;

    public PromoCodesController(PromoCodeService promoCodes) {
        this.promoCodes = promoCodes;
    }

    @PostMapping("/validate")
    public PromoCodeService.Result validate(@AuthenticationPrincipal CurrentUser user,
                                            @RequestBody PromoCodeDtos.ValidateRequest body) {
        return promoCodes.validate(body.code(), body.orderAmount(), user.id());
    }
}

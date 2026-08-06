package it.commonera.backend.controllers;

import it.commonera.backend.services.GiftCardService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/gift-cards")
public class GiftCardsController {

    private final GiftCardService giftCards;

    public GiftCardsController(GiftCardService giftCards) {
        this.giftCards = giftCards;
    }

    /** Saldo di un codice, per mostrarlo al checkout prima di confermare l'ordine. */
    @GetMapping("/{code}")
    public GiftCardService.Check check(@PathVariable String code) {
        return giftCards.check(code);
    }
}

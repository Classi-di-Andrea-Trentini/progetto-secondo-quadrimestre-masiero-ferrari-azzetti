package it.commonera.backend.controllers;

import it.commonera.backend.services.NewsletterService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/newsletter")
public class NewsletterController {

    private final NewsletterService newsletter;

    public NewsletterController(NewsletterService newsletter) {
        this.newsletter = newsletter;
    }

    @PostMapping("/subscribe")
    public Map<String, String> subscribe(@RequestBody Map<String, String> body) {
        return newsletter.subscribe(body.get("email"));
    }
}

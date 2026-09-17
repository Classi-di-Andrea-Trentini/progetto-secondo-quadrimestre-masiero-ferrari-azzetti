package it.commonera.backend.controllers;

import it.commonera.backend.dtos.ReturnDtos;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.ReturnService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/returns")
public class ReturnsController {

    private final ReturnService returns;

    public ReturnsController(ReturnService returns) {
        this.returns = returns;
    }

    @GetMapping
    public List<ReturnDtos.View> findAll(@AuthenticationPrincipal CurrentUser user) {
        return returns.findAll(user.id());
    }

    @GetMapping("/{id}")
    public ReturnDtos.View findOne(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return returns.findOne(user.id(), id);
    }

    @PostMapping
    public ReturnDtos.View create(@AuthenticationPrincipal CurrentUser user, @RequestBody ReturnDtos.CreateRequest body) {
        return returns.create(user.id(), body);
    }
}

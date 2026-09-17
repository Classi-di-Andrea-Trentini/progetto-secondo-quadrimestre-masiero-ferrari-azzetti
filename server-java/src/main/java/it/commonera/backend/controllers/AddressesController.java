package it.commonera.backend.controllers;

import it.commonera.backend.entities.UserAddress;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.AddressService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/addresses")
public class AddressesController {

    private final AddressService addresses;

    public AddressesController(AddressService addresses) {
        this.addresses = addresses;
    }

    @GetMapping
    public List<UserAddress> list(@AuthenticationPrincipal CurrentUser user) {
        return addresses.list(user.id());
    }

    @PostMapping
    public UserAddress create(@AuthenticationPrincipal CurrentUser user, @RequestBody UserAddress body) {
        return addresses.create(user.id(), body);
    }

    @PutMapping("/{id}")
    public UserAddress update(@AuthenticationPrincipal CurrentUser user,
                              @PathVariable UUID id, @RequestBody UserAddress body) {
        return addresses.update(user.id(), id, body);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        addresses.delete(user.id(), id);
        return Map.of("message", "Address deleted");
    }

    @PatchMapping("/{id}/set-default")
    public UserAddress setDefault(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return addresses.setDefault(user.id(), id);
    }
}

package it.commonera.backend.services;

import it.commonera.backend.entities.UserAddress;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.UserAddressRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class AddressService {

    private final UserAddressRepository addresses;

    public AddressService(UserAddressRepository addresses) {
        this.addresses = addresses;
    }

    @Transactional(readOnly = true)
    public List<UserAddress> list(UUID userId) {
        return addresses.findByUserIdOrderByIsDefaultDescCreatedAtAsc(userId);
    }

    @Transactional
    public UserAddress create(UUID userId, UserAddress input) {
        input.setId(null);
        input.setUserId(userId);

        // Il primo indirizzo diventa predefinito da solo: chiederlo all'utente quando
        // ne ha uno solo e' una domanda senza senso.
        boolean first = addresses.findByUserIdOrderByIsDefaultDescCreatedAtAsc(userId).isEmpty();
        if (first) input.setIsDefault(true);
        else if (Boolean.TRUE.equals(input.getIsDefault())) addresses.clearDefault(userId);

        return addresses.save(input);
    }

    @Transactional
    public UserAddress update(UUID userId, UUID id, UserAddress input) {
        var address = own(userId, id);
        address.setLabel(input.getLabel());
        address.setFullName(input.getFullName());
        address.setPhone(input.getPhone());
        address.setStreet(input.getStreet());
        address.setStreet2(input.getStreet2());
        address.setCity(input.getCity());
        address.setProvince(input.getProvince());
        address.setPostalCode(input.getPostalCode());
        address.setCountry(input.getCountry());
        return addresses.save(address);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        addresses.delete(own(userId, id));
    }

    @Transactional
    public UserAddress setDefault(UUID userId, UUID id) {
        var address = own(userId, id);
        addresses.clearDefault(userId);
        address.setIsDefault(true);
        return addresses.save(address);
    }

    private UserAddress own(UUID userId, UUID id) {
        return addresses.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.notFound("Address not found"));
    }
}

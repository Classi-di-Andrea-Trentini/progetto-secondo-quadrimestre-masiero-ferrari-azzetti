package it.commonera.backend.services;

import it.commonera.backend.entities.Wishlist;
import it.commonera.backend.repositories.ProductRepository;
import it.commonera.backend.repositories.WishlistRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class WishlistService {

    private final WishlistRepository wishlists;
    private final ProductRepository products;

    public WishlistService(WishlistRepository wishlists, ProductRepository products) {
        this.wishlists = wishlists;
        this.products = products;
    }

    /** Solo gli id: servono a colorare i cuoricini nella griglia, senza scaricare tutto. */
    @Transactional(readOnly = true)
    public List<UUID> ids(UUID userId) {
        return wishlists.findByUserId(userId).stream().map(Wishlist::getProductId).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> items(UUID userId) {
        return wishlists.findByUserId(userId).stream()
                .map(entry -> products.findById(entry.getProductId()).orElse(null))
                .filter(product -> product != null && product.getDeletedAt() == null)
                .map(product -> Map.<String, Object>of(
                        "id", product.getId(),
                        "name", product.getName(),
                        "slug", product.getSlug(),
                        "basePrice", product.getBasePrice(),
                        "imageUrl", product.getImages().isEmpty()
                                ? "" : product.getImages().get(0).getUrl()))
                .toList();
    }

    /** Un solo endpoint per aggiungere e togliere: il cuoricino e' un interruttore. */
    @Transactional
    public Map<String, Object> toggle(UUID userId, UUID productId) {
        var existing = wishlists.findByUserIdAndProductId(userId, productId);
        if (existing.isPresent()) {
            wishlists.delete(existing.get());
            return Map.of("saved", false);
        }

        var entry = new Wishlist();
        entry.setUserId(userId);
        entry.setProductId(productId);
        wishlists.save(entry);
        return Map.of("saved", true);
    }
}

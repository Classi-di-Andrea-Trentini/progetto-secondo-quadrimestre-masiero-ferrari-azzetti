package it.commonera.backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Il pacchetto dati dell'art. 20 GDPR (portabilita') e la richiesta dell'art. 17
 * (cancellazione).
 *
 * L'export e' un albero di record e non una mappa generica per una ragione precisa:
 * un record elenca i campi uno per uno, quindi aggiungere domani una colonna
 * personale a {@code users} non la fa finire nell'export di nascosto, e — piu'
 * importante — non ci puo' finire {@code passwordHash} per distrazione.
 */
public class PrivacyDtos {

    /**
     * Cancellazione: serve una conferma scritta, un click solo sarebbe troppo poco.
     *
     * Il campo si chiama ancora `password` perche' e' quello che il frontend manda da
     * sempre, ma per un account nato da "Accedi con Google" la conferma attesa e' il
     * proprio indirizzo email — una password quegli account non l'hanno mai avuta
     * (vedi {@code PrivacyService#eraseAccount}). Da qui il limite a 255 e non a 72:
     * un indirizzo email puo' essere piu' lungo di una password BCrypt.
     */
    public record EraseAccountRequest(
            @NotBlank @Size(max = 255) String password) {}

    public record DataExport(
            LocalDateTime generatedAt,
            Profile profile,
            List<Address> addresses,
            List<OrderRecord> orders,
            List<ReviewRecord> reviews,
            List<WishlistRecord> wishlist,
            Loyalty loyalty) {}

    public record Profile(
            UUID id,
            String email,
            String fullName,
            String phone,
            LocalDate birthDate,
            String gender,
            String role,
            Boolean newsletterOptIn,
            LocalDateTime emailVerifiedAt,
            LocalDateTime lastLoginAt,
            LocalDateTime createdAt) {}

    public record Address(
            UUID id,
            String label,
            String fullName,
            String phone,
            String street,
            String street2,
            String city,
            String province,
            String postalCode,
            String country,
            Boolean isDefault,
            LocalDateTime createdAt) {}

    public record OrderRecord(
            UUID id,
            String status,
            BigDecimal subtotal,
            BigDecimal discountTotal,
            BigDecimal shippingCost,
            BigDecimal taxAmount,
            BigDecimal total,
            BigDecimal giftCardAmount,
            String shippingMethod,
            String trackingNumber,
            String invoiceNumber,
            LocalDateTime createdAt,
            List<OrderItemRecord> items) {}

    public record OrderItemRecord(
            String productName,
            String variantLabel,
            String sku,
            BigDecimal unitPrice,
            Integer quantity,
            BigDecimal lineTotal) {}

    public record ReviewRecord(
            UUID id,
            UUID productId,
            Short rating,
            String title,
            String body,
            String status,
            LocalDateTime createdAt) {}

    public record WishlistRecord(
            UUID productId,
            UUID variantId,
            LocalDateTime addedAt) {}

    public record Loyalty(
            int balance,
            List<LoyaltyEntryRecord> entries) {}

    public record LoyaltyEntryRecord(
            Integer points,
            String reason,
            UUID orderId,
            LocalDateTime createdAt) {}
}

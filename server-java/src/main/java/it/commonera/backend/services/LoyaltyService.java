package it.commonera.backend.services;

import it.commonera.backend.entities.LoyaltyEntry;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.LoyaltyEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Punti fedelta'.
 *
 * Il saldo **non e' un contatore**: e' la somma dei movimenti. Un contatore tenuto
 * a parte prima o poi si scolla dalla storia — un accredito partito due volte, uno
 * scalo non scritto — e a quel punto non si sa piu' quale numero sia quello giusto.
 */
@Service
public class LoyaltyService {

    /** Un punto per euro speso, sull'imponibile: la spedizione non genera punti. */
    private static final int POINTS_PER_EURO = 1;
    /** 100 punti = 1 euro. Rapporto tondo, facile da capire al checkout. */
    private static final int POINTS_PER_EURO_DISCOUNT = 100;
    /** Sotto questa soglia lo sconto e' irrisorio e complica il conto per niente. */
    private static final int MIN_REDEEMABLE = 500;

    private final LoyaltyEntryRepository entries;

    public LoyaltyService(LoyaltyEntryRepository entries) {
        this.entries = entries;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary(UUID userId) {
        int balance = entries.balanceOf(userId);
        return Map.of(
                "balance", balance,
                // Arrotondato per difetto: promettere 1,37 EUR e poi scalarne 1,00 e'
                // il modo migliore per far arrabbiare qualcuno.
                "value", balance / POINTS_PER_EURO_DISCOUNT,
                "minRedeemable", MIN_REDEEMABLE,
                "pointsPerEuro", POINTS_PER_EURO,
                "pointsPerEuroDiscount", POINTS_PER_EURO_DISCOUNT,
                "redeemable", balance >= MIN_REDEEMABLE);
    }

    @Transactional(readOnly = true)
    public List<LoyaltyEntry> history(UUID userId) {
        return entries.findTop50ByUserIdOrderByCreatedAtDesc(userId);
    }

    /** Accredito: sull'imponibile scontato e **senza spedizione**. */
    @Transactional
    public int award(UUID userId, UUID orderId, BigDecimal eligibleAmount) {
        int points = eligibleAmount.max(BigDecimal.ZERO)
                .setScale(0, RoundingMode.DOWN).intValue() * POINTS_PER_EURO;
        if (points <= 0) return 0;

        var entry = new LoyaltyEntry();
        entry.setUserId(userId);
        entry.setOrderId(orderId);
        entry.setPoints(points);
        entry.setReason("Acquisto");
        entries.save(entry);
        return points;
    }

    /**
     * Conversione in sconto. Il saldo si rilegge **qui dentro**: due checkout in
     * parallelo leggerebbero lo stesso numero e lo spenderebbero due volte.
     */
    @Transactional
    public Redeemed redeem(UUID userId, UUID orderId, int requestedPoints, BigDecimal maxDiscount) {
        int balance = entries.balanceOf(userId);

        if (requestedPoints < MIN_REDEEMABLE) {
            throw ApiException.badRequest("You need at least " + MIN_REDEEMABLE + " points to redeem");
        }
        if (requestedPoints > balance) {
            throw ApiException.badRequest("Not enough points (balance " + balance + ")");
        }

        // Non si scala piu' di quanto valga l'ordine: i punti in eccesso restano al
        // cliente invece di evaporare in uno sconto che non serve.
        int cappedByOrder = Math.min(requestedPoints,
                maxDiscount.multiply(BigDecimal.valueOf(POINTS_PER_EURO_DISCOUNT))
                        .setScale(0, RoundingMode.DOWN).intValue());
        int usable = (cappedByOrder / POINTS_PER_EURO_DISCOUNT) * POINTS_PER_EURO_DISCOUNT;
        if (usable <= 0) return new Redeemed(0, BigDecimal.ZERO);

        var entry = new LoyaltyEntry();
        entry.setUserId(userId);
        entry.setOrderId(orderId);
        entry.setPoints(-usable);
        entry.setReason("Sconto punti");
        entries.save(entry);

        return new Redeemed(usable, BigDecimal.valueOf(usable / POINTS_PER_EURO_DISCOUNT));
    }

    /**
     * Annulla l'effetto netto sui punti di un ordine — accredito da acquisto e/o
     * spesa in sconto, insieme — con **un solo movimento**: coerente con "il saldo
     * e' la somma dei movimenti", basta scrivere l'opposto della somma gia' scritta
     * per non lasciare punti guadagnati da un ordine annullato, ne' punti spesi che
     * non tornano al cliente.
     */
    @Transactional
    public int reverseForOrder(UUID userId, UUID orderId) {
        int net = entries.netPointsForOrder(orderId);
        if (net == 0) return 0;

        var entry = new LoyaltyEntry();
        entry.setUserId(userId);
        entry.setOrderId(orderId);
        entry.setPoints(-net);
        entry.setReason("Annullamento ordine");
        entries.save(entry);
        return -net;
    }

    public record Redeemed(int points, BigDecimal discount) {}
}

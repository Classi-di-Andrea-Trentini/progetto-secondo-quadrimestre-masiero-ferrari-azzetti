package it.commonera.backend.services;

import it.commonera.backend.entities.GiftCard;
import it.commonera.backend.entities.GiftCardTransaction;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.GiftCardRepository;
import it.commonera.backend.repositories.GiftCardTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Gift card.
 *
 * Lo scalo avviene **dentro la transazione dell'ordine**: se l'ordine fallisce piu'
 * avanti — per esempio perche' la giacenza e' finita fra un controllo e l'altro — il
 * saldo torna su da solo col rollback, invece di restare bruciato per un ordine mai
 * nato.
 */
@Service
public class GiftCardService {

    private final GiftCardRepository cards;
    private final GiftCardTransactionRepository transactions;

    public GiftCardService(GiftCardRepository cards, GiftCardTransactionRepository transactions) {
        this.cards = cards;
        this.transactions = transactions;
    }

    @Transactional(readOnly = true)
    public Check check(String code) {
        var card = load(code);
        return new Check(card.getId(), card.getCode(), card.getCurrentBalance(), card.getExpiresAt());
    }

    /**
     * Scala quanto serve. Non si scala mai piu' del dovuto: se il buono vale piu'
     * dell'ordine, la differenza resta sulla carta per la prossima volta.
     */
    @Transactional
    public Redeemed redeem(String code, BigDecimal amountDue, UUID orderId) {
        var card = load(code);

        BigDecimal applied = card.getCurrentBalance().min(amountDue.max(BigDecimal.ZERO))
                .setScale(2, RoundingMode.HALF_UP);
        if (applied.signum() <= 0) throw ApiException.badRequest("This gift card has no balance left");

        if (cards.redeem(card.getId(), applied) == 0) {
            throw ApiException.badRequest("Gift card balance changed, please try again");
        }

        BigDecimal after = card.getCurrentBalance().subtract(applied).setScale(2, RoundingMode.HALF_UP);

        var tx = new GiftCardTransaction();
        tx.setGiftCardId(card.getId());
        tx.setOrderId(orderId);
        // Negativo perche' e' un utilizzo: il segno distingue lo scalo dalla ricarica.
        tx.setAmount(applied.negate());
        tx.setBalanceAfter(after);
        tx.setNote("Utilizzo su ordine");
        transactions.save(tx);

        return new Redeemed(card.getId(), applied, after);
    }

    /**
     * Restituisce sul buono quanto era stato scalato al checkout, es. quando
     * l'ordine viene annullato. Nessun controllo di attivo/scaduto qui: e' un
     * rimborso di un importo gia' preso, non una nuova spesa, e deve tornare sul
     * saldo anche se il buono nel frattempo e' scaduto o e' stato disattivato.
     */
    @Transactional
    public void refund(UUID giftCardId, BigDecimal amount, UUID orderId) {
        if (giftCardId == null || amount == null || amount.signum() <= 0) return;

        var card = cards.findById(giftCardId)
                .orElseThrow(() -> ApiException.notFound("Gift card not found"));

        BigDecimal rounded = amount.setScale(2, RoundingMode.HALF_UP);
        cards.refund(giftCardId, rounded);
        BigDecimal after = card.getCurrentBalance().add(rounded).setScale(2, RoundingMode.HALF_UP);

        var tx = new GiftCardTransaction();
        tx.setGiftCardId(giftCardId);
        tx.setOrderId(orderId);
        // Positivo, come una ricarica: il segno distingue lo scalo dal rimborso.
        tx.setAmount(rounded);
        tx.setBalanceAfter(after);
        tx.setNote("Rimborso per annullamento ordine");
        transactions.save(tx);
    }

    @Transactional
    public GiftCard issue(UUID adminId, BigDecimal amount, String note, LocalDateTime expiresAt) {
        if (amount == null || amount.signum() <= 0) throw ApiException.badRequest("Amount must be positive");

        var card = new GiftCard();
        card.setCode(generateCode());
        card.setInitialBalance(amount);
        card.setCurrentBalance(amount);
        card.setIssuedBy(adminId);
        card.setExpiresAt(expiresAt);
        card.setNote(note);
        var saved = cards.save(card);

        var tx = new GiftCardTransaction();
        tx.setGiftCardId(saved.getId());
        tx.setAmount(amount);
        tx.setBalanceAfter(amount);
        tx.setNote("Emissione");
        transactions.save(tx);

        return saved;
    }

    @Transactional(readOnly = true)
    public List<GiftCard> list() {
        return cards.findAll();
    }

    private GiftCard load(String code) {
        var card = cards.findByCodeIgnoreCase(code == null ? "" : code.trim())
                .orElseThrow(() -> ApiException.notFound("Gift card not found"));
        if (!Boolean.TRUE.equals(card.getIsActive())) throw ApiException.notFound("Gift card not found");
        if (card.getExpiresAt() != null && card.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw ApiException.badRequest("This gift card has expired");
        }
        if (card.getCurrentBalance().signum() <= 0) {
            throw ApiException.badRequest("This gift card has no balance left");
        }
        return card;
    }

    /**
     * Codice leggibile a voce: niente `0`/`O` ne' `1`/`I`, che al telefono si
     * confondono e generano richieste di assistenza per un buono "che non funziona".
     */
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private String generateCode() {
        StringBuilder sb = new StringBuilder("GC");
        for (int block = 0; block < 3; block++) {
            sb.append('-');
            for (int i = 0; i < 4; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    public record Check(UUID giftCardId, String code, BigDecimal balance, LocalDateTime expiresAt) {}

    public record Redeemed(UUID giftCardId, BigDecimal applied, BigDecimal balanceAfter) {}
}

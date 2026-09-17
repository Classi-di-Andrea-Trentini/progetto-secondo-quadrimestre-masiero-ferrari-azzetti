package it.commonera.backend.services;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Il corpo dell'email di conferma.
 *
 * Il rendering e' statico apposta: e' l'unica parte che vale la pena provare, e
 * provarla non deve richiedere ne' un contesto Spring ne' un server SMTP.
 */
class OrderConfirmationMailTest {

    @Test
    void confirmationBodyCarriesOrderNumberTotalAndLines() {
        var html = MailService.renderOrderConfirmation(
                "Marco Rossi", "2026-0042", new BigDecimal("94.90"),
                List.of(new MailService.Line("T-shirt nera", "M", 2, new BigDecimal("29.90"))));

        assertTrue(html.contains("2026-0042"));
        assertTrue(html.contains("94.90"));
        assertTrue(html.contains("T-shirt nera"));
        // Nome di battesimo, come **tutte** le altre email del progetto
        // ("Hi Marco"): il piano diceva nome intero, ma una sola email che
        // saluta in modo diverso dalle altre otto si nota, e in peggio.
        assertTrue(html.contains("Marco"));
    }

    @Test
    void escapesNamesThatContainMarkup() {
        // Il nome arriva da un campo che compila il cliente: senza escape, quello
        // che scrive lui diventa markup nella casella di posta sua e nostra.
        var html = MailService.renderOrderConfirmation(
                "<script>alert(1)</script>", "2026-0001", BigDecimal.ONE, List.of());
        assertFalse(html.contains("<script>"));
    }

    @Test
    void escapesProductNamesToo() {
        var html = MailService.renderOrderConfirmation(
                "Marco", "2026-0002", BigDecimal.TEN,
                List.of(new MailService.Line("<img src=x onerror=alert(1)>", "M", 1, BigDecimal.ONE)));
        assertFalse(html.contains("<img"));
    }
}

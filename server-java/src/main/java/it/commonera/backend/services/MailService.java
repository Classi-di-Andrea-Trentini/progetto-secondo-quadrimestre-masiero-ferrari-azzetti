package it.commonera.backend.services;

import java.math.BigDecimal;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Invio email.
 *
 * `JavaMailSender` arriva via `ObjectProvider` perche' l'autoconfigurazione lo crea
 * **solo se `spring.mail.host` e' valorizzato**: iniettarlo direttamente farebbe
 * fallire l'avvio quando la posta non e' configurata, che e' lo stato normale in
 * sviluppo. Senza trasporto le email vengono solo registrate nei log.
 *
 * Un'email che non parte non deve far fallire l'operazione che l'ha innescata:
 * nessuno vuole un ordine annullato perche' il server di posta non rispondeva.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> senderProvider;
    private final String provider;
    private final String from;
    private final String frontendUrl;

    public MailService(ObjectProvider<JavaMailSender> senderProvider,
                       @Value("${app.mail.provider:}") String provider,
                       @Value("${app.mail.from:}") String from,
                       @Value("${app.frontend-url:}") String frontendUrl) {
        this.senderProvider = senderProvider;
        this.provider = provider == null ? "" : provider.trim().toLowerCase();
        this.from = from;
        this.frontendUrl = frontendUrl;
    }

    public void sendBackInStock(String to, String fullName, String productName, String label, String slug) {
        String firstName = fullName == null ? "" : fullName.split(" ")[0];
        String variant = label == null || "null".equals(label) ? "" : " (" + label + ")";
        send(to, productName + " e' tornato disponibile",
                "<h1>E' tornato disponibile.</h1>"
                        + "<p>Ciao <strong>" + escape(firstName) + "</strong>, <strong>"
                        + escape(productName) + "</strong>" + escape(variant)
                        + " che stavi aspettando e' di nuovo in magazzino.</p>"
                        + "<p><a href=\"" + frontendUrl + "/product/" + slug + "\">Vai al prodotto</a></p>");
    }

    public void sendReturnStatusUpdate(String to, String fullName, String returnId, String status, String adminNote) {
        String firstName = fullName == null ? "" : fullName.split(" ")[0];
        String note = adminNote == null || adminNote.isBlank() ? "" : "<p>" + escape(adminNote) + "</p>";
        send(to, "Aggiornamento sul tuo reso",
                "<h1>Il tuo reso e' stato aggiornato.</h1>"
                        + "<p>Ciao <strong>" + escape(firstName) + "</strong>, il reso <strong>"
                        + escape(returnId) + "</strong> e' ora: <strong>" + escape(status) + "</strong>.</p>"
                        + note);
    }

    public void sendNewsletterConfirmation(String to, String name) {
        String firstName = name == null ? "" : name.split(" ")[0];
        send(to, "Iscrizione confermata",
                "<h1>Sei dentro.</h1>"
                        + "<p>Ciao <strong>" + escape(firstName) + "</strong>, la tua iscrizione alla newsletter e' confermata.</p>");
    }

    public void sendEmailVerification(String to, String fullName, String verificationUrl) {
        send(to, "Conferma il tuo indirizzo email",
                "<h1>Un ultimo passaggio.</h1>"
                        + "<p>Ciao <strong>" + escape(firstName(fullName)) + "</strong>, conferma il tuo"
                        + " indirizzo per completare l'iscrizione.</p>"
                        + "<p><a href=\"" + verificationUrl + "\">Conferma l'indirizzo</a></p>"
                        + "<p>Il link vale 24 ore.</p>");
    }

    public void sendEmailChangeConfirmation(String to, String fullName, String confirmationUrl) {
        send(to, "Conferma il tuo nuovo indirizzo email",
                "<h1>Confermi il cambio?</h1>"
                        + "<p>Ciao <strong>" + escape(firstName(fullName)) + "</strong>, hai chiesto di usare"
                        + " questo indirizzo per il tuo account.</p>"
                        + "<p><a href=\"" + confirmationUrl + "\">Conferma il nuovo indirizzo</a></p>"
                        + "<p>Il link vale 24 ore. Se non sei stato tu, ignora questa email.</p>");
    }

    /**
     * Avviso al **vecchio** indirizzo: se il cambio non l'ha chiesto il proprietario,
     * l'unica casella dove puo' ancora accorgersene e' quella che sta per perdere.
     */
    public void sendEmailChangedAlert(String to, String fullName, String newEmail) {
        send(to, "Il tuo indirizzo email e' stato cambiato",
                "<h1>Indirizzo aggiornato.</h1>"
                        + "<p>Ciao <strong>" + escape(firstName(fullName)) + "</strong>, l'account ora usa"
                        + " <strong>" + escape(newEmail) + "</strong>.</p>"
                        + "<p>Se non sei stato tu, scrivici subito.</p>");
    }

    public void sendPasswordResetEmail(String to, String fullName, String token) {
        String url = frontendUrl + "/reset-password?token=" + token;
        send(to, "Reimposta la tua password",
                "<h1>Password dimenticata.</h1>"
                        + "<p>Ciao <strong>" + escape(firstName(fullName)) + "</strong>, da qui puoi sceglierne"
                        + " una nuova.</p>"
                        + "<p><a href=\"" + url + "\">Reimposta la password</a></p>"
                        + "<p>Il link vale un'ora. Se non l'hai chiesto tu, la password resta quella di prima.</p>");
    }

    public void sendPasswordChangedAlert(String to, String fullName) {
        send(to, "La tua password e' stata cambiata",
                "<h1>Password aggiornata.</h1>"
                        + "<p>Ciao <strong>" + escape(firstName(fullName)) + "</strong>, la password del tuo"
                        + " account e' stata cambiata poco fa.</p>"
                        + "<p>Se non sei stato tu, reimpostala subito e controlla i tuoi accessi.</p>");
    }

    /**
     * La conferma d'ordine: il primo messaggio che un cliente si aspetta dopo
     * aver pagato. Parte dal webhook, cioe' **a incasso confermato**, non alla
     * prenotazione: annunciare un ordine che potrebbe ancora essere annullato
     * per mancato pagamento sarebbe peggio del silenzio.
     */
    public void sendOrderConfirmation(String to, String fullName, String orderNumber,
                                      BigDecimal total, List<Line> lines) {
        send(to, "Il tuo ordine " + orderNumber,
                renderOrderConfirmation(fullName, orderNumber, total, lines));
    }

    /**
     * Statico e senza dipendenze: cosi' il corpo dell'email si puo' provare
     * senza contesto Spring e senza un server di posta.
     */
    static String renderOrderConfirmation(String fullName, String orderNumber,
                                          BigDecimal total, List<Line> lines) {
        var rows = new StringBuilder();
        for (Line line : lines) {
            rows.append("<tr><td>").append(escape(line.productName()));
            if (line.variantLabel() != null && !line.variantLabel().isBlank()) {
                rows.append(" <small>").append(escape(line.variantLabel())).append("</small>");
            }
            rows.append("</td><td align=\"center\">").append(line.quantity())
                .append("</td><td align=\"right\">").append(money(line.unitPrice()))
                .append("</td></tr>");
        }

        return "<h1>Grazie, ordine confermato.</h1>"
                + "<p>Ciao <strong>" + escape(firstNameOf(fullName)) + "</strong>, abbiamo ricevuto"
                + " il pagamento dell'ordine <strong>" + escape(orderNumber) + "</strong>.</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"6\">"
                + "<thead><tr><th align=\"left\">Articolo</th><th>Q.ta</th><th align=\"right\">Prezzo</th></tr></thead>"
                + "<tbody>" + rows + "</tbody>"
                + "<tfoot><tr><td colspan=\"2\"><strong>Totale</strong></td>"
                + "<td align=\"right\"><strong>" + money(total) + "</strong></td></tr></tfoot>"
                + "</table>"
                + "<p>Ti scriviamo di nuovo quando parte.</p>";
    }

    /** Virgola decimale: e' un'email a un cliente italiano, non un log. */
    private static String money(BigDecimal amount) {
        return amount == null ? "" : amount.setScale(2, java.math.RoundingMode.HALF_UP)
                .toPlainString().replace('.', ',') + " &euro;";
    }

    private static String firstNameOf(String fullName) {
        return fullName == null ? "" : fullName.split(" ")[0];
    }

    /** Una riga dell'ordine, gia' appiattita: l'email non deve caricare entita'. */
    public record Line(String productName, String variantLabel, int quantity, BigDecimal unitPrice) {}

    private String firstName(String fullName) {
        return fullName == null ? "" : fullName.split(" ")[0];
    }

    public void send(String to, String subject, String html) {
        var sender = senderProvider.getIfAvailable();
        if (!"smtp".equals(provider) || sender == null) {
            log.warn("Nessun trasporto email configurato: \"{}\" non inviata a {}", subject, to);
            return;
        }

        try {
            var message = sender.createMimeMessage();
            var helper = new MimeMessageHelper(message, "UTF-8");
            // Il mittente deve coincidere con la mailbox autenticata, altrimenti il
            // server SMTP rifiuta o l'email finisce dritta nello spam.
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            sender.send(message);
            log.info("Email \"{}\" inviata a {}", subject, to);
        } catch (Exception e) {
            log.error("Invio \"{}\" a {} fallito: {}", subject, to, e.toString());
        }
    }

    /** Il nome di un prodotto puo' contenere `<`: senza questo l'HTML si rompe. */
    private static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}

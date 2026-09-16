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
        send(to, productName + " is back in stock",
                "<h1>It's back in stock.</h1>"
                        + "<p>Hi <strong>" + escape(firstName) + "</strong>, <strong>"
                        + escape(productName) + "</strong>" + escape(variant)
                        + " you were waiting for is back in stock.</p>"
                        + "<p><a href=\"" + frontendUrl + "/product/" + slug + "\">View product</a></p>");
    }

    public void sendReturnStatusUpdate(String to, String fullName, String returnId, String status, String adminNote) {
        String firstName = fullName == null ? "" : fullName.split(" ")[0];
        String note = adminNote == null || adminNote.isBlank() ? "" : "<p>" + escape(adminNote) + "</p>";
        send(to, "Update on your return",
                "<h1>Your return has been updated.</h1>"
                        + "<p>Hi <strong>" + escape(firstName) + "</strong>, return <strong>"
                        + escape(returnId) + "</strong> is now: <strong>" + escape(status) + "</strong>.</p>"
                        + note);
    }

    public void sendNewsletterConfirmation(String to, String name) {
        String firstName = name == null ? "" : name.split(" ")[0];
        send(to, "Subscription confirmed",
                "<h1>You're in.</h1>"
                        + "<p>Hi <strong>" + escape(firstName) + "</strong>, your newsletter subscription is confirmed.</p>");
    }

    public void sendEmailVerification(String to, String fullName, String verificationUrl) {
        send(to, "Confirm your email address",
                "<h1>One last step.</h1>"
                        + "<p>Hi <strong>" + escape(firstName(fullName)) + "</strong>, confirm your"
                        + " address to complete your registration.</p>"
                        + "<p><a href=\"" + verificationUrl + "\">Confirm address</a></p>"
                        + "<p>This link is valid for 24 hours.</p>");
    }

    public void sendEmailChangeConfirmation(String to, String fullName, String confirmationUrl) {
        send(to, "Confirm your new email address",
                "<h1>Confirm the change?</h1>"
                        + "<p>Hi <strong>" + escape(firstName(fullName)) + "</strong>, you asked to use"
                        + " this address for your account.</p>"
                        + "<p><a href=\"" + confirmationUrl + "\">Confirm new address</a></p>"
                        + "<p>This link is valid for 24 hours. If this wasn't you, ignore this email.</p>");
    }

    /**
     * Avviso al **vecchio** indirizzo: se il cambio non l'ha chiesto il proprietario,
     * l'unica casella dove puo' ancora accorgersene e' quella che sta per perdere.
     */
    public void sendEmailChangedAlert(String to, String fullName, String newEmail) {
        send(to, "Your email address has been changed",
                "<h1>Address updated.</h1>"
                        + "<p>Hi <strong>" + escape(firstName(fullName)) + "</strong>, your account now uses"
                        + " <strong>" + escape(newEmail) + "</strong>.</p>"
                        + "<p>If this wasn't you, contact us right away.</p>");
    }

    public void sendPasswordResetEmail(String to, String fullName, String token) {
        String url = frontendUrl + "/reset-password?token=" + token;
        send(to, "Reset your password",
                "<h1>Forgot your password?</h1>"
                        + "<p>Hi <strong>" + escape(firstName(fullName)) + "</strong>, you can choose a new"
                        + " one from here.</p>"
                        + "<p><a href=\"" + url + "\">Reset password</a></p>"
                        + "<p>This link is valid for one hour. If you didn't request this, your password stays the same.</p>");
    }

    public void sendPasswordChangedAlert(String to, String fullName) {
        send(to, "Your password has been changed",
                "<h1>Password updated.</h1>"
                        + "<p>Hi <strong>" + escape(firstName(fullName)) + "</strong>, your account password"
                        + " was changed a moment ago.</p>"
                        + "<p>If this wasn't you, reset it right away and check your recent logins.</p>");
    }

    /**
     * La conferma d'ordine: il primo messaggio che un cliente si aspetta dopo
     * aver pagato. Parte dal webhook, cioe' **a incasso confermato**, non alla
     * prenotazione: annunciare un ordine che potrebbe ancora essere annullato
     * per mancato pagamento sarebbe peggio del silenzio.
     */
    public void sendOrderConfirmation(String to, String fullName, String orderNumber,
                                      BigDecimal total, List<Line> lines) {
        send(to, "Your order " + orderNumber,
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

        return "<h1>Thank you, order confirmed.</h1>"
                + "<p>Hi <strong>" + escape(firstNameOf(fullName)) + "</strong>, we've received"
                + " payment for order <strong>" + escape(orderNumber) + "</strong>.</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"6\">"
                + "<thead><tr><th align=\"left\">Item</th><th>Qty</th><th align=\"right\">Price</th></tr></thead>"
                + "<tbody>" + rows + "</tbody>"
                + "<tfoot><tr><td colspan=\"2\"><strong>Total</strong></td>"
                + "<td align=\"right\"><strong>" + money(total) + "</strong></td></tr></tfoot>"
                + "</table>"
                + "<p>We'll email you again once it ships.</p>";
    }

    /** Punto decimale e non virgola: il sito e' ora in inglese, non piu' rivolto solo a clienti italiani. */
    private static String money(BigDecimal amount) {
        return amount == null ? "" : "&euro;" + amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
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

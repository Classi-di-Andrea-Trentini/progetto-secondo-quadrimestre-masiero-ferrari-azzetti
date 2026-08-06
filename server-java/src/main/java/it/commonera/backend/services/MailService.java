package it.commonera.backend.services;

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
    private String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}

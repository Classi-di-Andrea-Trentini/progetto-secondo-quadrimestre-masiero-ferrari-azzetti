package it.commonera.backend.controllers;

import it.commonera.backend.config.GoogleOAuthProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Quel poco della configurazione del backend che il frontend ha diritto di sapere
 * **prima** di aver fatto qualsiasi cosa.
 *
 * Nasce per una domanda sola: il bottone "Accedi con Google" va mostrato? Il
 * frontend non puo' deciderlo da solo — le credenziali stanno nel `.env` del
 * server — e mostrarlo sempre significherebbe offrire un accesso che porta a una
 * pagina d'errore su ogni installazione senza credenziali, cioe' quella di
 * chiunque cloni il repo.
 *
 * Insieme al "se" viaggia il "dove": l'indirizzo assoluto da cui parte il giro. Con
 * il solo booleano, quel percorso finirebbe scritto a mano anche nel frontend, e
 * cambiarlo vorrebbe dire ricordarsi di due file. Qui e' uno.
 *
 * <b>Cosa non ci finisce mai:</b> nessun segreto. `client_id` e `client_secret`
 * restano sul server — a differenza di una integrazione lato browser, qui nemmeno il
 * `client_id` serve alla pagina, perche' e' il backend a parlare con Google.
 */
@RestController
@RequestMapping("/config")
public class PublicConfigController {

    private final GoogleOAuthProperties google;

    public PublicConfigController(GoogleOAuthProperties google) {
        this.google = google;
    }

    @GetMapping
    public Map<String, Object> publicConfig() {
        // LinkedHashMap e non Map.of: `googleAuthUrl` e' null quando Google e' spento,
        // e Map.of non ammette valori null.
        var config = new LinkedHashMap<String, Object>();
        config.put("googleAuthEnabled", google.enabled());
        config.put("googleAuthUrl", google.enabled() ? google.authorizationUrl() : null);
        return config;
    }
}

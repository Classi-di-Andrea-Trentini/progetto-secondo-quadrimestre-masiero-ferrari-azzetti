import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Le chiavi valide. `recesso` e `spedizioni-e-resi` sono obbligatorie per vendere
 * online in UE (artt. 49 e 52 del Codice del consumo) e prima non esistevano.
 */
export type LegalKey = 'privacy' | 'cookies' | 'terms' | 'recesso' | 'spedizioni-e-resi';

export const LEGAL_KEYS: readonly LegalKey[] = [
  'privacy',
  'cookies',
  'terms',
  'recesso',
  'spedizioni-e-resi',
];

type CookieRow = { name: string; type: string; purpose: string; duration: string; category: string };

type LegalSection = {
  heading: string;
  body: string;
  cookies?: CookieRow[];
};

type LegalDoc = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

/**
 * Le pagine legali.
 *
 * <h2>I segnaposto fra parentesi quadre</h2>
 *
 * `[RAGIONE SOCIALE]`, `[P.IVA]`, `[SEDE LEGALE]`, `[PEC]`, `[REA]` sono **voluti** e
 * devono restare visibili finche' non c'e' un'azienda vera dietro. Inventare una
 * partita IVA o una sede per far sembrare completa una pagina significa pubblicare
 * dati falsi di un soggetto che non esiste: e' peggio di un buco evidente, perche'
 * un buco evidente qualcuno lo riempie prima di andare online.
 *
 * <h2>I numeri qui dentro sono quelli veri</h2>
 *
 * Costi e tempi di spedizione non sono inventati per riempire la pagina: vengono da
 * `CheckoutService` (4,90 € standard, 9,90 € express, gratis sopra i 100 €) e dalle
 * regole dei resi (`ReturnService` accetta richieste solo su ordini consegnati o
 * completati). Se quelle cifre cambiano, questa pagina va cambiata insieme a loro,
 * altrimenti il negozio dichiara ai clienti condizioni che poi non applica.
 */
@Component({
  selector: 'app-legal',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './legal.html',
  styleUrl: './legal.css',
})
export class Legal {
  private readonly route = inject(ActivatedRoute);

  /** `null` quando l'indirizzo non corrisponde a nessuna pagina: si mostra il 404. */
  readonly pageKey = signal<LegalKey | null>('privacy');

  readonly docs: Record<LegalKey, LegalDoc> = {
    // ─── Privacy ───────────────────────────────────────────────────────────
    privacy: {
      title: 'Informativa sulla privacy',
      updatedAt: '15 settembre 2026',
      intro:
        'Questa informativa spiega quali dati personali raccogliamo quando usi Common Era, perché li raccogliamo, per quanto tempo li conserviamo e quali diritti puoi esercitare. È resa ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679 (GDPR).',
      sections: [
        {
          heading: '1. Titolare del trattamento',
          body: 'Il titolare del trattamento è [RAGIONE SOCIALE], con sede legale in [SEDE LEGALE], partita IVA [P.IVA], iscritta al Registro delle Imprese con numero REA [REA].\n\nPer qualsiasi questione relativa ai tuoi dati personali puoi scrivere a [PEC].\n\nNon abbiamo nominato un Responsabile della protezione dei dati (DPO), non ricorrendo i casi previsti dall\'articolo 37 del GDPR.',
        },
        {
          heading: '2. Quali dati trattiamo',
          body:
            'Dati di registrazione e di account: nome e cognome, indirizzo email, password (conservata solo come hash, mai in chiaro), ed eventualmente numero di telefono, data di nascita e genere, se scegli di indicarli.\n\n' +
            'Dati di acquisto: indirizzi di spedizione e fatturazione, contenuto degli ordini, importi, buoni regalo e punti fedeltà utilizzati, numero e data della fattura.\n\n' +
            'Dati di pagamento: i dati della tua carta non transitano né vengono conservati sui nostri sistemi. Sono trattati direttamente da Stripe, che riceve il pagamento; a noi resta solo l\'esito della transazione e il suo identificativo.\n\n' +
            'Contenuti che pubblichi: recensioni, valutazioni e fotografie che decidi di allegare.\n\n' +
            'Dati tecnici: indirizzo IP e tipo di browser associati alla sessione di accesso, per motivi di sicurezza.',
        },
        {
          heading: '3. Perché li trattiamo e con quale base giuridica',
          body:
            'Eseguire il contratto di vendita — gestire l\'ordine, la spedizione, i resi e l\'assistenza. Base giuridica: articolo 6.1.b GDPR (esecuzione di un contratto di cui sei parte). Il conferimento è necessario: senza questi dati non possiamo concludere l\'ordine.\n\n' +
            'Adempiere agli obblighi di legge — emissione e conservazione delle fatture, obblighi fiscali e contabili. Base giuridica: articolo 6.1.c GDPR (obbligo legale).\n\n' +
            'Gestire l\'account e la sicurezza degli accessi — mantenere la sessione, verificare l\'indirizzo email, prevenire accessi abusivi e frodi. Base giuridica: articolo 6.1.b e 6.1.f GDPR (legittimo interesse alla sicurezza del servizio).\n\n' +
            'Inviare la newsletter — solo se la richiedi. Base giuridica: articolo 6.1.a GDPR (consenso), che puoi revocare in qualsiasi momento dalle impostazioni del tuo account o dal link in fondo a ogni email, senza che questo pregiudichi la liceità dell\'invio precedente.\n\n' +
            'Pubblicare le recensioni — su tua iniziativa. Base giuridica: articolo 6.1.a GDPR (consenso).',
        },
        {
          heading: '4. A chi comunichiamo i dati',
          body:
            'I tuoi dati non sono venduti né ceduti a terzi per finalità di marketing. Sono comunicati solo a chi ci serve per farti avere quello che hai ordinato:\n\n' +
            '• Stripe Payments Europe, Ltd. — gestione dei pagamenti con carta;\n' +
            '• il corriere incaricato della consegna — nome, indirizzo, telefono, per consegnare il pacco;\n' +
            '• il fornitore del servizio di posta elettronica transazionale — per inviarti conferme d\'ordine e comunicazioni di servizio;\n' +
            '• il fornitore dell\'infrastruttura su cui il sito è ospitato;\n' +
            '• il consulente fiscale e contabile, per gli adempimenti di legge;\n' +
            '• autorità pubbliche, quando la legge lo impone.\n\n' +
            'I fornitori che trattano dati per nostro conto agiscono come responsabili del trattamento, nominati ai sensi dell\'articolo 28 GDPR.\n\n' +
            'Trasferimenti extra UE: alcuni fornitori possono trattare dati al di fuori dello Spazio economico europeo. In tal caso il trasferimento avviene sulla base di una decisione di adeguatezza della Commissione europea oppure delle Clausole contrattuali standard di cui all\'articolo 46.2.c GDPR.',
        },
        {
          heading: '5. Per quanto tempo li conserviamo',
          body:
            'Dati dell\'account: finché l\'account resta attivo. Se lo cancelli, i dati personali sono anonimizzati immediatamente.\n\n' +
            'Fatture, ordini e documenti contabili: dieci anni dalla registrazione, come impone l\'articolo 2220 del Codice civile. Questo periodo non è riducibile su richiesta: è un obbligo di legge e prevale sulla richiesta di cancellazione, come previsto dall\'articolo 17.3.b GDPR.\n\n' +
            'Dati di navigazione e sessioni di accesso: fino alla scadenza della sessione, al massimo sette giorni.\n\n' +
            'Recensioni: finché restano pubblicate; sono rimosse se cancelli l\'account.\n\n' +
            'Indirizzo email per la newsletter: fino alla revoca del consenso.',
        },
        {
          heading: '6. I tuoi diritti',
          body:
            'Puoi esercitare in qualunque momento i diritti previsti dagli articoli da 15 a 22 del GDPR:\n\n' +
            '• accesso: sapere quali dati trattiamo e ottenerne copia;\n' +
            '• rettifica: correggere dati inesatti o incompleti;\n' +
            '• cancellazione: ottenere la rimozione dei dati, salvo quelli che dobbiamo conservare per legge;\n' +
            '• limitazione: chiedere che il trattamento sia sospeso in attesa di una verifica;\n' +
            '• portabilità: ricevere i tuoi dati in un formato strutturato e leggibile da un computer;\n' +
            '• opposizione: opporti al trattamento fondato sul nostro legittimo interesse;\n' +
            '• revoca del consenso: ritirare il consenso dove è la base giuridica del trattamento.\n\n' +
            'Due di questi diritti li eserciti da solo, subito, senza dover scrivere a nessuno: nella sezione Impostazioni del tuo account trovi "Scarica i tuoi dati", che ti restituisce un file con tutto quello che conserviamo su di te, e "Cancella account", che anonimizza i tuoi dati personali.\n\n' +
            'Per gli altri diritti scrivi a [PEC]. Rispondiamo entro un mese dalla richiesta, prorogabile di due mesi in casi complessi, dandotene conto.\n\n' +
            'Non effettuiamo processi decisionali automatizzati né profilazione ai sensi dell\'articolo 22 GDPR.',
        },
        {
          heading: '7. Reclamo al Garante',
          body:
            'Se ritieni che il trattamento dei tuoi dati violi il GDPR hai diritto di proporre reclamo all\'autorità di controllo.\n\n' +
            'In Italia è il Garante per la protezione dei dati personali, Piazza Venezia 11, 00187 Roma — telefono +39 06 696771, email protocollo@gpdp.it, PEC protocollo@pec.gpdp.it, sito www.garanteprivacy.it.\n\n' +
            'Puoi in alternativa rivolgerti all\'autorità di controllo dello Stato membro in cui risiedi o lavori, oppure adire l\'autorità giudiziaria.',
        },
        {
          heading: '8. Sicurezza',
          body:
            'Adottiamo misure tecniche e organizzative adeguate al rischio: password conservate solo come hash con algoritmo BCrypt, connessioni cifrate in HTTPS, cookie di sessione HttpOnly non leggibili da JavaScript, limitazione dei tentativi di accesso ripetuti e accesso ai dati limitato a chi ne ha bisogno.\n\n' +
            'Nessuna misura elimina del tutto il rischio. In caso di violazione dei dati personali che comporti un rischio elevato per i tuoi diritti, ti informeremo senza ingiustificato ritardo, come prevede l\'articolo 34 GDPR.',
        },
        {
          heading: '9. Modifiche a questa informativa',
          body:
            'Se cambiano le finalità, le basi giuridiche o i destinatari, aggiorniamo questa pagina e ne modifichiamo la data in alto. Quando le modifiche sono sostanziali te lo comunichiamo via email prima che diventino efficaci.',
        },
      ],
    },

    // ─── Cookie ────────────────────────────────────────────────────────────
    cookies: {
      title: 'Cookie policy',
      updatedAt: '15 settembre 2026',
      intro:
        'Questa pagina elenca, uno per uno, i cookie e gli spazi di memoria locale che Common Era utilizza, a cosa servono e quanto durano. Usiamo esclusivamente cookie tecnici: nessun cookie analitico, pubblicitario o di profilazione, di nessun tipo.',
      sections: [
        {
          heading: 'Che cosa sono i cookie',
          body: 'I cookie sono piccoli file di testo che un sito salva nel tuo browser. Servono al sito per ricordare qualcosa fra una pagina e l\'altra — per esempio che hai fatto l\'accesso. Il "local storage" funziona in modo simile, ma resta nel browser indipendentemente dai cookie. Entrambi si possono cancellare in qualsiasi momento dalle impostazioni del browser.',
        },
        {
          heading: 'Perché non ti chiediamo il consenso',
          body: 'L\'articolo 122 del Codice privacy italiano, che recepisce la direttiva ePrivacy, richiede il consenso preventivo solo per i cookie non tecnici — quelli analitici non anonimizzati, quelli pubblicitari e quelli di profilazione. Per i cookie tecnici, cioè quelli senza i quali il servizio che hai chiesto non funziona, è sufficiente informarti: ed è quello che fa questa pagina.\n\nTutti i cookie elencati qui sotto sono tecnici. Per questo l\'avviso che vedi alla prima visita non ha un pulsante "Rifiuta": non ci sarebbe niente da rifiutare, e un rifiuto che non rifiuta nulla sarebbe solo una finzione. Se un giorno introdurremo cookie non tecnici, questa pagina sarà aggiornata prima e l\'avviso tornerà a chiederti una scelta vera.',
        },
        {
          heading: 'I cookie che usiamo',
          body: 'La tabella elenca tutto ciò che viene salvato nel tuo browser da Common Era e da Stripe, il fornitore che gestisce i pagamenti con carta.',
          cookies: [
            {
              name: 'access_token',
              type: 'Cookie HTTP (HttpOnly)',
              purpose:
                'Mantiene la sessione di accesso sotto forma di token firmato. Viene inviato a ogni richiesta per tenerti collegato anche dopo un ricaricamento della pagina. Essendo HttpOnly non è leggibile da JavaScript, ma solo dal server.',
              duration: '7 giorni (eliminato all\'uscita)',
              category: 'Tecnico',
            },
            {
              name: 'common_era_cookie_consent',
              type: 'localStorage',
              purpose:
                'Ricorda che hai già letto l\'informativa cookie, così l\'avviso non ricompare a ogni pagina. Contiene solo la data di lettura.',
              duration: 'Permanente (finché non svuoti i dati del browser)',
              category: 'Tecnico',
            },
            {
              name: 'commonera_cart',
              type: 'localStorage',
              purpose:
                'Conserva il carrello quando navighi senza aver effettuato l\'accesso, così non perdi quello che hai scelto cambiando pagina. Al momento del login viene unito al carrello del tuo account.',
              duration: 'Permanente (finché non svuoti i dati del browser)',
              category: 'Tecnico',
            },
            {
              name: '__stripe_mid',
              type: 'Cookie HTTP (terza parte: Stripe)',
              purpose:
                'Impostato da Stripe durante il pagamento per prevenire le frodi. Identifica il dispositivo attraverso più sessioni e permette a Stripe di riconoscere tentativi di pagamento anomali. Necessario per eseguire in sicurezza il pagamento che hai richiesto.',
              duration: '1 anno',
              category: 'Tecnico',
            },
            {
              name: '__stripe_sid',
              type: 'Cookie HTTP (terza parte: Stripe)',
              purpose:
                'Impostato da Stripe durante il pagamento, con la stessa funzione antifrode di __stripe_mid, ma limitato alla singola sessione di pagamento.',
              duration: '30 minuti',
              category: 'Tecnico',
            },
          ],
        },
        {
          heading: 'I cookie di Stripe',
          body: 'I cookie __stripe_mid e __stripe_sid sono impostati da Stripe Payments Europe, Ltd., che agisce come titolare autonomo del trattamento per le finalità di prevenzione delle frodi. Vengono impostati soltanto quando raggiungi la pagina di pagamento: se navighi il catalogo senza acquistare, non compaiono mai.\n\nServono a eseguire il servizio di pagamento che sei tu a chiedere, quindi rientrano fra i cookie tecnici e non richiedono consenso. L\'informativa privacy di Stripe è consultabile su stripe.com/privacy.',
        },
        {
          heading: 'Nessun cookie analitico o pubblicitario',
          body: 'Common Era non usa Google Analytics, Meta Pixel, circuiti pubblicitari o altri servizi di tracciamento di terze parti. Nessun dato sul tuo comportamento di navigazione viene condiviso con soggetti esterni per finalità commerciali.',
        },
        {
          heading: 'Come cancellare i cookie',
          body:
            'Puoi eliminare cookie e local storage in qualsiasi momento:\n' +
            '• Chrome ed Edge: Impostazioni → Privacy e sicurezza → Cancella dati di navigazione\n' +
            '• Firefox: Impostazioni → Privacy e sicurezza → Cookie e dati dei siti web → Elimina dati\n' +
            '• Safari: Impostazioni → Avanzate → Dati dei siti web → Rimuovi tutti\n\n' +
            'Eliminando access_token verrai disconnesso. Eliminando common_era_cookie_consent l\'avviso ricomparirà alla visita successiva. Puoi comunque rileggere l\'informativa quando vuoi, dal link "Gestisci cookie" in fondo a ogni pagina.',
        },
        {
          heading: 'Modifiche a questa pagina',
          body: 'Se introdurremo nuovi cookie, questa pagina sarà aggiornata prima della messa in esercizio. Se si trattasse di cookie non tecnici, l\'avviso ricomparirà per raccogliere un consenso vero, granulare e revocabile.',
        },
      ],
    },

    // ─── Condizioni di vendita ─────────────────────────────────────────────
    terms: {
      title: 'Condizioni generali di vendita',
      updatedAt: '15 settembre 2026',
      intro:
        'Queste condizioni regolano i contratti di vendita conclusi a distanza attraverso il sito Common Era. Formano parte integrante di ogni ordine: accettarle è il presupposto per acquistare. Ti consigliamo di salvarne o stamparne una copia.',
      sections: [
        {
          heading: '1. Il venditore',
          body: 'Il venditore è [RAGIONE SOCIALE], con sede legale in [SEDE LEGALE], partita IVA [P.IVA], iscritta al Registro delle Imprese con numero REA [REA], PEC [PEC].',
        },
        {
          heading: '2. Ambito di applicazione',
          body: 'Le presenti condizioni si applicano alle vendite effettuate nei confronti di consumatori ai sensi dell\'articolo 3 del Codice del consumo (D.Lgs. 206/2005), cioè persone fisiche che agiscono per scopi estranei alla propria attività imprenditoriale o professionale.\n\nSe acquisti indicando una partita IVA agisci come professionista: in questo caso non si applicano le norme sul diritto di recesso e sulla garanzia legale di conformità riservate ai consumatori.',
        },
        {
          heading: '3. Prodotti e disponibilità',
          body: 'Le immagini e le descrizioni dei prodotti hanno lo scopo di rappresentarli il più fedelmente possibile. Differenze di colore dovute alla resa dello schermo o lievi variazioni nei materiali naturali non costituiscono difetto di conformità.\n\nLa disponibilità indicata è aggiornata in tempo reale, ma può cambiare fra il momento in cui aggiungi un articolo al carrello e quello in cui concludi l\'ordine. Se un articolo risultasse indisponibile dopo la conclusione dell\'ordine, ti avviseremo e rimborseremo integralmente l\'importo corrispondente.',
        },
        {
          heading: '4. Prezzi',
          body: 'Tutti i prezzi sono espressi in euro e si intendono comprensivi di IVA. Le spese di spedizione sono indicate separatamente prima della conferma dell\'ordine e sommate al totale.\n\nIl prezzo applicabile è quello esposto al momento dell\'invio dell\'ordine. Ci riserviamo di modificare i prezzi in qualsiasi momento, senza che ciò abbia effetto sugli ordini già confermati.\n\nIn caso di errore materiale evidente nell\'indicazione del prezzo — un importo palesemente incongruo rispetto al valore del bene — ti contatteremo prima di dare corso all\'ordine, e potrai confermarlo al prezzo corretto o annullarlo senza alcun costo.',
        },
        {
          heading: '5. Come si conclude il contratto',
          body:
            'La presentazione dei prodotti sul sito è un invito a proporre. Il contratto si conclude quando ti inviamo la conferma d\'ordine via email, non al momento dell\'invio dell\'ordine.\n\n' +
            'Prima di inviare l\'ordine ti viene mostrato un riepilogo completo con prodotti, quantità, prezzo unitario, spese di spedizione e totale da pagare, e hai la possibilità di correggere eventuali errori di inserimento.\n\n' +
            'La conferma d\'ordine riepiloga tutte le informazioni previste dall\'articolo 51 del Codice del consumo e vale come conferma su supporto durevole.',
        },
        {
          heading: '6. Pagamenti',
          body: 'I pagamenti con carta sono gestiti da Stripe Payments Europe, Ltd. su connessione cifrata. I dati della tua carta non transitano né sono conservati sui nostri server: li tratta direttamente Stripe.\n\nPuoi inoltre utilizzare buoni regalo emessi da noi e punti fedeltà accumulati con gli acquisti precedenti, a scomputo totale o parziale del prezzo. L\'importo residuo, se presente, va saldato con carta.\n\nL\'ordine viene lavorato solo dopo la conferma dell\'avvenuto pagamento. Un pagamento non riuscito comporta l\'annullamento dell\'ordine e il ripristino della disponibilità degli articoli.',
        },
        {
          heading: '7. Fatturazione',
          body: 'Per ogni ordine viene emessa fattura, scaricabile in PDF dalla sezione "I miei ordini" del tuo account. I dati di fatturazione sono quelli che hai indicato al momento dell\'ordine: non è possibile modificarli dopo l\'emissione del documento.',
        },
        {
          heading: '8. Consegna',
          body: 'Tempi, costi e modalità di consegna sono descritti nella pagina Spedizioni e resi, che forma parte integrante di queste condizioni.\n\nAi sensi dell\'articolo 61 del Codice del consumo, la consegna avviene entro trenta giorni dalla conclusione del contratto, salvo diverso termine concordato. Il rischio di perdita o danneggiamento dei beni passa a te nel momento in cui tu, o un terzo da te designato diverso dal vettore, entri materialmente in possesso della merce.',
        },
        {
          heading: '9. Diritto di recesso',
          body: 'Se sei un consumatore hai quattordici giorni per recedere dall\'acquisto senza doverne indicare il motivo. Modalità, termini e modulo tipo sono descritti nella pagina Diritto di recesso, che forma parte integrante di queste condizioni.',
        },
        {
          heading: '10. Garanzia legale di conformità',
          body:
            'Tutti i prodotti sono coperti dalla garanzia legale di conformità prevista dagli articoli da 128 a 135-septies del Codice del consumo: se il bene consegnato risulta difettoso o non conforme a quanto ordinato, hai diritto al ripristino della conformità, mediante riparazione o sostituzione senza spese, e in subordine alla riduzione del prezzo o alla risoluzione del contratto.\n\n' +
            'La garanzia dura due anni dalla consegna. Il difetto va denunciato entro due mesi dalla scoperta. Per i primi dodici mesi si presume che il difetto esistesse già al momento della consegna, salvo prova contraria.\n\n' +
            'La garanzia non copre i danni derivanti da uso improprio, negligenza, urti o normale usura.',
        },
        {
          heading: '11. Reclami e risoluzione delle controversie',
          body:
            'Per qualsiasi reclamo puoi scrivere a [PEC]. Rispondiamo entro quindici giorni lavorativi.\n\n' +
            'Se non trovassimo un accordo, in quanto consumatore puoi ricorrere alla piattaforma europea di risoluzione delle controversie online (ODR) predisposta dalla Commissione europea, oppure attivare una procedura di mediazione ai sensi del D.Lgs. 28/2010. Il ricorso a tali procedure è facoltativo e non pregiudica il diritto di adire l\'autorità giudiziaria.',
        },
        {
          heading: '12. Legge applicabile e foro competente',
          body: 'I contratti sono regolati dalla legge italiana. Se sei un consumatore, resta ferma l\'applicazione delle disposizioni inderogabili più favorevoli previste dalla legge del tuo Paese di residenza, e il foro competente è quello del tuo luogo di residenza o domicilio elettivo, ai sensi dell\'articolo 66-bis del Codice del consumo.',
        },
        {
          heading: '13. Modifiche',
          body: 'Possiamo modificare queste condizioni in qualunque momento. Alle vendite già concluse si applica sempre la versione in vigore al momento dell\'invio dell\'ordine, di cui la conferma d\'ordine dà atto.',
        },
      ],
    },

    // ─── Recesso ───────────────────────────────────────────────────────────
    recesso: {
      title: 'Diritto di recesso',
      updatedAt: '15 settembre 2026',
      intro:
        'Se acquisti come consumatore hai quattordici giorni per cambiare idea e restituire quello che hai comprato, senza dover spiegare il perché e senza penalità. È un diritto previsto dagli articoli da 52 a 59 del Codice del consumo (D.Lgs. 206/2005) e non può esserti tolto.',
      sections: [
        {
          heading: 'Quanto tempo hai',
          body: 'Quattordici giorni di calendario, che decorrono dal giorno in cui tu, o un terzo da te designato diverso dal vettore, ricevi materialmente la merce.\n\nSe un unico ordine comprende più beni consegnati separatamente, il termine decorre dal giorno in cui ricevi l\'ultimo bene.\n\nPer rispettare il termine è sufficiente che tu invii la comunicazione di recesso prima della scadenza: non serve che la merce sia già tornata da noi.',
        },
        {
          heading: 'Come comunicare il recesso',
          body:
            'Puoi farlo in due modi, a tua scelta.\n\n' +
            'Dal sito: apri la sezione "I miei ordini" del tuo account, seleziona l\'ordine e usa il pulsante "Richiedi reso" indicando gli articoli da restituire. La richiesta viene registrata con data e ora, e ne ricevi conferma via email.\n\n' +
            'Per iscritto: invia una dichiarazione esplicita a [PEC], utilizzando il modulo tipo riportato più sotto oppure una qualsiasi altra dichiarazione chiara in cui manifesti la volontà di recedere. L\'uso del modulo non è obbligatorio.\n\n' +
            'Ti invieremo senza indugio una conferma di ricevimento della richiesta su supporto durevole.',
        },
        {
          heading: 'Come restituire la merce',
          body:
            'Dopo aver comunicato il recesso devi restituire i beni entro quattordici giorni, all\'indirizzo che ti indicheremo nell\'email di conferma.\n\n' +
            'I beni vanno restituiti integri, completi di ogni parte e accessorio, con le etichette originali ancora applicate e nella confezione di origine, quando possibile.\n\n' +
            'Puoi maneggiare e provare i beni solo quanto basta per stabilirne natura, caratteristiche e funzionamento, esattamente come faresti in un negozio fisico. Sei responsabile della diminuzione di valore che derivi da una manipolazione diversa: in tal caso potremo trattenere dal rimborso un importo corrispondente alla perdita di valore.',
        },
        {
          heading: 'Chi paga il reso',
          body: 'Il costo diretto della restituzione è a tuo carico, come consentito dall\'articolo 57 del Codice del consumo, e questa pagina te ne informa prima dell\'acquisto come la legge richiede.\n\nFa eccezione il caso in cui il bene sia difettoso, non conforme o diverso da quello ordinato: in quel caso il reso non ti costa nulla e le spese sono a nostro carico.\n\nTi consigliamo di conservare la ricevuta di spedizione: fino a quando la merce non ci arriva, il rischio del trasporto resta tuo.',
        },
        {
          heading: 'Quando e come ti rimborsiamo',
          body:
            'Ti rimborsiamo tutti i pagamenti ricevuti, comprese le spese di consegna standard, entro quattordici giorni dal momento in cui siamo informati del recesso.\n\n' +
            'Possiamo però trattenere il rimborso finché non riceviamo i beni, oppure finché non dimostri di averli spediti, a seconda di quale evento si verifichi per primo.\n\n' +
            'Il rimborso avviene con lo stesso mezzo di pagamento che hai usato per l\'acquisto, salvo tuo diverso accordo espresso, e non comporta in nessun caso costi per te. Buoni regalo e punti fedeltà utilizzati sono ricreditati sul tuo account.\n\n' +
            'Se avevi scelto una spedizione più rapida di quella standard, ti rimborsiamo l\'importo della spedizione standard: la differenza resta a tuo carico.',
        },
        {
          heading: 'Quando il recesso non si applica',
          body:
            'L\'articolo 59 del Codice del consumo esclude il diritto di recesso in alcuni casi. Fra quelli che possono riguardare questo negozio:\n\n' +
            '• beni confezionati su misura o chiaramente personalizzati su tua richiesta;\n' +
            '• beni sigillati che non si prestano a essere restituiti per motivi igienici, se sono stati aperti dopo la consegna;\n' +
            '• beni che, dopo la consegna, risultino inscindibilmente mescolati con altri.\n\n' +
            'Quando un prodotto rientra in una di queste categorie, l\'esclusione è indicata nella scheda prodotto prima dell\'acquisto.',
        },
        {
          heading: 'Modulo tipo di recesso',
          body:
            'Compila e restituisci questo modulo solo se desideri recedere dal contratto. Il suo utilizzo non è obbligatorio.\n\n' +
            '— — — — — — — — — — — — — — — — — — — — — — — — — — — — — —\n\n' +
            'Destinatario: [RAGIONE SOCIALE], [SEDE LEGALE], PEC [PEC]\n\n' +
            'Con la presente io/noi (*) notifico/notifichiamo (*) il recesso dal mio/nostro (*) contratto di vendita dei seguenti beni (*):\n\n' +
            '____________________________________________\n\n' +
            'Ordinato il (*) / ricevuto il (*): ____________________\n\n' +
            'Numero dell\'ordine: ____________________\n\n' +
            'Nome del/dei consumatore/i: ____________________\n\n' +
            'Indirizzo del/dei consumatore/i: ____________________\n\n' +
            'Firma del/dei consumatore/i (solo se il presente modulo è notificato in versione cartacea): ____________________\n\n' +
            'Data: ____________________\n\n' +
            '(*) Cancellare la dicitura inutile.\n\n' +
            '— — — — — — — — — — — — — — — — — — — — — — — — — — — — — —',
        },
      ],
    },

    // ─── Spedizioni e resi ─────────────────────────────────────────────────
    'spedizioni-e-resi': {
      title: 'Spedizioni e resi',
      updatedAt: '15 settembre 2026',
      intro:
        'Quanto costa la spedizione, quanto tempo serve perché il pacco arrivi, e cosa fare se quello che hai ricevuto non va bene. Le cifre riportate qui sono le stesse che il carrello applica al momento dell\'ordine.',
      sections: [
        {
          heading: 'Dove spediamo',
          body: 'Spediamo in tutta Italia, isole comprese. Per le consegne al di fuori del territorio italiano scrivici prima dell\'ordine a [PEC]: tempi e costi vengono concordati caso per caso.',
        },
        {
          heading: 'Costi di spedizione',
          body:
            'Spedizione standard: 4,90 €.\n' +
            'Spedizione express: 9,90 €.\n\n' +
            'La spedizione standard è gratuita per gli ordini che, dopo l\'applicazione di eventuali sconti e codici promozionali, raggiungono i 100 €. La soglia si calcola sull\'importo effettivamente scontato, non sul prezzo di listino.\n\n' +
            'Il costo esatto ti viene mostrato nel riepilogo prima della conferma dell\'ordine, e compare come voce separata in fattura.',
        },
        {
          heading: 'Tempi di consegna',
          body:
            'Spedizione standard: 3-5 giorni lavorativi dalla presa in carico del corriere.\n' +
            'Spedizione express: 1-2 giorni lavorativi dalla presa in carico del corriere.\n\n' +
            'Gli ordini ricevuti e pagati entro le 13:00 di un giorno lavorativo vengono di norma affidati al corriere lo stesso giorno; quelli successivi il primo giorno lavorativo utile. Sabato, domenica e festivi non sono giorni lavorativi.\n\n' +
            'Nei periodi di saldi e nelle settimane prima delle festività i tempi possono allungarsi di uno o due giorni. In ogni caso, ai sensi dell\'articolo 61 del Codice del consumo, la consegna avviene entro trenta giorni dalla conclusione del contratto.',
        },
        {
          heading: 'Come seguire la spedizione',
          body: 'Appena il pacco parte ricevi un\'email con il numero di tracciamento. Lo stesso numero, con il link al sito del corriere, è sempre visibile nella sezione "I miei ordini" del tuo account, insieme alla cronologia completa degli stati dell\'ordine.',
        },
        {
          heading: 'Se il pacco non arriva o arriva danneggiato',
          body:
            'Al momento della consegna controlla che l\'imballo sia integro. Se è visibilmente danneggiato o manomesso, accetta il pacco con riserva scritta sul documento del corriere e segnalacelo entro sette giorni: senza la riserva la contestazione al vettore diventa molto più difficile.\n\n' +
            'Se il pacco risulta consegnato ma non lo hai ricevuto, scrivici a [PEC]: apriamo noi la pratica con il corriere. Fino alla consegna il rischio di perdita o danneggiamento resta a nostro carico.',
        },
        {
          heading: 'Resi: due strade diverse',
          body:
            'Ripensamento — hai quattordici giorni per restituire l\'acquisto senza dare spiegazioni. È il diritto di recesso: modalità, termini e modulo tipo stanno nella pagina dedicata. Le spese di restituzione sono a tuo carico.\n\n' +
            'Prodotto difettoso o sbagliato — se quello che hai ricevuto è difettoso, non conforme o diverso da quello ordinato, si applica la garanzia legale di conformità, che dura due anni dalla consegna. In questo caso la restituzione non ti costa nulla e hai diritto alla riparazione o alla sostituzione senza spese, e in subordine alla riduzione del prezzo o alla risoluzione del contratto.',
        },
        {
          heading: 'Come aprire un reso',
          body:
            '1. Entra nella sezione "I miei ordini" del tuo account. La richiesta si può aprire sugli ordini già consegnati o completati.\n' +
            '2. Premi "Richiedi reso" sull\'ordine, scegli quali articoli restituire e in che quantità, e descrivi il motivo in almeno dieci caratteri.\n' +
            '3. Ricevi via email la conferma della richiesta con l\'indirizzo a cui spedire e le istruzioni.\n' +
            '4. Spedisci la merce entro quattordici giorni dalla comunicazione, conservando la ricevuta.\n' +
            '5. Al ricevimento verifichiamo lo stato dei beni e procediamo al rimborso.\n\n' +
            'Puoi seguire lo stato della richiesta nella stessa pagina: richiesto, approvato, ricevuto, rimborsato — oppure rifiutato, con la motivazione.',
        },
        {
          heading: 'Tempi di rimborso',
          body: 'Il rimborso viene disposto entro quattordici giorni dal momento in cui riceviamo la comunicazione di recesso, fermo restando che possiamo attenderne la merce o la prova della spedizione.\n\nL\'accredito sul tuo metodo di pagamento dipende poi dai tempi tecnici dell\'emittente della carta, di norma da tre a cinque giorni lavorativi. Buoni regalo e punti fedeltà tornano immediatamente disponibili sul tuo account.',
        },
        {
          heading: 'Cambi',
          body: 'Non gestiamo il cambio diretto di taglia o colore: la disponibilità cambia troppo in fretta perché possiamo garantirti l\'articolo per il tempo del viaggio di ritorno. Apri un reso per l\'articolo che non va bene e ordina separatamente quello che vuoi: è più rapido e ti assicura di prendere la taglia finché c\'è.',
        },
      ],
    },
  };

  /** Il documento da mostrare, oppure `null` quando la pagina non esiste. */
  get doc(): LegalDoc | null {
    const key = this.pageKey();
    return key === null ? null : this.docs[key];
  }

  constructor() {
    this.route.paramMap.subscribe((params) => {
      this.pageKey.set(asLegalKey(params.get('pagina')));
    });
  }
}

/**
 * La chiave della pagina, o `null` se non corrisponde a niente.
 *
 * Prima qualunque stringa sconosciuta ricadeva su `privacy`: `/legal/qualsiasi-cosa`
 * rispondeva con l'informativa privacy e con uno stato 200. Per un motore di ricerca
 * significava un numero illimitato di URL diversi che servivano tutti la stessa
 * pagina — contenuto duplicato — e per una persona significava trovarsi davanti un
 * documento che non aveva chiesto, senza capire di aver sbagliato indirizzo.
 */
export function asLegalKey(value: string | null): LegalKey | null {
  return LEGAL_KEYS.includes(value as LegalKey) ? (value as LegalKey) : null;
}

# Cosa manca

Elenco ricostruito **leggendo il codice** il 16 settembre 2026, sul backend Java
(`server-java/`) e sul frontend Angular. La versione precedente di questo file
descriveva il backend NestJS dismesso e dichiarava mancanti tre cose che ci sono:
il carrello persistente, il banner dei cookie e le gift card nel checkout.

Ogni voce dice **come e' stata verificata**, cosi' la prossima volta si ricontrolla
invece di fidarsi.

---

## 1. Il negozio non incassa

Questo e' il buco piu' grande: si puo' concludere un ordine senza che nessuno paghi.

### L'incasso non esiste

`CheckoutService.placeOrder` scrive una riga in `payments` gia' in stato
`succeeded`, con `paid_at` valorizzato, senza aver parlato con nessun fornitore di
pagamento. Le colonne `provider` e `provider_tx_id` restano vuote.

L'astrazione per farlo davvero c'e' gia': `PaymentGateway`, con
`SimulatedPaymentGateway` e `StripePaymentGateway`, piu' `PaymentConfig` che sceglie
l'una o l'altra in base alla configurazione. **Nessuno la usa.** Cercando
`PaymentGateway` in `server-java/src/main` si trova un unico riferimento, ed e'
`PaymentConfig` che costruisce il bean.

### Non c'e' il webhook

Non esiste nessun controller su `/payments`, e `SecurityConfig` non ha nessuna
rotta di pagamento fra i `permitAll`: con `anyRequest().authenticated()`, un
webhook — che arriva senza cookie di sessione — verrebbe respinto con un 401.
Senza webhook non c'e' modo di sapere se un pagamento e' andato a buon fine.

### Non c'e' il raccoglitore degli ordini abbandonati

Nel backend non c'e' **nessun** `@Scheduled` e nessun `@EnableScheduling`. Se un
giorno la giacenza venisse riservata all'inizio del pagamento, un checkout
abbandonato la terrebbe bloccata per sempre.

### I rimborsi non vengono mai scritti

`OrderService.cancel` e `ReturnService` rimettono a posto giacenza, punti fedelta'
e gift card, ma non toccano `payments`: la colonna `refunded_amount` esiste nello
schema e resta sempre a zero. Un reso approvato non lascia traccia contabile.

L'enum Postgres `"PaymentStatus"` ha `pending/succeeded/failed/refunded` e non ha
`partially_refunded`: un reso parziale non e' nemmeno rappresentabile.

### Il frontend non ha un passo di pagamento

`CheckoutStep` va da `shipping` a `review` senza passare per un incasso, in
`e-commerce/package.json` non c'e' nessuna libreria Stripe, e `checkout.html`
dichiara per iscritto che il pagamento e' simulato.

---

## 2. Nessuna email dopo un ordine

`MailService` sa mandare otto messaggi: prodotto tornato disponibile, cambio stato
di un reso, conferma iscrizione newsletter, verifica indirizzo email, conferma
cambio email, avviso di email cambiata, reset password, avviso di password
cambiata.

Non ce n'e' **nessuno** che riguardi un ordine. Chi compra non riceve conferma,
non riceve la fattura, non viene avvisato della spedizione ne' della consegna. La
fattura PDF esiste (`InvoiceService`, `GET /orders/{id}/invoice`) ma bisogna andare
a cercarsela in `/me`.

---

## 3. Sicurezza

### Il limite di richieste copre una sola rotta

`LoginRateLimiterService` e' usato **solo** da `AuthService.login`. Restano senza
alcun limite: registrazione, `forgot-password`, `reset-password`, checkout,
scrittura recensioni, e non esiste un tetto complessivo per indirizzo IP.

In piu' il limitatore tiene il conteggio **in memoria** e ha come chiave l'email:
si azzera a ogni riavvio, non regge piu' di un'istanza del backend, e non ferma
chi prova mille email diverse dallo stesso IP.

### Un amministratore puo' portare un ordine in qualunque stato

`AdminService.updateOrderStatus` converte la stringa ricevuta in un `OrderStatus` e
la scrive, punto. Nessun controllo di legittimita' della transizione e nessuna
compensazione: un ordine `cancelled` puo' diventare `delivered`, e un `delivered`
puo' tornare `pending`, senza che giacenza, punti e buoni vengano toccati.

Serve una macchina a stati esplicita con le transizioni ammesse — la logica di
compensazione esiste gia' e si chiama `OrderCompensationService`.

---

## 4. Infrastruttura

Stato al momento della verifica (c'e' del lavoro in corso su questo fronte):

- **Nessun reverse proxy e nessun TLS.** Frontend (4200) e backend (3000) sono
  esposti direttamente sull'host, in HTTP.
- **Postgres e' raggiungibile dall'esterno**: `docker-compose.yml` pubblica la
  porta `5433`, che serve solo a guardare i dati durante lo sviluppo.
- **Una sola rete**, quella predefinita del compose: il database sta sullo stesso
  bridge del frontend.
- `COOKIE_SECURE` e' `false` — e deve restarlo finche' non c'e' HTTPS, altrimenti
  il browser smette di mandare il cookie e il login sparisce.
- Non esiste un `docker-compose.prod.yml`: si sta in piedi con un solo profilo.

---

## 5. Frontend

### Non c'e' modo di cercare un prodotto

Il backend accetta `GET /products?search=`, la pagina `/products` legge il
parametro `q` dall'URL e lo applica ai filtri — ma **nessun componente disegna una
casella di ricerca**. La barra in alto non ne ha una. Esisteva un componente
`search-bar` che funzionava e che nessuna pagina importava: e' stato rimosso perche'
codice morto, e la funzione resta da fare per davvero, montandola nella barra.

### "Imposta come indirizzo predefinito" risponde 404

`me.ts` chiama `PATCH /api/addresses/{id}/default`. Il backend espone
`PATCH /api/addresses/{id}/set-default` (`AddressesController`). I due percorsi non
combaciano: il pulsante non ha mai funzionato. E' l'**unico** disallineamento
trovato confrontando una per una tutte le chiamate del frontend con le rotte
dichiarate nei controller.

### Servizio vuoto

`e-commerce/src/app/services/users-service.ts` e' una classe `UsersService` senza un
solo metodo. Le chiamate del profilo stanno dentro `AuthService` e dentro `me.ts`.
O si riempie o si toglie.

### I test sono quasi tutti "should create"

Su 54 test frontend, la maggioranza sono gli smoke generati dallo schematic, che
verificano solo che il componente si istanzi. Hanno copertura vera soltanto:
pagine legali, consenso cookie, carrello (2 test), autenticazione (3), `/me` (6) e
la pagina 404 (6). **Checkout e scheda prodotto non hanno un solo test di
comportamento**, e sono le due pagine dove si perdono i soldi e le vendite.

---

## 6. Pannello di amministrazione: endpoint senza interfaccia

Il backend espone piu' di quello che il pannello mostra:

| Endpoint | Cosa fa | Interfaccia |
|---|---|---|
| `GET /admin/inventory`, `PATCH /admin/inventory/{variantId}/stock` | magazzino e rettifiche di giacenza | nessuna |
| `GET /admin/gift-cards`, `POST /admin/gift-cards` | elenco ed emissione buoni | nessuna |
| `GET /admin/users/export` | elenco utenti in CSV | nessuna |
| `GET /admin/products/export` | catalogo in CSV | nessuna |

`GET /admin/orders/export` e' l'unico dei tre export con un pulsante
(`AdminService.exportOrders`).

---

## 7. Funzioni di negozio che non ci sono

- **Carrello abbandonato**: nessun promemoria, nessuna statistica.
- **Sitemap e `robots.txt`**: `e-commerce/public/` non li contiene. Il sito e' reso
  lato server proprio per essere indicizzato, e poi non dice a un motore di ricerca
  quali pagine esistono.
- **Tracciamento della spedizione**: c'e' la colonna `orders.tracking_number` e il
  campo nel pannello admin, ma nessun collegamento a un corriere e nessuna pagina
  di stato per il cliente.
- **Notifiche in-app**: la tabella `notifications` esiste ed e' vuota di codice.

---

## 8. Tabelle nello schema che nessuno usa

`database/init/001_schema.sql` descrive un negozio piu' grande di quello
costruito. Queste tabelle non hanno **nessuna** entita' JPA e nessun codice:

| Tabella | Cosa avrebbe dovuto essere |
|---|---|
| `notifications` | notifiche in-app |
| `tags`, `product_tags` | etichette libere sui prodotti |
| `review_replies` | risposte del negozio alle recensioni |
| `ai_outfit_suggestions`, `ai_outfit_suggestion_items` | abbinamenti suggeriti |
| `audit_logs` | tracciamento delle azioni amministrative |

Vanno riempite o tolte dallo schema: una tabella che esiste e non viene mai scritta
fa credere a chi legge lo schema che la funzione ci sia.

`audit_logs` in particolare pesa piu' delle altre: senza, non c'e' modo di sapere
quale amministratore ha cambiato un prezzo o annullato un ordine.

---

## Cosa invece c'e' — e la documentazione diceva di no

Da leggere prima di riscrivere qualcosa che esiste gia'.

| Si credeva mancante | Realta', verificata |
|---|---|
| Carrello non persistente | Persistente: `localStorage` da ospite, tabelle `carts`/`cart_items` da collegato, fusione al login via `POST /cart/merge` (`cart-service.ts`) |
| Nessun avviso cookie | C'e' (`CookieConsentService` + `app.html`), riapribile dal link "Gestisci cookie" nel footer |
| Gift card assenti dal frontend | Presenti nel checkout, insieme ai codici promo e ai punti fedelta' |
| Pagine legali assenti o in inglese | Cinque pagine in italiano: privacy, cookie, condizioni, recesso, spedizioni e resi |
| Export dati e cancellazione account (GDPR) | `GET /users/me/export` e `DELETE /users/me`, con cancellazione logica e anonimizzazione (`PrivacyService`) |
| Catalogo senza immagini | 24 illustrazioni prodotto, 10 categorie, 6 collezioni in `e-commerce/public/media/catalogo/`. Nessun URL `via.placeholder.com` o Unsplash e' rimasto |
| Codici promo, resi, newsletter da portare in Java | Portati: `PromoCodesController`, `ReturnsController`, `NewsletterController` |
| Il jolly delle rotte manda in home | Non piu': c'e' una 404 vera, con stato HTTP 404 |

---

## Priorita'

1. **L'incasso** (sezione 1). Finche' manca, il negozio non e' un negozio.
2. **Le email d'ordine** (sezione 2): vanno insieme all'incasso, perche' la
   conferma si manda quando il pagamento riesce.
3. **Le transizioni di stato e il limite di richieste** (sezione 3).
4. **Reverse proxy e TLS** (sezione 4): proteggono qualcosa che deve gia' essere
   corretto, quindi vengono dopo.
5. Il resto, in ordine di fastidio.

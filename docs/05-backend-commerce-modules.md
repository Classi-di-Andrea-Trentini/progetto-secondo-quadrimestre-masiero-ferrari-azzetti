# Backend — il resto del negozio

Carrello, checkout, ordini, resi, promo, gift card, punti fedelta', recensioni,
wishlist, indirizzi, avvisi di disponibilita', newsletter, amministrazione.

## Carrello — `CartService`, `CartController`

Tabelle `carts` e `cart_items`, una riga per utente. Rotte: `GET /cart`,
`POST /cart/items`, `PATCH /cart/items/{variantId}`, `DELETE /cart/items/{variantId}`,
`DELETE /cart`, `POST /cart/merge`.

`POST /cart/merge` e' il pezzo che tiene insieme le due meta' del carrello: da
ospite il carrello vive nel `localStorage` del browser, e al login viene fuso con
quello sul server. Senza, chi riempie il carrello e poi si collega lo perde.

## Checkout — `CheckoutService.placeOrder`

Una sola `@Transactional`, `POST /checkout`. In ordine:

1. **L'indirizzo dev'essere di chi ordina.** Senza questo controllo basterebbe
   conoscere l'id di un indirizzo altrui per spedirci la merce.
2. **Prezzi e disponibilita' si rileggono dal database.** Quello che manda il
   client non fa testo: altrimenti basterebbe cambiare un numero nella richiesta
   per pagare meno. Nome prodotto, etichetta variante e SKU vengono **copiati**
   nella riga d'ordine, non riferiti: la fattura di ieri deve restare leggibile
   anche se il prodotto viene rinominato o tolto dal catalogo.
3. **Codice promo**, convalidato sul totale gia' scontato dalle offerte di prodotto,
   non sul listino. L'uso si registra solo dopo che l'ordine ha un id vero.
4. **Spedizione**: 4,90 € standard, 9,90 € express, **gratis sopra 100 €**. La
   soglia si guarda sull'importo **al netto del promo**: uno sconto che fa scendere
   sotto soglia deve far ricomparire il costo di spedizione.
5. **Punti fedelta' prima del buono**, cosi' il buono copre solo cio' che resta e
   non viene consumato al posto dei punti.
6. **Gift card** sull'importo residuo.
7. **Pagamento** (vedi sotto).
8. **Scarico della giacenza condizionale**:
   `UPDATE … SET stock_qty = stock_qty - ? WHERE stock_qty >= ?`. Due checkout
   sull'ultimo pezzo leggono entrambi 1 e scalerebbero entrambi, lasciando -1. Se
   l'update tocca zero righe, la transazione salta.
9. **Il carrello si svuota qui dentro**, non dal client dopo la risposta: se quella
   chiamata fallisse, resterebbero ordine fatto e carrello pieno. Si scala la
   quantita' ordinata, non si azzera la riga: chi ne aveva tre e ne ordina uno deve
   ritrovarsi gli altri due.
10. **Punti accreditati** sull'imponibile davvero scontato — tolti sia il promo sia
    i punti riscattati. Sottraendo solo il secondo, un codice promo regalava punti
    su denaro mai incassato.

### Il pagamento oggi non e' un pagamento

Il punto 7 scrive una riga in `payments` gia' in stato `succeeded`, con `paid_at`
valorizzato, **senza parlare con nessun fornitore**. Le colonne `provider` e
`provider_tx_id` restano vuote.

`PaymentGateway`, `SimulatedPaymentGateway`, `StripePaymentGateway` e
`PaymentConfig` esistono gia', ma nessun servizio li inietta. E' il buco piu' grande
del progetto: vedi [11-what-is-missing.md](./11-what-is-missing.md).

## Ordini — `OrderService`, `OrdersController`

`GET /orders` (paginato), `GET /orders/{id}`, `PATCH /orders/{id}/cancel`,
`GET /orders/{id}/invoice`.

L'annullamento passa da **`OrderCompensationService.releaseAndCancel`**, che e' una
funzione sola perche' la stessa cosa la devono fare anche il webhook del pagamento
fallito e il raccoglitore degli ordini scaduti: due implementazioni della stessa
compensazione prima o poi divergono. Rimette la giacenza, restituisce i punti e
ricarica la gift card, e usa `OrderRepository.updateStatusIfCurrentIn`, una
transizione atomica che non puo' annullare due volte lo stesso ordine.

Non scrive nulla su `payments`: nessun rimborso viene registrato.

### Fattura — `InvoiceService`

PDF generato con OpenPDF, numerazione progressiva **per anno** (`2026-0002`). Il
destinatario viene letto dall'indirizzo dell'ordine, ed e' il motivo per cui la
cancellazione di un account **svuota** l'indirizzo invece di eliminarlo.

## Resi — `ReturnService`, `ReturnsController`

`GET /returns`, `GET /returns/{id}`, `POST /returns`; lato admin
`GET /admin/returns` e `PATCH /admin/returns/{id}/status`.

Un reso si puo' chiedere solo su ordini in stato `delivered` o `completed`. Il
cambio di stato manda un'email al cliente. Anche qui: nessuna riga di rimborso
viene scritta su `payments`.

## Codici promo — `PromoCodeService`

`POST /promo-codes/validate` per il cliente; `GET/POST/PATCH/DELETE
/admin/promo-codes` per l'amministratore.

`validate` controlla attivazione, finestra di validita', importo minimo, tetto di
utilizzi complessivi e per utente. `recordUse` scrive in `promo_code_uses` e viene
chiamato dal checkout **dopo** che l'ordine esiste.

## Gift card — `GiftCardService`

`GET /gift-cards/{code}` (saldo, per il cliente); `GET/POST /admin/gift-cards`
(elenco ed emissione).

- codice generato con `SecureRandom` su un alfabeto **senza caratteri ambigui**
  (niente `I`, `O`, `0`, `1`);
- `redeem` scala il saldo con un UPDATE condizionale e scrive un movimento in
  `gift_card_transactions`;
- `refund` ricarica la carta quando un ordine viene annullato.

Le rotte amministrative non hanno nessuna interfaccia nel pannello.

## Punti fedelta' — `LoyaltyService`

`GET /loyalty` (saldo), `GET /loyalty/history`.

- **1 punto per euro** speso;
- **100 punti = 1 €** di sconto;
- riscatto da **500 punti** in su;
- `award` accredita, `redeem` scala, `reverseForOrder` restituisce quando l'ordine
  viene annullato.

Tutti i movimenti finiscono in `loyalty_entries`: il saldo e' una somma, non un
campo che qualcuno aggiorna.

## Recensioni — `ReviewService`

`GET /reviews/product/{productId}` (pubblica), `POST /reviews`,
`POST /reviews/{id}/helpful`, `DELETE /reviews/{id}`; moderazione su
`GET /admin/reviews`, `PATCH /admin/reviews/{id}/status`, `DELETE /admin/reviews/{id}`.

Il voto "utile" passa da `review_helpful_votes`, che ha un vincolo unico per
(recensione, utente): un contatore incrementato senza tabella si puo' far salire a
piacere ricaricando la pagina.

## Wishlist, indirizzi, avvisi, newsletter

- **Wishlist** — `GET /wishlist`, `GET /wishlist/ids`,
  `POST /wishlist/{productId}/toggle`. `/ids` esiste per accendere i cuoricini
  sulla griglia senza scaricare i prodotti interi.
- **Indirizzi** — `GET/POST /addresses`, `PUT /addresses/{id}`,
  `DELETE /addresses/{id}`, **`PATCH /addresses/{id}/set-default`**. ⚠️ Il frontend
  chiama `/default` invece di `/set-default`: quel pulsante risponde 404.
- **Avvisi "torna disponibile"** — `GET/POST/DELETE /stock-alerts`. Gli avvisi
  partono da `PATCH /admin/inventory/{variantId}/stock`, solo quando la giacenza
  passa da zero a un numero positivo, e **dopo** la scrittura: altrimenti si
  inviterebbe a comprare qualcosa che non c'e' ancora. Un ordine annullato rimette
  merce a scaffale ma **non** fa partire nessun avviso.
- **Newsletter** — `POST /newsletter/subscribe`, pubblica: chiunque puo'
  iscriversi, anche senza account.

## Amministrazione — `AdminService`, `AdminController`

Tutto sotto `/admin/**`, riservato al ruolo `ADMIN` da `SecurityConfig`. Copre
statistiche, magazzino e rettifiche di giacenza, stato ordini, gift card, utenti
(ruolo e cancellazione), catalogo (prodotti, categorie, varianti, immagini con
caricamento file), recensioni, codici promo, resi, ed export CSV di ordini, utenti
e prodotti.

> **`updateOrderStatus` non controlla nulla.** Converte la stringa ricevuta in un
> `OrderStatus` e la scrive: un ordine `cancelled` puo' diventare `delivered` senza
> che giacenza, punti e buoni vengano toccati. Serve una macchina a stati esplicita.

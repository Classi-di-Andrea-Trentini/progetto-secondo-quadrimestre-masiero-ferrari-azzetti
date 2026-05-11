# Stato attuale del progetto

Questo documento riassume cosa è stato completato e le eventuali limitazioni note.

---

## Funzionalità completate

Tutte le funzionalità principali sono implementate:

- **Autenticazione** — login, logout, registrazione, reset password, verifica email, sessioni revocabili
- **Catalogo prodotti** — lista con filtri multipli, dettaglio per slug, immagini per colore, recensioni
- **Carrello** — drawer laterale, gestione quantità, subtotale calcolato
- **Checkout** — multi-step (indirizzo → spedizione → riepilogo), creazione ordine con transazione atomica, applicazione promo code
- **Profilo utente (`/me`)** — tab profilo, storico ordini, preferiti, indirizzi, impostazioni (password, email)
- **Wishlist** — toggle salva/rimuovi, lista completa con prezzi scontati
- **Recensioni** — scrittura e visualizzazione per prodotto
- **Admin dashboard** — KPI, grafico ordini per stato, tabella ordini recenti
- **Admin prodotti** — lista, creazione, modifica, eliminazione
- **Admin ordini** — lista con cambio stato
- **Admin utenti** — lista con modifica ruolo/stato
- **Admin promo** — lista e creazione codici sconto
- **Admin recensioni** — moderazione
- **Admin resi** — gestione richieste
- **Guard** — `authGuardGuard` su `/me` e `/checkout`, `adminGuardGuard` su `/admin/*`
- **Email transazionali** — benvenuto, verifica email, reset password, alert cambio password

---

## Limitazioni note

### Carrello non persistente tra sessioni

Il carrello è in-memory (segnale Angular). Se l'utente ricarica la pagina o chiude il browser, il carrello si svuota. Una soluzione sarebbe serializzare `CartService.items` in `localStorage` con `localStorage.setItem('common_era_cart', JSON.stringify(...))` e ripristinarlo al costruzione del servizio (solo browser, via `isPlatformBrowser`).

### Gift card non implementate lato frontend

Le tabelle `gift_cards` e `gift_card_transactions` esistono nel database e il modello `Order` ha il campo `giftCardId`, ma la form del checkout non accetta codici gift card e la logica di scalatura del saldo non è nel `CheckoutService`.

### Nessun proxy inverso

Frontend (porta 4200) e backend (porta 3000) sono esposti direttamente. Non c'è Nginx davanti per SSL termination o unificazione dei port.

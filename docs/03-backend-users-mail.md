# Backend — utenti, privacy e posta

File: `services/UserService`, `services/PrivacyService`, `services/MailService`,
`controllers/UsersController`.

## Profilo — `UserService`

| Metodo | Cosa fa |
|---|---|
| `updateProfile` | aggiorna **solo** i campi presenti nel corpo: un campo assente non deve diventare `null` |
| `changePassword` | richiede la password attuale e **revoca tutte le altre sessioni**, tenendo in vita quella corrente |
| `requestPasswordReset` | genera un token, lo salva in `password_resets`, manda l'email. Non dice mai se l'indirizzo esiste |
| `resetPassword` | consuma il token e revoca tutte le sessioni |
| `sendVerificationEmail` / `confirmVerification` | verifica dell'indirizzo, riga in `email_verifications` |
| `requestEmailChange` / `confirmEmailChange` | **conferma al nuovo indirizzo** e avviso al vecchio |

Il cambio email chiede la password attuale, manda il link di conferma al **nuovo**
indirizzo e un avviso al vecchio: se qualcuno entrasse in un account e si spostasse
l'email addosso, il proprietario lo scoprirebbe.

## GDPR — `PrivacyService`

Due diritti, entrambi in `/me` → impostazioni.

### Export dei dati (art. 20) — `GET /users/me/export`

Restituisce un JSON con profilo, indirizzi, ordini e righe d'ordine, recensioni,
wishlist, punti fedelta' e relativi movimenti, scaricato come allegato
(`Content-Disposition: attachment`) perche' e' un file che la persona deve poter
conservare o consegnare a un altro fornitore.

E' un albero di **record** e non una mappa generica: un record elenca i campi uno
per uno, quindi il giorno in cui una colonna nuova compare in `users` non finisce
per sbaglio nell'export solo perche' esiste.

L'intero export sta dentro **una** transazione in sola lettura: con
`open-in-view=false`, toccare fuori le associazioni lazy esploderebbe con una
`LazyInitializationException`.

### Cancellazione dell'account (art. 17) — `DELETE /users/me`

La cancellazione e' **logica** (`users.deleted_at`), e non e' una scorciatoia:
`orders.user_id` e' `ON DELETE RESTRICT`, quindi il database rifiuterebbe la
cancellazione vera, e una fattura emessa va comunque conservata per legge.

Cosa succede davvero:

- i campi obbligatori (`email`, `full_name`, `password_hash`) non si possono
  azzerare, quindi **ci si scrive sopra**. L'email nuova porta un UUID e finisce su
  un dominio `@anonimo.invalid` — `.invalid` e' riservato dalla RFC 2606 e non si
  risolve, quindi non esiste il rischio di mandare posta a un indirizzo vero;
- gli indirizzi stampati su una fattura vengono **svuotati sul posto** e non
  cancellati: `orders.address_id` e' `ON DELETE SET NULL`, e la fattura in PDF legge
  il destinatario proprio da li';
- tutte le sessioni vengono revocate e la risposta porta il cookie svuotato: la
  sessione da cui si e' chiesta la cancellazione non deve sopravvivere alla
  richiesta.

L'operazione richiede la password nel corpo della richiesta: non basta avere un
cookie valido.

## Posta — `MailService`

Trasporto scelto da `MAIL_PROVIDER`:

- `smtp` → `JavaMailSender` configurato da `SMTP_*`;
- vuoto → **le email vengono solo scritte nei log**, che e' lo stato giusto in
  sviluppo.

`JavaMailSender` arriva via `ObjectProvider` e non iniettato direttamente:
l'autoconfigurazione lo crea solo se `spring.mail.host` e' valorizzato, e
iniettarlo direttamente farebbe fallire l'avvio quando la posta non e' configurata.

Timeout espliciti a 5 secondi su connessione, lettura e scrittura: senza, JavaMail
aspetta all'infinito e blocca la richiesta HTTP che ha innescato l'invio.

**Un'email che non parte non fa fallire l'operazione che l'ha innescata**: nessuno
vuole un ordine annullato perche' il server di posta non rispondeva.

> **Resend non c'e' piu'.** Era il fornitore del backend Node: nel backend Java non
> esiste una riga di codice che lo usi, e le variabili `RESEND_*` non le legge
> nessuno.

### I messaggi che esistono

1. prodotto tornato disponibile
2. cambio stato di un reso
3. conferma iscrizione newsletter
4. verifica dell'indirizzo email
5. conferma del cambio email
6. avviso "la tua email e' cambiata" (al vecchio indirizzo)
7. reimpostazione password
8. avviso "la tua password e' cambiata"

**Nessuno riguarda un ordine.** Non c'e' conferma d'ordine, non c'e' avviso di
spedizione, non c'e' avviso di consegna. E' una delle voci piu' pesanti di
[11-what-is-missing.md](./11-what-is-missing.md).

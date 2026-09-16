# Backend — autenticazione

File: `security/JwtService`, `security/JwtCookieFilter`, `security/AuthCookie`,
`security/CurrentUser`, `services/AuthService`, `services/LoginRateLimiterService`,
`controllers/AuthController`.

## Il principio: JWT **piu'** riga di sessione

Il token da solo non basterebbe. Un JWT firmato resta valido fino alla scadenza,
anche dopo che l'utente ha fatto logout: senza un secondo controllo, "esci" sarebbe
una bugia.

Quindi a ogni richiesta `JwtCookieFilter`:

1. legge il cookie `access_token`;
2. verifica firma e scadenza del token (`JwtService.parse`);
3. cerca la riga in `sessions` per **impronta** del token
   (`SessionRepository.findByTokenHash(jwt.fingerprint(token))`) e controlla che non
   sia scaduta;
4. carica l'utente e controlla che sia `is_active` e non cancellato
   (`deleted_at IS NULL`);
5. solo allora mette un `CurrentUser` nel contesto di sicurezza, con l'autorita'
   `ROLE_<ruolo maiuscolo>`.

Se uno qualsiasi dei passaggi fallisce, il filtro **non** blocca la richiesta: lascia
passare senza autenticazione, e sara' `SecurityConfig` a decidere se quella rotta e'
pubblica o no.

Cancellare la riga in `sessions` invalida la sessione **subito**, senza aspettare la
scadenza del token.

## Il cookie — `AuthCookie`

| Attributo | Valore | Perche' |
|---|---|---|
| nome | `access_token` | lo stesso del backend Node |
| `HttpOnly` | sempre | un token leggibile da JavaScript e' un token rubabile con una sola XSS |
| `Secure` | `COOKIE_SECURE` (oggi `false`) | acceso sopra HTTP il browser smette di mandarlo e il login sparisce senza un messaggio d'errore. Va acceso **insieme** al TLS |
| `SameSite` | `Lax` | e' anche il motivo per cui si puo' disattivare CSRF |
| `path` | `/` | |
| durata | `JWT_TTL_DAYS`, 7 giorni | |

Creazione e cancellazione passano dalla stessa classe: un `path` o un `sameSite`
diverso fra chi scrive il cookie e chi lo cancella lascia nel browser un cookie che
nessuno riesce piu' a togliere.

## `JwtService`

- **Nessun default per il segreto.** Se `JWT_SECRET` manca o e' piu' corto di 32
  caratteri, l'applicazione non parte: un backend che accetta token falsificabili e'
  peggio di uno spento, perche' sembra funzionare.
- `issue(userId, sessionId)` → token di sessione, con `sub` e `sid`.
- `fingerprint(token)` → l'impronta salvata in `sessions.token_hash`: nel database
  non finisce il token in chiaro.
- `issuePurposeToken` / `parsePurposeToken` → token **monouso e tipizzati**, con uno
  scopo dichiarato e una durata propria (verifica email, conferma cambio email). Un
  token emesso per uno scopo non vale per un altro.

## Le rotte — `AuthController`

| Metodo | Percorso | Note |
|---|---|---|
| POST | `/auth/register` | crea l'utente, manda l'email di verifica. Non fa login |
| POST | `/auth/login` | risponde `{ user }` e imposta il cookie |
| POST | `/auth/logout` | cancella la riga in `sessions` **e** manda un cookie svuotato e gia' scaduto |
| POST | `/auth/forgot-password` | risposta **sempre uguale**, esista o no l'indirizzo |
| POST | `/auth/reset-password` | token dall'email + password nuova |
| GET | `/auth/me` | l'utente della sessione corrente |

`/auth/me` rilegge l'utente dal database invece di restituire quello che ha in mano
il filtro: cosi' una modifica al profilo si vede subito.

**`forgot-password` risponde sempre lo stesso messaggio** — "se l'indirizzo e'
registrato, riceverai un'email". Distinguere i due casi regalerebbe a chiunque un
modo di scoprire chi e' cliente del negozio.

## Limite sui tentativi di accesso

`LoginRateLimiterService`: **5 tentativi falliti in 15 minuti**, chiave = email, con
una pulizia periodica delle voci vecchie. Un accesso riuscito azzera il conteggio.

`AuthService.login` confronta la password contro un **hash fittizio** quando
l'utente non esiste, invece di rispondere subito: senza, il tempo di risposta
direbbe da solo se un indirizzo e' registrato.

Due limiti noti, entrambi da superare (vedi
[11-what-is-missing.md](./11-what-is-missing.md)):

- il conteggio e' **in memoria**: si azzera a ogni riavvio e non regge piu' di
  un'istanza del backend;
- la chiave e' **solo l'email**: mille email diverse dallo stesso IP non vengono
  fermate. E `POST /auth/login` e' l'**unica** rotta protetta.

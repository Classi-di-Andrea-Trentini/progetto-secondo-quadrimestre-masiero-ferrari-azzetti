# Frontend — i componenti condivisi

`e-commerce/src/app/components/`. Sette, tutti standalone.

| Cartella | Selettore | Cosa fa |
|---|---|---|
| `nav-bar/` | `app-nav-bar` | barra in alto |
| `cart/` | `app-cart` | pannello laterale del carrello |
| `footer/` | `app-footer` | pie' di pagina |
| `breadcrumb/` | `app-breadcrumb` | navigazione gerarchica |
| `product-image/` | `app-product-image` | immagine prodotto con segnaposto |
| `skeleton/` | `app-skeleton` | scheletro di caricamento |
| `toast/` | `app-toast` | notifiche temporanee |

`NavBar`, `Cart`, `Toast` e `Footer` vivono in `app.html`, cioe' sono sempre a
schermo. Gli altri li usano le pagine.

## NavBar

Si ritira scorrendo verso il basso e ricompare scorrendo verso l'alto (soglia di 8
pixel, per non tremare). **Non si ritira mentre il menu mobile e' aperto**: prima
bastava scorrere di un dito col menu aperto e la barra spariva portandosi via il
menu.

Mostra il badge del carrello (`cart.itemCount()`), le iniziali dell'utente
collegato, e il link al pannello se il ruolo e' `admin`.

**Non ha una casella di ricerca.** Il catalogo sa filtrare per `?q=`, ma da
nessuna parte dell'interfaccia si puo' scrivere una parola da cercare: e' una delle
voci di [11-what-is-missing.md](./11-what-is-missing.md).

## Cart

Pannello laterale con le righe, le quantita' modificabili e il subtotale. Legge il
segnale `ready` di `CartService`: finche' e' falso mostra lo scheletro, perche' il
carrello di chi e' collegato arriva dal server **dopo** il primo render, e mostrare
"carrello vuoto" in quell'istante e' una bugia.

## Footer

Link alle cinque pagine legali e il link **"Gestisci cookie"**, che chiama
`CookieConsentService.reopen()` e rimette a schermo l'informativa disegnata da
`App`. Senza, la lettura dell'informativa sarebbe definitiva e non ci sarebbe modo
di tornarci.

## ProductImage

Copre i tre casi in cui il catalogo mostrerebbe un riquadro rotto: URL assente, URL
vuoto, URL non raggiungibile (404, host sparito). In tutti e tre disegna un
segnaposto invece di lasciare l'icona di immagine rotta del browser.

Riempie il contenitore, quindi va usato dentro il box che ne definisce proporzioni e
dimensioni (`.card-image`, `.thumb`, `aspect-[3/4]`…). `OnPush`, perche' un'immagine
non cambia da sola.

Prima catalogo, scheda e wishlist mostravano un `<img>` con `src` vuoto e nessun
`onerror`.

## Breadcrumb, Skeleton, Toast

- **Breadcrumb** — riceve una lista di `BreadcrumbItem` e disegna il percorso.
- **Skeleton** — il rettangolo grigio animato, usato mentre si aspettano i dati.
- **Toast** — legge il segnale `toasts` di `ToastService` e mostra i messaggi in
  coda, con scomparsa automatica.

## `search-bar`, rimosso

C'era un componente `SearchBar` completo e funzionante, che navigava a
`/products?q=…`. **Nessuna pagina lo importava**, nemmeno la barra in alto: era
codice morto che faceva credere, leggendo l'elenco dei componenti, che la ricerca
esistesse. E' stato rimosso; la funzione resta da fare, montando una casella nella
`NavBar`.

Insieme e' sparita la cartella `src/app/interfaces/`: sedici file, dieci dei quali
vuoti, e **nessuno importato da nessuna parte**. I tipi vivono accanto al servizio
che li usa.

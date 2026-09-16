# Backend — catalogo

File: `services/ProductService`, `services/PricingService`,
`controllers/ProductsController`, `dtos/ProductDtos`.

## Le rotte

| Metodo | Percorso | Pubblico | Cosa fa |
|---|---|---|---|
| GET | `/products` | si' | lista con filtri, ordinamento, paginazione |
| GET | `/products/filters` | si' | i valori possibili dei filtri |
| GET | `/products/by-ids?ids=…` | si' | prodotti per id, per i "visti di recente" |
| GET | `/products/{slug}` | si' | scheda prodotto + correlati |

`/products/filters` deve stare **prima** di `/products/{slug}` per leggibilita', ma
non e' l'ordine a salvarlo: Spring preferisce comunque il percorso letterale alla
variabile. Finche' quell'endpoint non esisteva, `/products/filters` finiva su
`bySlug("filters")` e la barra dei filtri restava vuota per un 404.

## Filtri — `ProductService.specification`

Costruiti con le `Specification` di JPA, tutti opzionali e combinabili. Due
condizioni sono sempre presenti: `is_active = true` e `deleted_at IS NULL`.

| Parametro | Effetto |
|---|---|
| `categoryId` | uguaglianza sulla categoria |
| `brand` | uguaglianza |
| `minPrice` / `maxPrice` | confronto su `base_price` |
| `colors` | `IN` su `product_variants.color_hex`, con join |
| `sizes` | `IN` su `product_variants.size`, con join |
| `search` | vedi sotto |
| `sortBy` | `price_asc`, `price_desc`, `popular` (`sold_count`), `rating` (`avg_rating`); il default e' `newest` (`created_at` discendente) |
| `page`, `limit` | `limit` ha un tetto a **100**: senza, `?limit=100000` e' un modo gratuito per mettere in ginocchio il database |

Il join sulle varianti duplica il prodotto una volta per variante che combacia:
serve `query.distinct(true)`, altrimenti la stessa maglietta compare tre volte.

### La ricerca

Attiva da **due caratteri** in su. Il termine viene spezzato in parole e **ogni
parola deve comparire da qualche parte**: "t-shirt nera" trova la maglietta nera,
non tutte le t-shirt piu' tutto cio' che e' nero.

Per ogni parola si cerca in: nome, marca, descrizione breve, descrizione, nome
della categoria, e nel **nome ripulito** da tutto cio' che non e' lettera o cifra
via `regexp_replace` — a catalogo c'e' "T-Shirt" e la gente scrive "tshirt".

> Il backend sa cercare, ma **nel frontend non c'e' nessuna casella di ricerca**:
> la pagina `/products` legge il parametro `q` dall'URL e nient'altro lo scrive.
> Vedi [11-what-is-missing.md](./11-what-is-missing.md).

## Prezzi — `PricingService`

`PricingService.of(variant)` restituisce un record `Price(original, unit,
discountLabel)`: il prezzo pieno, quello effettivamente applicato dopo eventuali
sconti, e l'etichetta da mostrare. Il prezzo di partenza e' `price_override` della
variante se c'e', altrimenti `base_price` del prodotto.

**E' l'unico punto che calcola un prezzo.** Il checkout lo richiama invece di
fidarsi dei numeri mandati dal client: quello che arriva dal browser e' una
richiesta, non un prezzo.

## Risposta

`GET /products` restituisce `{ data, meta }`, con `meta = { total, page, limit,
totalPages }`. Ogni elemento e' un `ProductDtos.ProductView` con categoria,
immagini, varianti e sconti gia' dentro — la conversione avviene nel servizio, in
transazione, perche' con `open-in-view=false` le associazioni lazy non si possono
toccare piu' tardi.

`GET /products/{slug}` aggiunge i **correlati**: stessa categoria, i piu' venduti
per primi, escluso il prodotto stesso.

`GET /products/by-ids` accetta una lista separata da virgole e **ignora in silenzio
gli id malformati**: la lista arriva dal `localStorage` del browser, e un id storto
e' roba vecchia o modificata a mano, non un motivo per rispondere 400.

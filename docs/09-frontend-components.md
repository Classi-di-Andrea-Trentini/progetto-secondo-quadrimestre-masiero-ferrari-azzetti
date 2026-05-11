# Frontend — Shared Components

Components in `e-commerce/src/app/components/` are reusable pieces rendered by the main app shell or embedded in pages.

---

## NavBar — components/nav-bar/

The top navigation bar. Rendered in `app.component.html` (or equivalent root template) so it appears on every page.

### Scroll behaviour

The navbar auto-hides when scrolling down and reappears when scrolling up. The logic lives in a `@HostListener('window:scroll')` method that tracks `lastScrollY` and compares it to the current scroll position. A `THRESHOLD` of 8 pixels filters out small wobbles so the bar does not flicker when the page is almost still.

Two private signals drive the CSS:
- `isHidden` — set to true when scrolling down.
- `isScrolled` — set to true once any scrolling has happened, adds a shadow.

`navClasses` is a computed signal that returns the Tailwind/CSS class object for the nav element.

### Auth integration

Injects `AuthService`. Reads `auth.currentUser()` to conditionally show the login/register links or the user avatar with initials.

`initials` — a computed signal that extracts the first letter of the first name and the first letter of the last name from `currentUser().fullName`. Used for the avatar circle when the user has no profile image.

### Cart badge

Injects `CartService`. Reads `cart.itemCount()` (when implemented) to show the count badge on the cart icon. Currently shows when `cart.isOpen` toggle is available.

### Dependencies

Uses `RouterLink` and `RouterLinkActive` for navigation links, `NgClass` for the scroll-based class binding.

---

## Cart — components/cart/

Il drawer carrello laterale. Si apre/chiude tramite `CartService.isOpen`.

Il template include:
- Overlay scuro con click-to-close
- Lista item renderizzata da `cart.items()` con immagine, nome variante, prezzo unitario
- Controlli quantità (+ / −) che chiamano `cart.updateQuantity()` e `cart.removeItem()`
- Subtotale da `cart.subtotal()`
- Pulsante "Vai al checkout" che naviga a `/checkout`
- Stato vuoto con link a `/products`

---

## SearchBar — components/search-bar/

Barra di ricerca che naviga a `/products?q=<query>`. Legge il parametro `q` dall'URL all'inizializzazione per pre-popolare il campo se l'utente è già nella pagina prodotti.

---

## Footer — components/footer/

Not explored in detail, but present in the components directory. Likely a static HTML footer with brand information, navigation links, and legal page links.

---

## How components are wired together

The root application template (rendered by `AppComponent`) includes `<app-nav-bar>` and `<app-cart>` alongside the `<router-outlet>`. This means these components are always mounted and their services are initialised before any page component renders.

Because `CartService` and `AuthService` are provided in root, the same instance is shared between `NavBar`, `Cart`, and any page component that needs them. A page calling `auth.updateProfile()` immediately reflects in the navbar's user display without any additional event handling.

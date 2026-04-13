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

The sliding cart drawer. Currently a placeholder — renders a static empty state in the template.

The component only injects `CartService` and exposes it as `readonly cart`. The template reads from `cart.isOpen` to toggle the drawer visibility.

Full implementation would add:
- Item list rendered from `cart.items()`
- Quantity controls calling `cart.updateQuantity()` and `cart.removeItem()`
- Subtotal display using `cart.subtotal()`
- Close button calling `cart.close()`
- A backdrop element that calls `cart.close()` on click

---

## SearchBar — components/search-bar/

Currently an empty component. Placeholder for a future search overlay or inline search input.

---

## Footer — components/footer/

Not explored in detail, but present in the components directory. Likely a static HTML footer with brand information, navigation links, and legal page links.

---

## How components are wired together

The root application template (rendered by `AppComponent`) includes `<app-nav-bar>` and `<app-cart>` alongside the `<router-outlet>`. This means these components are always mounted and their services are initialised before any page component renders.

Because `CartService` and `AuthService` are provided in root, the same instance is shared between `NavBar`, `Cart`, and any page component that needs them. A page calling `auth.updateProfile()` immediately reflects in the navbar's user display without any additional event handling.

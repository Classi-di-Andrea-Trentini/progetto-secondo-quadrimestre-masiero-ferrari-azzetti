# What Is Missing or Incomplete

This page tracks parts of the project that have been designed, partially built, or stubbed out but are not yet functional.

---

## Frontend — Cart

`CartService` is currently a placeholder. It only holds a boolean `isOpen` signal with open/close/toggle methods. There is no item list, no localStorage persistence, no item count, and no subtotal.

What needs to be implemented:
- `CartItem` interface (`productId`, `variantId`, `name`, `slug`, `image`, `price`, `color`, `colorHex`, `size`, `quantity`)
- `_items` signal with localStorage load on construction (browser-only)
- `effect()` to persist changes back to localStorage
- `addItem()` — merges if the same variant already exists, otherwise appends
- `removeItem()`, `updateQuantity()`, `clear()`
- `itemCount` and `subtotal` computed signals
- localStorage key: `common_era_cart`

`CartComponent` (`components/cart/cart.html`) is also a placeholder. It renders an Italian static string. The full drawer UI, item list, and quantity controls need to be written.

The navbar badge (`cart.itemCount() > 0`) is wired up in the template but `itemCount` does not exist on the current service.

User feedback already collected: the cart should not open the sidebar automatically when an item is added — only the count badge should update. The total price in the footer should use a normal font weight.

---

## Frontend — Checkout page

There is no checkout page in `app.routes.ts`. The `POST /checkout` endpoint on the backend is complete. A checkout page would need:
- Cart summary display
- Address selection (calls `GET /addresses`)
- Shipping method selection
- Promo code input (calls `POST /promo-codes/validate`)
- Order confirmation call to `POST /checkout`

---

## Frontend — Order history page

The `/me` page has an "orders" tab but it renders a placeholder. The `GET /orders` and `GET /orders/:id` endpoints are ready.

---

## Frontend — Returns page

No return request flow exists in the frontend. The `POST /returns` endpoint is ready.

---

## Frontend — Reviews

No review form or review listing is implemented in the product detail page. The `GET /reviews/product/:productId` and `POST /reviews` endpoints are ready.

---

## Frontend — Addresses management

No address form in the `/me` page settings tab. The full addresses CRUD API is ready.

---

## Frontend — Admin pages

Five admin page components exist (`admin-dashboard`, `admin-orders`, `admin-products`, `admin-promo`, `admin-users`) but none of them are wired into the route table in `app.routes.ts`. They appear to be empty placeholders.

There is no admin guard either — a route restriction checking `auth.isAdmin()` would need to be created and applied to all `/admin/*` routes.

---

## Backend — Password reset flow

The `password_resets` table exists in the schema but there is no `forgot-password` endpoint or flow. A user who forgets their password can only be helped by a direct database update.

---

## Backend — Gift cards

The `gift_cards` and `gift_card_transactions` tables exist in the schema. The checkout service has fields for `giftCardId` and `giftCardAmount` in the Order model but the checkout DTO does not accept a gift card code and the balance deduction logic is not implemented.

---

## Backend — Newsletter module

`NewsletterModule` is imported in `AppModule`. A `newsletter.service.ts` and `newsletter.controller.ts` exist. The exact endpoints and their state is not detailed in this document but the module is present.

---

## Infrastructure — Reverse proxy

The `docker-compose.yml` has commented notes about adding an Nginx container as a reverse proxy in front of the frontend and backend, with SSL termination. This is not implemented. Frontend and backend are currently accessed directly on ports 4200 and 3000.

---

## SearchBar component

`components/search-bar/` is an empty placeholder component with no logic or template content.

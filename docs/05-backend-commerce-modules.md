# Backend — Commerce Modules

These are the modules that handle the transactional and post-purchase parts of the site. All routes require authentication.

---

## Wishlist module

Path: `server/src/wishlist/`

**getWishlist(userId)** — returns the full list of saved items with the product data embedded. Each item includes the product's first two images (cover first) and the active discount. Used on the `/me` page to render the saved items list.

**getWishlistProductIds(userId)** — returns only the array of product IDs in the wishlist. Used when loading a product listing page to know which heart icons to render as filled without fetching full product data.

**toggle(userId, productId)** — checks if a wishlist row already exists for this user and product (with `variantId = null`). If it does, deletes it. If not, creates it. Returns `{ saved: true/false }`. The unique constraint on `(userId, productId, variantId)` in the schema prevents duplicates at the database level as well.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /wishlist | Full wishlist with product data |
| GET | /wishlist/ids | Array of saved product IDs only |
| POST | /wishlist/:productId/toggle | Toggle saved/unsaved |

---

## Addresses module

Path: `server/src/addresses/`

Standard CRUD for the user's delivery addresses. The ownership check is extracted into a private `assertOwner(userId, id)` method used by update, delete, and set-default.

**create** — if `isDefault: true` is set, first sets all other addresses for this user to `isDefault: false`, then creates the new one. Country defaults to `'IT'` if not provided.

**update** — same isDefault management: if the update sets `isDefault: true`, all sibling addresses are set to false first.

**setDefault** — a dedicated endpoint for setting an address as default without changing any other field. Sets all to false, then sets the target to true.

**remove** — ownership check, then hard delete.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /addresses | List user addresses |
| POST | /addresses | Create address |
| PUT | /addresses/:id | Replace address |
| DELETE | /addresses/:id | Delete address |
| PATCH | /addresses/:id/set-default | Set as default |

---

## Orders module

Path: `server/src/orders/`

Read-only. Orders are created exclusively by the checkout service. This module only exposes listing and detail endpoints.

**findAll(userId, page, limit)** — paginated order list ordered newest first. The list view includes only a minimal set of item data (productName, quantity, lineTotal) and the latest payment status. No nested variants or images.

**findOne(userId, id)** — full order detail. Uses the `ORDER_INCLUDE` constant which pulls in the delivery address, all order items with their variants and the product's cover image, the latest payment, the full status history, and the promo code used (code string only). Checks ownership with a 403 if the order belongs to a different user.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /orders | Paginated order list (query: page, limit) |
| GET | /orders/:id | Full order detail |

---

## Checkout module

Path: `server/src/checkout/`

The single most complex service in the backend. `placeOrder` runs an 8-step process:

1. Verify the address exists and belongs to the authenticated user.
2. Load all variant rows from the database, including the product and its active discount. Throws 400 if any variant is inactive or missing.
3. Check stock for each item. Throws 400 with the product name if stock is insufficient.
4. Calculate all prices from the database — the client's price values are never used. Price is `priceOverride ?? product.basePrice`, then the discount is applied if one exists.
5. Apply the promo code if provided, by calling `PromoCodesService.validate()`. This checks all promo constraints and returns the final discount value.
6. Calculate shipping: standard 4.90, express 9.90, free when the post-promo subtotal exceeds €100.
7. Run a `$transaction` that: creates the order with all items, creates the initial `pending` status history entry, creates a mock payment record (status: `succeeded`), moves the order to `paid` and logs that in status history, decrements `stockQty` on each variant, increments `soldCount` on each product, records the promo code use and increments `currentUses`.
8. Returns `{ orderId, total, status: 'paid' }`.

The payment is mocked as immediately succeeded. In a real integration, the order would be created with status `pending` and the payment would be confirmed asynchronously via a webhook from Stripe.

### DTOs

`CheckoutItemDto` — `variantId` (UUID), `quantity` (integer ≥ 1).

`CheckoutDto` — `items` (array of CheckoutItemDto), `addressId` (UUID), `shippingMethod` (enum: `standard` | `express`, optional, defaults to `standard`), `promoCode` (optional string), `notes` (optional string).

### Endpoint

| Method | Path | Description |
|--------|------|-------------|
| POST | /checkout | Place an order |

---

## Promo codes module

Path: `server/src/promo-codes/`

**validate(code, orderAmount, userId)** — validates a promo code and returns the discount value. This method is called by the checkout service, not just exposed as an endpoint. The validation chain:

- Code must exist and be `isActive: true`
- `startsAt` must be in the past (or null)
- `expiresAt` must be in the future (or null)
- `currentUses` must be less than `maxUses` (or `maxUses` is null)
- Order amount must be at or above `minOrderAmount` (or it is null)
- Per-user limit: counts `PromoCodeUse` rows for this user, must be below `maxUsesPerUser` (or null)

After all checks pass, the discount is calculated. For percentage codes, `orderAmount * (value / 100)`. For fixed amount, just `value`. Then capped by `maxDiscountCap` if set. Then capped again by `orderAmount` so the discount can never exceed the order total.

The `PromoValidationResult` interface is exported so the checkout service can type the return value.

### Endpoint

| Method | Path | Description |
|--------|------|-------------|
| POST | /promo-codes/validate | Validate a code and get the discount (query: promoCode, orderAmount) |

---

## Reviews module

Path: `server/src/reviews/`

**findByProduct(productId, page, limit)** — only returns `approved` reviews. Each review includes the user's name and avatar, and any admin replies ordered oldest first. Public endpoint, no auth required.

**create(userId, dto)** — creates a review after checking: the product exists, the user has not already reviewed this product (unique constraint on userId + productId). Automatically sets `isVerified: true` if the user has at least one delivered or completed order containing a variant of this product. Status is set to `approved` immediately (no moderation queue currently).

**voteHelpful / removeVote** — toggle helpful votes using a transaction that both records the vote and updates the `helpfulCount` denormalised counter on the review.

**remove(reviewId, userId)** — ownership check, then delete. Returns `{ productId }` so the controller can call `recalcProductRating`.

**recalcProductRating(productId)** — aggregates the average rating of all approved reviews for the product and writes it back to `product.avgRating`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /reviews/product/:productId | Paginated reviews for a product (public) |
| POST | /reviews | Create a review |
| DELETE | /reviews/:id | Delete your own review |
| POST | /reviews/:id/helpful | Mark review as helpful |
| DELETE | /reviews/:id/helpful | Remove helpful vote |

---

## Returns module

Path: `server/src/returns/`

**findAll(userId)** — all return requests for the user, most recent first. Includes the return items with the original order item snapshot, and the basic order info.

**findOne(userId, id)** — full return detail with ownership check.

**create(userId, dto)** — validates that: the order exists and belongs to the user, the order status is `delivered` or `completed` (can only return received orders), no active return already exists for this order (i.e. no return that is not in `rejected` status), each return item references an actual item on that order, and the requested return quantity does not exceed the ordered quantity.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /returns | All return requests |
| GET | /returns/:id | Single return detail |
| POST | /returns | Create return request |

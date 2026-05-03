# Frontend — Page Components

---

## Home — pages/home/home.ts

The homepage. Loads four featured products from the API on `ngOnInit`, guarded by `isPlatformBrowser` to avoid the SSR connection error. The featured products are fetched with `isFeatured: true, limit: 4`.

Other sections of the page are static data defined inline in the component class:

- `collectionHighlights` — an array of six editorial cards with Unsplash images, titles, and subtitles. Rendered as a grid.
- `promoShowcase` — an array of promotional sections.
- `activeSlide` — a signal tracking which slide is active in any carousel.

Helper methods:
- `getCoverImage(product)` — finds the image with `isCover: true`, falls back to the first image.
- `formatPrice(value)` — `parseFloat(String(value)).toFixed(2).replace('.', ',')` prefixed with `€ `.
- `hasDiscount(product)` — true if `discounts[0]` exists.

---

## Products — pages/products/products.ts

The main catalogue page. All filter state is kept as individual signals rather than one object, which makes it easy to bind individual inputs in the template.

### Filter state signals

`selectedCategory`, `selectedColors` (array), `selectedSizes` (array), `minPrice`, `maxPrice`, `sortBy`, `currentPage`, `searchQuery`.

### Computed signals

- `rootCategories` — top-level categories (parentId is null).
- `subCategories` — child categories of the currently selected category.
- `activeFiltersCount` — count of how many filter groups are active, used to show a badge on the filter button.

### Image display logic

`displayedImages(product)` — if a color is selected for a card, tries to find images linked to variants of that color. If variant-specific images exist, returns those. Otherwise returns generic product images (variantId is null). This allows color swatching on the card to show different images per color if the seed data links images to variants.

`coverImage(product)` and `hoverImage(product)` delegate to `displayedImages`.

### Price helpers

`discountedPrice(product)` — returns the final price after discount, or null. Calls `parseFloat(String(...))` on both `basePrice` and the discount value before arithmetic.

`discountLabel(product)` — returns the discount label string, or generates one (e.g. `-15%`) if the label field is null.

### Query param reading

`ngOnInit` subscribes to `ActivatedRoute.queryParams` to pick up a `?category=` param. This lets the navbar link to `/products?category=<id>` and have the filter pre-applied.

### Wishlist integration

`toggleWishlist(event, productId)` — calls `WishlistService.toggle()` if authenticated, otherwise redirects to `/login`. Stops event propagation so the click does not also navigate to the product detail page.

---

## ProductDetail — pages/product-detail/product-detail.ts

The individual product page.

### State signals

- `product` — the loaded `ProductFull` or null.
- `related` — array of related `ProductListItem`.
- `activeImageIndex` — which image is currently shown in the gallery.
- `selectedColor` — the currently selected colorHex string.
- `selectedSize` — the currently selected size string.
- `openAccordion` — which accordion section is expanded (details/sizeguide/fabric/washing/shipping).
- `addedToCart` — boolean feedback signal after adding to cart.

### Loading

`ngOnInit` subscribes to `ActivatedRoute.paramMap` to get the slug. On load, the first unique color is pre-selected via `uniqueColors()[0]`. The route subscription handles the case where the user navigates from one product detail page to another — the slug changes but the component is reused.

### Computed signals and helpers

- `uniqueColors()` — deduplicates variants by colorHex.
- `availableSizes()` — sizes available for the selected color.
- `currentVariant()` — the variant matching the selected color and size, used to check stock.
- `activeImage()` — the image at `activeImageIndex`, falling back to index 0 if out of range.
- `filteredImages()` — images linked to variants of the selected color, or all images if no color-specific ones exist.
- `displayPrice()` — applies the discount to `basePrice` and returns a formatted string.
- `originalPrice()` — formatted `basePrice`, shown as strikethrough when there is a discount.

### Accordion

`accordionContent` is a static record mapping section IDs to text strings. The details section uses `product.description` from the API.

---

## MeComponent — pages/me/me.ts

The authenticated account page. Split into four tabs: profile, orders, favorites, settings.

### Tab navigation

`activeTab` is a `WritableSignal<TabSection>`. The template shows different content based on its value.

### Profile tab

`profileForm` is a non-nullable reactive form with fields for fullName, phone, birthDate, gender. An `effect()` in the constructor watches the `auth.currentUser` signal and patches the form whenever the user object changes — this handles the initial load and any updates.

`saveProfile()` — calls `auth.updateProfile()` with the form values, sets `saveSuccess` for a brief visual confirmation.

### Settings tab

**Password change** — `passwordForm` has `currentPassword`, `newPassword`, `confirmPassword`. A group-level validator (`{ validators: ... }`) checks that the two password fields match.

**Email change** — `emailForm` has `newEmail` and `currentPassword`. Submit calls `auth.requestEmailChange()`.

**Email verification** — `sendVerification()` calls `auth.sendVerificationEmail()`.

### Favorites tab

Calls `wishlist.loadItems()` on tab switch. Renders the full wishlist item list.

`wishlistPrice(item)` — calculates the displayed price for a wishlist item, applying the discount if present. Carefully uses `parseFloat(String(v))` on all Decimal values.

---

## Login — pages/login/login.ts

A simple reactive form component. `FormBuilder.nonNullable.group` creates the form so the values are always strings, never null. On submit calls `auth.login()`, navigates to `/me` on success, shows the error message on failure via `auth.extractErrorMessage()`.

Two getters (`get email()`, `get password()`) provide shorthand access to form controls for template binding.

---

## Register — pages/register/register.ts

Similar to Login but with additional validation. Defines two standalone validator functions:

`passwordComplexity` — requires at least one uppercase letter, one lowercase letter, and one digit.

`passwordMatch` — a group-level validator that compares the `password` and `confirmPassword` fields.

On success navigates to `/login`.

---

## VerifyEmail — pages/verify-email/verify-email.ts

Reads the `:token` param, calls `auth.confirmVerification(token)`, displays the success or error message. No form — purely informational.

---

## Legal — pages/legal/legal.ts

Reads the `:pagina` param and uses it to select which legal text to display (privacy policy, terms of service, cookie policy). Content is likely static text in the template.

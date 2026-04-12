# Backend — Products Module

Path: `server/src/products/`

All routes are public. No authentication is required to browse products.

## Data model overview

A `Product` belongs to one `Category`. It has many `ProductVariant` rows, where each variant represents a specific combination of size and color. It has many `ProductImage` rows, which can be linked to a specific variant or to the product as a whole. It can have an active `Discount`. Variants carry their own `stockQty` and an optional `priceOverride`.

The key fields on `Product` used for filtering and display are:
- `basePrice` — Prisma Decimal, serialized as a string in JSON
- `isActive` — soft delete flag, false items are never shown publicly
- `isFeatured` / `isNewArrival` — used to power homepage sections
- `soldCount` — incremented atomically by the checkout service on each order
- `avgRating` — recomputed by the reviews service when a review is added or removed

## products.service.ts

**findAll(dto)** — paginated product listing with filtering and sorting. The `where` clause is built dynamically:

- `search` performs a case-insensitive `contains` match on the product name.
- `categoryId` filters by exact category UUID.
- `minPrice` / `maxPrice` use Prisma's `gte` / `lte` operators on `basePrice`.
- `isFeatured` and `isNewArrival` are passed directly as booleans after the DTO transform.
- `colors` and `sizes` use a `variants.some` subquery — a product matches if at least one of its active variants has a colorHex in the provided list and a size in the provided list.

Sorting options: `newest` (default, `createdAt desc`), `price_asc`, `price_desc`, `popular` (`soldCount desc`), `rating` (`avgRating desc`).

The query uses `Promise.all` to run the data query and `count` query in parallel, which is the standard pagination pattern with Prisma.

Each returned product includes: its category (id, name, slug), all images ordered cover-first, all active variants with only the fields needed for the listing (no material, no barcode), and at most one active discount.

**findBySlug(slug)** — loads a single product by slug. Throws a 404 if not found. Also loads up to 4 related products from the same category ordered by popularity. The related products include only the cover image and the first discount.

**getFilters()** — returns the data needed to populate the filter sidebar. Uses `Promise.all` to run four queries in parallel:
- All active categories (for the category filter)
- Distinct non-null `color` + `colorHex` combinations from active variants (for the color swatches)
- Distinct non-null `size` values from active variants (for the size filter)
- `aggregate` min and max on `basePrice` across all active products (for the price range slider)

## products.controller.ts

Three endpoints:

`GET /products/filters` — must be declared before `GET /products/:slug` in the file, otherwise NestJS would try to match the string `"filters"` as a slug parameter.

`GET /products` — accepts query parameters matching `GetProductsDto`. Returns the paginated response.

`GET /products/:slug` — returns the full product object and the related array.

## dto/get-products.dto.ts

Uses `class-transformer` decorators to coerce incoming query string values. `@Type(() => Number)` on `minPrice`, `maxPrice`, `page`, `limit` converts the string `"24"` to the number `24`. `@Transform` on `isFeatured` and `isNewArrival` converts the string `"true"` to boolean `true`. `colors` and `sizes` can be sent as `colors[]=...&colors[]=...` and come in as arrays.

## Image conventions

`is_cover = true` — the primary image shown on listing cards and as the first image in the gallery.

`sort_order = 1` — conventionally the hover image (shown on mouseover on product cards).

Images can optionally be linked to a specific variant via `variantId`. The frontend can use this to swap images when the user selects a color.

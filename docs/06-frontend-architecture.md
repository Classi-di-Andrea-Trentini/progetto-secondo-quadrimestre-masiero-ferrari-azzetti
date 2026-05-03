# Frontend Architecture

## Technology choices

Angular 21 with SSR enabled. All components are standalone — there are no `NgModule` classes in the application code. The app uses the new Angular control flow syntax (`@if`, `@for`, `@switch`) instead of the older structural directives. State management is done with Angular signals.

## SSR and the browser check pattern

The application runs on the server during SSR to generate the initial HTML. This creates a problem: any code that touches browser-only APIs (`localStorage`, `document`, `window`, cookie access) will throw on the server and crash the render.

The pattern used throughout the codebase is:

```typescript
private readonly platformId = inject(PLATFORM_ID);

ngOnInit() {
  if (!isPlatformBrowser(this.platformId)) return;
  // browser-only code here
}
```

The auth guard also handles this: on the server it returns `of(true)` immediately and lets the page render, because the user's auth state cannot be known without cookies. The real check happens on the client after hydration.

`isPlatformBrowser` is imported from `@angular/common`. `PLATFORM_ID` is injected via `inject()` in the constructor or field initialiser.

## How services talk to the backend

Every Angular service uses `HttpClient` to call the backend at `http://localhost:3000`. The base URL is hardcoded as a module-level constant in each service file. There is no environment file or injection token wrapping this.

All requests that need authentication send `{ withCredentials: true }` so the browser includes the `access_token` cookie. The cookie is HttpOnly so it is never directly accessible to JavaScript.

Almost all service methods are `async` and use `firstValueFrom(this.http.get/post/patch...)` to convert the Observable to a Promise. This allows calling them with `await` and handling errors with `try/catch`.

## Signals and state

The global auth state lives in `AuthService` as a private `WritableSignal<AuthUser | null>` exposed as a readonly signal. Components that need the user just inject `AuthService` and read `auth.currentUser()`.

`computed()` signals derive values from other signals and update automatically. Example: `isAuthenticated = computed(() => this._currentUser() !== null)`.

`effect()` is used in one component (`MeComponent`) to sync a form's values when the user signal changes, because the form needs to be pre-filled with the current user's data on mount.

## app.routes.ts

The route table is flat with no lazy loading. All page components are imported at the top of the file and referenced directly.

```
/           → redirects to /home
/home       → Home
/login      → Login
/register   → Register
/products   → Products
/product/:slug  → ProductDetail
/me         → MeComponent  (guarded by authGuardGuard)
/verify-email/:token → VerifyEmail
/legal/:pagina → Legal
/**         → redirects to /home
```

## authGuardGuard

The guard is a `CanActivateFn`. It handles SSR by returning `of(true)` immediately when not in a browser. In the browser, it waits for `AuthService.isLoading` to become false by converting the signal to an Observable with `toObservable()`, filtering out the loading state with `filter(loading => !loading)`, taking the first emission, and then returning either `true` or a redirect to `/login`.

This is necessary because `AuthService` checks the current session with `GET /auth/me` asynchronously in its constructor. If the guard checked `isAuthenticated()` synchronously, it would always find false during the first render before the HTTP call completes.

## Component structure

Components are in two groups:

**pages/** — full-page route components. Each has a `.ts`, `.html`, and `.css` file.

**components/** — reusable pieces rendered within pages. Currently: `nav-bar`, `footer`, `search-bar`, `cart`.

Every component declares `standalone: true` in its decorator and lists its own imports. The pattern is to import only what the component actually uses: `CommonModule` if `NgClass`/`DatePipe` are needed, `RouterModule` for `routerLink`, `ReactiveFormsModule` for forms.

## Decimal fields from Prisma

`Product.basePrice` and all other `Decimal` fields in the schema come through the API as strings. Angular templates and service methods must call `parseFloat(String(value))` before any arithmetic. Calling `.toFixed()` directly on the raw value throws a TypeError and crashes the `@for` loop rendering the list.

import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Home } from './pages/home/home';
import { About } from './pages/about/about';
import { Products } from './pages/products/products';
import { ProductDetail } from './pages/product-detail/product-detail';
import { MeComponent } from './pages/me/me';
import { Legal } from './pages/legal/legal';
import { VerifyEmail } from './pages/verify-email/verify-email';
import { Admin } from './pages/admin/admin';
import { AdminDashboard } from './pages/admin/admin-dashboard/admin-dashboard';
import { AdminProducts } from './pages/admin/admin-products/admin-products';
import { AdminOrders } from './pages/admin/admin-orders/admin-orders';
import { AdminUsers } from './pages/admin/admin-users/admin-users';
import { AdminPromo } from './pages/admin/admin-promo/admin-promo';
import { AdminReviews } from './pages/admin/admin-reviews/admin-reviews';
import { AdminReturns } from './pages/admin/admin-returns/admin-returns';
import { Checkout } from './pages/checkout/checkout';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { ResetPassword } from './pages/reset-password/reset-password';
import { NotFound } from './pages/not-found/not-found';
import { authGuardGuard } from './guards/auth-guard-guard';
import { adminGuardGuard } from './guards/admin-guard-guard';

// `title` su ogni rotta e' cio' che aggiorna `document.title` a ogni
// navigazione lato client: senza, il `Title` di Angular non lo tocca mai da
// solo, e la scheda resta bloccata sul titolo dell'ultima pagina che lo
// impostava esplicitamente (solo product-detail e la 404 lo fanno). La
// pagina prodotto sovrascrive comunque questo valore in `ngOnInit` una volta
// caricati i dati (nome vero del prodotto), quindi qui basta un fallback.
export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home, title: 'CommonEra' },
  // `About` era importato ma la rotta non era mai stata registrata: il link "About us"
  // nella barra in alto cadeva nel jolly e riportava alla home.
  { path: 'about', component: About, title: 'About Us — CommonEra' },
  { path: 'login', component: Login, title: 'Sign In — CommonEra' },
  { path: 'register', component: Register, title: 'Create Account — CommonEra' },
  { path: 'products', component: Products, title: 'Shop — CommonEra' },
  { path: 'product/:slug', component: ProductDetail, title: 'Product — CommonEra' },
  {
    path: 'me',
    component: MeComponent,
    canActivate: [authGuardGuard],
    title: 'My Account — CommonEra',
  },
  {
    path: 'checkout',
    component: Checkout,
    canActivate: [authGuardGuard],
    title: 'Checkout — CommonEra',
  },
  { path: 'forgot-password', component: ForgotPassword, title: 'Forgot Password — CommonEra' },
  { path: 'reset-password', component: ResetPassword, title: 'Reset Password — CommonEra' },
  { path: 'verify-email/:token', component: VerifyEmail, title: 'Verify Email — CommonEra' },
  { path: 'legal/:pagina', component: Legal, title: 'Legal — CommonEra' },
  {
    path: 'admin',
    component: Admin,
    canActivate: [adminGuardGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboard, title: 'Admin Dashboard — CommonEra' },
      { path: 'products', component: AdminProducts, title: 'Admin Products — CommonEra' },
      { path: 'orders', component: AdminOrders, title: 'Admin Orders — CommonEra' },
      { path: 'users', component: AdminUsers, title: 'Admin Users — CommonEra' },
      { path: 'promo', component: AdminPromo, title: 'Admin Promotions — CommonEra' },
      { path: 'reviews', component: AdminReviews, title: 'Admin Reviews — CommonEra' },
      { path: 'returns', component: AdminReturns, title: 'Admin Returns — CommonEra' },
    ],
  },
  // Il jolly rende una 404 vera e non reindirizza piu' in home: un indirizzo
  // sbagliato deve dirlo, non fingere che vada tutto bene. Lo stato HTTP 404 lo
  // mette `app.routes.server.ts`, che e' l'unico punto in cui si puo' scegliere.
  // Niente `title` qui: `NotFound` imposta il proprio nel costruttore (via
  // `SeoService`), che gira PRIMA che il router applichi il titolo statico di
  // rotta — un `title` qui lo sovrascriverebbe subito dopo, silenziosamente.
  { path: '**', component: NotFound },
];

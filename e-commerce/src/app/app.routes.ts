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
  { path: 'home', component: Home, title: 'Common Era' },
  // `About` era importato ma la rotta non era mai stata registrata: il link "About us"
  // nella barra in alto cadeva nel jolly e riportava alla home.
  { path: 'about', component: About, title: 'About Us — Common Era' },
  { path: 'login', component: Login, title: 'Sign In — Common Era' },
  { path: 'register', component: Register, title: 'Create Account — Common Era' },
  { path: 'products', component: Products, title: 'Shop — Common Era' },
  { path: 'product/:slug', component: ProductDetail, title: 'Product — Common Era' },
  {
    path: 'me',
    component: MeComponent,
    canActivate: [authGuardGuard],
    title: 'My Account — Common Era',
  },
  {
    path: 'checkout',
    component: Checkout,
    canActivate: [authGuardGuard],
    title: 'Checkout — Common Era',
  },
  { path: 'forgot-password', component: ForgotPassword, title: 'Forgot Password — Common Era' },
  { path: 'reset-password', component: ResetPassword, title: 'Reset Password — Common Era' },
  { path: 'verify-email/:token', component: VerifyEmail, title: 'Verify Email — Common Era' },
  { path: 'legal/:pagina', component: Legal, title: 'Legal — Common Era' },
  {
    path: 'admin',
    component: Admin,
    canActivate: [adminGuardGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboard, title: 'Admin Dashboard — Common Era' },
      { path: 'products', component: AdminProducts, title: 'Admin Products — Common Era' },
      { path: 'orders', component: AdminOrders, title: 'Admin Orders — Common Era' },
      { path: 'users', component: AdminUsers, title: 'Admin Users — Common Era' },
      { path: 'promo', component: AdminPromo, title: 'Admin Promotions — Common Era' },
      { path: 'reviews', component: AdminReviews, title: 'Admin Reviews — Common Era' },
      { path: 'returns', component: AdminReturns, title: 'Admin Returns — Common Era' },
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

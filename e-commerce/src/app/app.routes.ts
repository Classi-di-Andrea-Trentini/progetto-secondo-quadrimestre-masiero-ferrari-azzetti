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
import { authGuardGuard } from './guards/auth-guard-guard';
import { adminGuardGuard } from './guards/admin-guard-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'products', component: Products },
  { path: 'product/:slug', component: ProductDetail },
  { path: 'me', component: MeComponent, canActivate: [authGuardGuard] },
  { path: 'checkout', component: Checkout, canActivate: [authGuardGuard] },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: 'verify-email/:token', component: VerifyEmail },
  { path: 'legal/:pagina', component: Legal },
  {
    path: 'admin',
    component: Admin,
    canActivate: [adminGuardGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboard },
      { path: 'products', component: AdminProducts },
      { path: 'orders', component: AdminOrders },
      { path: 'users', component: AdminUsers },
      { path: 'promo', component: AdminPromo },
      { path: 'reviews', component: AdminReviews },
      { path: 'returns', component: AdminReturns },
    ],
  },
  { path: '**', redirectTo: 'home' },
];

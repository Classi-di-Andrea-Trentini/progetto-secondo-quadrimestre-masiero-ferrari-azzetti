import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Home } from './pages/home/home';
import { Products } from './pages/products/products';
import { MeComponent } from './pages/me/me';
import { Legal } from './pages/legal/legal';
import { VerifyEmail } from './pages/verify-email/verify-email';
import { AdminDashboard } from './pages/admin/admin-dashboard/admin-dashboard';
import { AdminUsers } from './pages/admin/admin-users/admin-users';
import { AdminOrders } from './pages/admin/admin-orders/admin-orders';
import { AdminProducts } from './pages/admin/admin-products/admin-products';
import { AdminPromo } from './pages/admin/admin-promo/admin-promo';
import { authGuardGuard } from './guards/auth-guard-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'products', component: Products },
  { path: 'me', component: MeComponent, canActivate: [authGuardGuard] },
  { path: 'admin', redirectTo: 'admin-dashboard', pathMatch: 'full' },
  { path: 'admin-dashboard', component: AdminDashboard },
  { path: 'admin-users', component: AdminUsers },
  { path: 'admin-orders', component: AdminOrders },
  { path: 'admin-products', component: AdminProducts },
  { path: 'admin-promo', component: AdminPromo },
  { path: 'verify-email/:token', component: VerifyEmail },
  { path: 'legal/:pagina', component: Legal },
  { path: '**', redirectTo: 'home' },
];

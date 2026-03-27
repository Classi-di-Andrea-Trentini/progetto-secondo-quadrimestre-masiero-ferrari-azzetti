import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Home } from './pages/home/home';
import { Products } from './pages/products/products';
import { ProductDetail } from './pages/product-detail/product-detail';
import { MeComponent } from './pages/me/me';
import { Legal } from './pages/legal/legal';
import { VerifyEmail } from './pages/verify-email/verify-email';
import { authGuardGuard } from './guards/auth-guard-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'products', component: Products },
  { path: 'product/:slug', component: ProductDetail },
  { path: 'me', component: MeComponent, canActivate: [authGuardGuard] },
  { path: 'verify-email/:token', component: VerifyEmail },
  { path: 'legal/:pagina', component: Legal },
  { path: '**', redirectTo: 'home' },
];

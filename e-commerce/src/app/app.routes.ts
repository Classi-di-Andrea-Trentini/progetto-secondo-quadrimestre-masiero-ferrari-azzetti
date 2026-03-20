import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Home } from './pages/home/home';
import { Products } from './pages/products/products';
import { MeComponent } from './pages/me/me';
import { Legal } from './pages/legal/legal';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'login', component: Login },
  { path: 'products', component: Products },
  { path: 'me', component: MeComponent },
  { path: 'legal/:pagina', component: Legal },
  { path: '**', redirectTo: 'home' }
];

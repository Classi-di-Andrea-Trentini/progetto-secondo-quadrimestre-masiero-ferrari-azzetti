import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Home } from './pages/home/home';
import { Products } from './pages/products/products';
import { Me } from './pages/me/me';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'login', component: Login },
  { path: 'products', component: Products },
  { path: 'me', component: Me },
  { path: '**', redirectTo: 'home' }
];

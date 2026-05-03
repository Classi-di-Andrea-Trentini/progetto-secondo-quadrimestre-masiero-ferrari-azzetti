import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-admin-dashboard',
  imports: [],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard {
  // faccio inject servizio auth
  private auth = inject(AuthService);
  // utente corrente
  private _currentUser = this.auth.currentUser;

  // signal che controlla se è admin
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');

  

}

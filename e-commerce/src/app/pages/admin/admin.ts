import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin',
  imports: [],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {
  // faccio inject servizio auth
  private auth = inject(AuthService);
  // utente corrente
  private _currentUser = this.auth.currentUser;

  // signal che controlla se è admin
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');
}

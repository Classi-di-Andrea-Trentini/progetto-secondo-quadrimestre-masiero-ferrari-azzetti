import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../services/auth';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin',
  imports: [RouterOutlet],
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


  // controllo che il suo ruolo sia user, cosi so che è loggato
  readonly isLoggedIn = computed(() => this._currentUser()?.role === 'user')


  logout(): void {  
    this.auth.logout()
  }
}

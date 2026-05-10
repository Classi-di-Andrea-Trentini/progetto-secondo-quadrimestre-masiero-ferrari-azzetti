import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule, SkeletonComponent],
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

  

  statusColor(s: string): string {
    return this.statusColors[s] ?? 'bg-gray-100 text-gray-700';
  }
}

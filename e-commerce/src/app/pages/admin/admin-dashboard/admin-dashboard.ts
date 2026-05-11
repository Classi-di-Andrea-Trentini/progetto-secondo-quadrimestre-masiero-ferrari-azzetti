import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  readonly statusColorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-blue-100 text-blue-700',
    processing: 'bg-indigo-100 text-indigo-700',
    shipped: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    completed: 'bg-green-200 text-green-800',
    cancelled: 'bg-red-100 text-red-700',
    refunded: 'bg-gray-100 text-gray-700',
  };

  statusColor(s: string): string {
    return this.statusColorMap[s] ?? 'bg-gray-100 text-gray-700';
  }
}

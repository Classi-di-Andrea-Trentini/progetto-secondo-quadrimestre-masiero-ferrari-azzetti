import { Component, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, Output, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NavBar {
  readonly auth = inject(AuthService);

  @Output() cartClick = new EventEmitter<void>();

  readonly initials = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return null;
    const parts = user.fullName.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const last = parts[1]?.[0] ?? '';
    return (first + last).toUpperCase() || first.toUpperCase();
  });

  onCartClick(): void {
    this.cartClick.emit();
  }
}

import { Component, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class NavBar {
  @Output() cartClick = new EventEmitter<void>();

  onCartClick(): void {
    this.cartClick.emit();
  }
}
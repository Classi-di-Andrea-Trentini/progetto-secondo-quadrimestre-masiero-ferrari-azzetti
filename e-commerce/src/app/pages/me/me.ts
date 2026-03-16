import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';

type TabSection = 'profile' | 'orders' | 'favorites' | 'settings';

@Component({
  selector: 'app-me',
  standalone: true,
  imports: [NgClass],
  templateUrl: './me.html',
  styleUrls: ['./me.css']
})
export class MeComponent {
  // Gestisce quale scheda è attiva. Parte da 'profile'
  activeTab = signal<TabSection>('profile');
}
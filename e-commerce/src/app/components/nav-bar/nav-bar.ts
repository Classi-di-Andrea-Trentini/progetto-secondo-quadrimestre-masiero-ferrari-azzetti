import { NgClass } from '@angular/common';
import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, HostListener, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, RouterLinkActive, NgClass],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // for allowing elements like el-disclosure
  // not recognized by angular (generating errors)
})
export class NavBar {
  private lastScrollY = 0;
  private readonly THRESHOLD = 8;

  private isHidden = signal(false);
  private isScrolled = signal(false);

  navClasses = computed(() => ({ // classe tailwind
    'fixed top-0 left-0 right-0 z-50 bg-white transition-transform duration-300': true,
    '-translate-y-full': this.isHidden(),
    'shadow-md': this.isScrolled(),
  }));

  // function to manage scroll up to then show the navbar
  @HostListener('window:scroll')
  onScroll(): void {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - this.lastScrollY;

    if (Math.abs(delta) < this.THRESHOLD) return;

    if (currentScrollY <= 0) {
      this.isHidden.set(false);
      this.isScrolled.set(false);
    } else if (delta > 0) {
      this.isHidden.set(true);
      this.isScrolled.set(true);
    } else {
      this.isHidden.set(false);
      this.isScrolled.set(true);
    }

    this.lastScrollY = currentScrollY;
  }
}

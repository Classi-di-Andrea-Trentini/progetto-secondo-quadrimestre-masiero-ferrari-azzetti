import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.css',
})
export class SearchBar implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  query = signal('');

  ngOnInit() {
    // Pre-populate from URL if already on /products
    const q = this.route.snapshot.queryParamMap.get('q') ?? '';
    if (q) this.query.set(q);
  }

  search() {
    const q = this.query().trim();
    this.router.navigate(['/products'], { queryParams: q ? { q } : {} });
  }

  onKeyUp(event: KeyboardEvent) {
    if (event.key === 'Enter') this.search();
  }
}

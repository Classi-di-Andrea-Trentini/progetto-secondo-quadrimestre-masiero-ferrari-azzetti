import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../services/cart-service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart {
  readonly cart = inject(CartService);

  formatPrice(v: number): string {
    return '€ ' + v.toFixed(2).replace('.', ',');
  }

  increaseQty(variantId: string, currentQty: number) {
    this.cart.updateQuantity(variantId, currentQty + 1);
  }

  decreaseQty(variantId: string, currentQty: number) {
    this.cart.updateQuantity(variantId, currentQty - 1);
  }

  remove(variantId: string) {
    this.cart.removeItem(variantId);
  }
}

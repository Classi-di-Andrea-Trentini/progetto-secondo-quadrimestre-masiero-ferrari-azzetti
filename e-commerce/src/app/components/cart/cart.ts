import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../services/cart-service';
import { ProductImageComponent } from '../product-image/product-image';
import { formatPrice as formatPriceShared } from '../../services/format-price';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductImageComponent],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart {
  readonly cart = inject(CartService);

  // Formato inglese (€120.00), centralizzato in services/format-price.ts.
  formatPrice(v: number): string {
    return formatPriceShared(v);
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

import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CartService, CartItem } from '../../services/cart-service';

@Component({
  selector: 'app-cart',
  imports: [RouterModule],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart {
  readonly cart = inject(CartService);

  formatPrice(value: number): string {
    return '€ ' + value.toFixed(2).replace('.', ',');
  }

  inc(item: CartItem) {
    this.cart.updateQuantity(item.productId, item.variantId, item.quantity + 1);
  }

  dec(item: CartItem) {
    this.cart.updateQuantity(item.productId, item.variantId, item.quantity - 1);
  }

  remove(item: CartItem) {
    this.cart.removeItem(item.productId, item.variantId);
  }
}

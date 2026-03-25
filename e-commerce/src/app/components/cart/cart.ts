import { Component, computed, inject } from '@angular/core';
import { CartService } from '../../services/cart-service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-cart',
  imports: [],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart {
  readonly cart = inject(CartService);
}

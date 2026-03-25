import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ProductCategory = 'Clothing' | 'Shoes';

interface ProductRow {
  name: string;
  category: ProductCategory;
  price: number;
  quantity: number;
}

@Component({
  selector: 'app-admin-products',
  imports: [FormsModule],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.css',
})
export class AdminProducts {
  readonly products: ProductRow[] = [];

  isModalOpen = false;

  modalForm: ProductRow = this.createEmptyForm();

  openCreateModal(): void {
    this.modalForm = this.createEmptyForm();
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  saveProduct(): void {
    const name = this.modalForm.name.trim();
    if (!name) return;

    const newProduct: ProductRow = {
      name,
      category: this.modalForm.category,
      price: Number(this.modalForm.price) || 0,
      quantity: Number(this.modalForm.quantity) || 0,
    };

    this.products.push(newProduct);
    this.closeModal();
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(value);
  }

  private createEmptyForm(): ProductRow {
    return {
      name: '',
      category: 'Clothing',
      price: 0,
      quantity: 0,
    };
  }

}

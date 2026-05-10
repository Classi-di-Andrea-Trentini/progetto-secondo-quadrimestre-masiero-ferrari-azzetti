import { Component, inject, signal, effect } from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth';
import { WishlistService } from '../../services/wishlist.service';
import { CartService, AddressData } from '../../services/cart-service';
import { API_URL } from '../../services/api.config';

interface OrderSummary {
  id: string;
  status: string;
  total: string;
  subtotal: string;
  shippingCost: string;
  discountTotal: string;
  createdAt: string;
  items: { productName: string; quantity: number; lineTotal: string }[];
  payments: { status: string }[];
}

type TabSection = 'profile' | 'orders' | 'favorites' | 'addresses' | 'settings';

@Component({
  selector: 'app-me',
  standalone: true,
  imports: [NgClass, DatePipe, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './me.html',
  styleUrls: ['./me.css'],
})
export class MeComponent {
  readonly auth = inject(AuthService);
  readonly wishlist = inject(WishlistService);
  private readonly cart = inject(CartService);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  activeTab = signal<TabSection>('profile');

  // -- Ordini --
  orders = signal<OrderSummary[]>([]);
  ordersLoading = signal(false);
  ordersError = signal<string | null>(null);
  ordersPage = signal(1);
  ordersTotalPages = signal(1);
  ordersTotal = signal(0);
  expandedOrderId = signal<string | null>(null);

  // -- Indirizzi --
  addresses = signal<AddressData[]>([]);
  addressesLoading = signal(false);
  addressesError = signal<string | null>(null);
  addressAction = signal<string | null>(null);
  showAddressForm = signal(false);
  addressFormLoading = signal(false);
  addressFormError = signal<string | null>(null);

  readonly newAddressForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    street: ['', [Validators.required]],
    street2: [''],
    city: ['', [Validators.required]],
    province: [''],
    postalCode: ['', [Validators.required]],
    country: ['IT', [Validators.required]],
    isDefault: [false],
  });

  async loadAddresses() {
    this.addressesLoading.set(true);
    this.addressesError.set(null);
    try {
      this.addresses.set(await this.cart.getAddresses());
    } catch {
      this.addressesError.set('Impossibile caricare gli indirizzi');
    } finally {
      this.addressesLoading.set(false);
    }
  }

  async saveAddress() {
    if (this.newAddressForm.invalid || this.addressFormLoading()) return;
    this.addressFormLoading.set(true);
    this.addressFormError.set(null);
    try {
      const v = this.newAddressForm.getRawValue();
      await this.cart.createAddress({
        fullName: v.fullName,
        phone: v.phone || null,
        street: v.street,
        street2: v.street2 || null,
        city: v.city,
        province: v.province || null,
        postalCode: v.postalCode,
        country: v.country,
      });
      this.newAddressForm.reset({ country: 'IT', isDefault: false });
      this.showAddressForm.set(false);
      this.addressAction.set('Indirizzo salvato!');
      await this.loadAddresses();
      setTimeout(() => this.addressAction.set(null), 3000);
    } catch {
      this.addressFormError.set('Impossibile salvare l\'indirizzo');
    } finally {
      this.addressFormLoading.set(false);
    }
  }

  async deleteAddress(id: string) {
    try {
      await firstValueFrom(
        this.http.delete(`${API_URL}/addresses/${id}`, { withCredentials: true })
      );
      this.addresses.update(list => list.filter(a => a.id !== id));
      this.addressAction.set('Indirizzo eliminato');
      setTimeout(() => this.addressAction.set(null), 3000);
    } catch {
      this.addressesError.set('Impossibile eliminare l\'indirizzo');
    }
  }

  async setDefaultAddress(id: string) {
    try {
      await firstValueFrom(
        this.http.patch(`${API_URL}/addresses/${id}/default`, {}, { withCredentials: true })
      );
      await this.loadAddresses();
    } catch {
      this.addressesError.set('Impossibile impostare l\'indirizzo predefinito');
    }
  }

  readonly orderStatusLabels: Record<string, string> = {
    pending: 'In attesa',
    paid: 'Pagato',
    processing: 'In lavorazione',
    shipped: 'Spedito',
    delivered: 'Consegnato',
    completed: 'Completato',
    cancelled: 'Annullato',
    refunded: 'Rimborsato',
  };

  readonly orderStatusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-blue-100 text-blue-800',
    processing: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    completed: 'bg-green-200 text-green-900',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-700',
  };

  // -- Modifica profilo --
  isEditing = signal(false);
  saveLoading = signal(false);
  saveError = signal<string | null>(null);
  saveSuccess = signal(false);

  readonly profileForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    phone: [''],
    birthDate: [''],
    gender: [''],
  });

  // -- Cambio password --
  passwordLoading = signal(false);
  passwordError = signal<string | null>(null);
  passwordSuccess = signal<string | null>(null);

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required, Validators.minLength(1)]],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: (g) => g.get('newPassword')?.value === g.get('confirmPassword')?.value ? null : { mismatch: true } },
  );

  // -- Verifica email --
  verifyLoading = signal(false);
  verifyMessage = signal<string | null>(null);

  async sendVerification() {
    this.verifyLoading.set(true);
    this.verifyMessage.set(null);
    try {
      const msg = await this.auth.sendVerificationEmail();
      this.verifyMessage.set(msg);
    } catch (err) {
      this.verifyMessage.set(this.auth.extractErrorMessage(err));
    } finally {
      this.verifyLoading.set(false);
    }
  }

  // -- Cambio email --
  emailChangeVisible = signal(false);
  emailLoading = signal(false);
  emailError = signal<string | null>(null);
  emailSuccess = signal<string | null>(null);

  readonly emailForm = this.fb.nonNullable.group({
    newEmail: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    currentPassword: ['', [Validators.required, Validators.minLength(1)]],
  });

  constructor() {
    // Popola il form con i dati attuali dell'utente ogni volta che cambia
    effect(() => {
      const user = this.auth.currentUser();
      if (user && !this.isEditing()) {
        this.profileForm.setValue({
          fullName: user.fullName,
          phone: user.phone ?? '',
          birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
          gender: user.gender ?? '',
        });
      }
    });
  }

  setTab(tab: TabSection) {
    this.activeTab.set(tab);
    if (tab === 'favorites') this.wishlist.loadItems();
    if (tab === 'orders' && this.orders().length === 0) this.loadOrders();
    if (tab === 'addresses' && this.addresses().length === 0) this.loadAddresses();
  }

  async loadOrders(page = 1) {
    this.ordersLoading.set(true);
    this.ordersError.set(null);
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${API_URL}/orders`, {
          params: { page: String(page), limit: '10' },
          withCredentials: true,
        })
      );
      this.orders.set(res.data);
      this.ordersPage.set(res.meta.page);
      this.ordersTotalPages.set(res.meta.totalPages);
      this.ordersTotal.set(res.meta.total);
    } catch {
      this.ordersError.set('Impossibile caricare gli ordini');
    } finally {
      this.ordersLoading.set(false);
    }
  }

  toggleOrderExpand(id: string) {
    this.expandedOrderId.update(cur => cur === id ? null : id);
  }

  formatOrderPrice(v: string | number): string {
    return '€ ' + parseFloat(String(v)).toFixed(2).replace('.', ',');
  }

  orderStatusLabel(s: string): string { return this.orderStatusLabels[s] ?? s; }
  orderStatusColor(s: string): string { return this.orderStatusColors[s] ?? 'bg-gray-100 text-gray-700'; }

  async removeFromWishlist(productId: string) {
    await this.wishlist.toggle(productId);
  }

  wishlistCoverImage(item: any): string {
    return item.product?.images?.find((i: any) => i.isCover)?.url
      ?? item.product?.images?.[0]?.url
      ?? '';
  }

  wishlistPrice(item: any): string {
    const p = item.product;
    if (!p) return '';
    const d = p.discounts?.[0];
    let price = parseFloat(String(p.basePrice));
    if (d?.type === 'percentage') price = price * (1 - parseFloat(String(d.value)) / 100);
    else if (d?.type === 'fixed_amount') price -= parseFloat(String(d.value));
    return '€ ' + price.toFixed(2).replace('.', ',');
  }

  startEditing() {
    const user = this.auth.currentUser();
    if (!user) return;
    this.profileForm.setValue({
      fullName: user.fullName,
      phone: user.phone ?? '',
      birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
      gender: user.gender ?? '',
    });
    this.saveError.set(null);
    this.saveSuccess.set(false);
    this.isEditing.set(true);
  }

  cancelEditing() {
    this.isEditing.set(false);
    this.saveError.set(null);
  }

  async saveProfile() {
    if (this.profileForm.invalid || this.saveLoading()) return;

    this.saveLoading.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    try {
      const { fullName, phone, birthDate, gender } = this.profileForm.getRawValue();
      await this.auth.updateProfile({
        fullName,
        phone: phone || undefined,
        birthDate: birthDate || undefined,
        gender: gender || undefined,
      });
      this.saveSuccess.set(true);
      this.isEditing.set(false);
    } catch (err) {
      this.saveError.set(this.auth.extractErrorMessage(err));
    } finally {
      this.saveLoading.set(false);
    }
  }

  async submitEmailChange() {
    if (this.emailForm.invalid || this.emailLoading()) return;

    this.emailLoading.set(true);
    this.emailError.set(null);
    this.emailSuccess.set(null);

    try {
      const { newEmail, currentPassword } = this.emailForm.getRawValue();
      const msg = await this.auth.requestEmailChange(newEmail, currentPassword);
      this.emailSuccess.set(msg);
      this.emailForm.reset();
    } catch (err) {
      this.emailError.set(this.auth.extractErrorMessage(err));
    } finally {
      this.emailLoading.set(false);
    }
  }

  async submitPasswordChange() {
    if (this.passwordForm.invalid || this.passwordLoading()) return;

    this.passwordLoading.set(true);
    this.passwordError.set(null);
    this.passwordSuccess.set(null);

    try {
      const { currentPassword, newPassword } = this.passwordForm.getRawValue();
      const msg = await this.auth.changePassword(currentPassword, newPassword);
      this.passwordSuccess.set(msg);
      this.passwordForm.reset();
    } catch (err) {
      this.passwordError.set(this.auth.extractErrorMessage(err));
    } finally {
      this.passwordLoading.set(false);
    }
  }

  async logout() {
    await this.auth.logout();
  }

  get fullName() { return this.profileForm.controls.fullName; }
  get newEmail() { return this.emailForm.controls.newEmail; }
  get currentPassword() { return this.emailForm.controls.currentPassword; }
  get newPassword() { return this.passwordForm.controls.newPassword; }
  get confirmPassword() { return this.passwordForm.controls.confirmPassword; }
}

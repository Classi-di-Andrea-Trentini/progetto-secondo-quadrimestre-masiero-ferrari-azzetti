import { Component, computed, inject, signal, effect } from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth';
import { WishlistService, WishlistItem } from '../../services/wishlist.service';
import { CartService, AddressData } from '../../services/cart-service';
import { API_URL } from '../../services/api.config';
import { ProductImageComponent } from '../../components/product-image/product-image';
import { formatPrice } from '../../services/format-price';

interface OrderSummary {
  id: string;
  status: string;
  total: string;
  subtotal: string;
  shippingCost: string;
  discountTotal: string;
  createdAt: string;
  items: { id: string; productName: string; quantity: number; lineTotal: string }[];
  payments: { status: string }[];
  /** Cronologia degli stati: il backend la restituisce gia', non veniva mostrata. */
  statusHistory?: { status: string; note: string | null; createdAt: string }[];
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  invoiceNumber?: string | null;
}

type TabSection = 'profile' | 'orders' | 'favorites' | 'addresses' | 'settings';

@Component({
  selector: 'app-me',
  standalone: true,
  imports: [NgClass, DatePipe, ReactiveFormsModule, FormsModule, RouterModule, ProductImageComponent],
  templateUrl: './me.html',
  styleUrls: ['./me.css'],
})
export class MeComponent {
  readonly auth = inject(AuthService);
  readonly wishlist = inject(WishlistService);

  /**
   * Se questo account una password ce l'ha.
   *
   * Chi si e' registrato con Google non ne ha mai scelta una: offrirgli "cambia
   * password" o chiedergli la "password attuale" per cambiare indirizzo significa
   * chiedere qualcosa che non esiste, e il server risponderebbe con un errore che
   * sembra colpa sua. `!== false` e non `=== true`: finche' l'utente non e' ancora
   * stato caricato non si mostra lo stato speciale, altrimenti la pagina
   * sfarfallerebbe fra le due versioni a ogni ricaricamento.
   */
  readonly hasPassword = computed(() => this.auth.currentUser()?.hasPassword !== false);
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
  invoiceLoadingId = signal<string | null>(null);
  cancelOrderId = signal<string | null>(null);
  cancelOrderLoading = signal(false);
  cancelOrderSuccess = signal<string | null>(null);

  // -- Resi --
  /** orderId -> stato del reso già aperto per quell'ordine, se c'è. */
  returnStatusByOrderId = signal<Record<string, string>>({});
  returnModalOrder = signal<OrderSummary | null>(null);
  returnQuantities = signal<Record<string, number>>({});
  returnReason = signal('');
  returnLoading = signal(false);
  returnError = signal<string | null>(null);
  returnSuccess = signal<string | null>(null);

  readonly returnStatusLabels: Record<string, string> = {
    requested: 'Requested', approved: 'Approved', rejected: 'Rejected',
    received: 'Received', refunded: 'Refunded',
  };

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
      this.addressesError.set('Unable to load addresses');
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
      this.addressAction.set('Address saved!');
      await this.loadAddresses();
      setTimeout(() => this.addressAction.set(null), 3000);
    } catch {
      this.addressFormError.set('Unable to save the address');
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
      this.addressAction.set('Address deleted');
      setTimeout(() => this.addressAction.set(null), 3000);
    } catch {
      this.addressesError.set('Unable to delete the address');
    }
  }

  async setDefaultAddress(id: string) {
    try {
      await firstValueFrom(
        this.http.patch(`${API_URL}/addresses/${id}/set-default`, {}, { withCredentials: true })
      );
      await this.loadAddresses();
    } catch {
      this.addressesError.set('Unable to set the default address');
    }
  }

  readonly orderStatusLabels: Record<string, string> = {
    pending: 'Pending',
    paid: 'Paid',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  };

  readonly orderStatusColors: Record<string, string> = {
    pending: 'badge-warning',
    paid: 'badge-info',
    processing: 'badge-info',
    shipped: 'badge-accent',
    delivered: 'badge-success',
    completed: 'badge-success',
    cancelled: 'badge-danger',
    refunded: 'badge-neutral',
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
    if (tab === 'orders' && this.orders().length === 0) { this.loadOrders(); this.loadMyReturns(); }
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
      this.ordersError.set('Unable to load your orders');
    } finally {
      this.ordersLoading.set(false);
    }
  }

  /**
   * Scarica la fattura in PDF.
   *
   * Passa da `fetch` e non da un link diretto perche' l'endpoint richiede il cookie
   * di sessione e risponde con un allegato: un `<a href>` in SSR non porterebbe le
   * credenziali e mostrerebbe una pagina di errore al posto del file.
   */
  async downloadInvoice(orderId: string, event: Event): Promise<void> {
    event.stopPropagation();
    this.invoiceLoadingId.set(orderId);
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/invoice`, { credentials: 'include' });
      if (!res.ok) throw new Error('Invoice not available');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1]
        ?? `invoice-${orderId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.ordersError.set('The invoice could not be downloaded.');
    } finally {
      this.invoiceLoadingId.set(null);
    }
  }

  toggleOrderExpand(id: string) {
    this.expandedOrderId.update(cur => cur === id ? null : id);
  }

  formatOrderPrice(v: string | number): string {
    return formatPrice(v);
  }

  orderStatusLabel(s: string): string { return this.orderStatusLabels[s] ?? s; }
  orderStatusColor(s: string): string { return this.orderStatusColors[s] ?? 'badge-neutral'; }
  canCancelOrder(status: string): boolean { return status === 'pending' || status === 'paid'; }

  requestCancelOrder(id: string) { this.cancelOrderId.set(id); }
  dismissCancelOrder() { this.cancelOrderId.set(null); }

  async confirmCancelOrder() {
    const id = this.cancelOrderId();
    if (!id || this.cancelOrderLoading()) return;
    this.cancelOrderLoading.set(true);
    try {
      await firstValueFrom(this.http.patch(`${API_URL}/orders/${id}/cancel`, {}, { withCredentials: true }));
      this.orders.update(list => list.map(o => o.id === id ? { ...o, status: 'cancelled' } : o));
      this.cancelOrderId.set(null);
      this.cancelOrderSuccess.set('Order cancelled successfully.');
      setTimeout(() => this.cancelOrderSuccess.set(null), 4000);
    } catch {
      this.ordersError.set('Unable to cancel the order. Please contact support.');
    } finally {
      this.cancelOrderLoading.set(false);
    }
  }

  /** Un reso attivo per ordine (stessa regola del backend): mostra il badge invece del bottone. */
  async loadMyReturns() {
    try {
      const res: any = await firstValueFrom(this.http.get(`${API_URL}/returns`, { withCredentials: true }));
      const map: Record<string, string> = {};
      for (const r of res) {
        if (r.status !== 'rejected') map[r.order.id] = r.status;
      }
      this.returnStatusByOrderId.set(map);
    } catch {
      // Non bloccante: senza questa mappa si vede solo il bottone "Richiedi reso"
      // anche per ordini che già ne hanno uno, il backend rifiuterebbe comunque.
    }
  }

  canRequestReturn(order: OrderSummary): boolean {
    return (order.status === 'delivered' || order.status === 'completed')
      && !this.returnStatusByOrderId()[order.id];
  }

  openReturnModal(order: OrderSummary, event: Event) {
    event.stopPropagation();
    const initial: Record<string, number> = {};
    for (const item of order.items) initial[item.id] = 0;
    this.returnQuantities.set(initial);
    this.returnReason.set('');
    this.returnError.set(null);
    this.returnModalOrder.set(order);
  }

  closeReturnModal() {
    if (this.returnLoading()) return;
    this.returnModalOrder.set(null);
  }

  setReturnQuantity(itemId: string, qty: number, maxQty: number) {
    const clamped = Math.max(0, Math.min(qty, maxQty));
    this.returnQuantities.update(map => ({ ...map, [itemId]: clamped }));
  }

  get returnHasSelection(): boolean {
    return Object.values(this.returnQuantities()).some(q => q > 0);
  }

  async submitReturn() {
    const order = this.returnModalOrder();
    if (!order || this.returnLoading()) return;

    const reason = this.returnReason().trim();
    if (reason.length < 10) {
      this.returnError.set('Describe the reason for the return in at least 10 characters.');
      return;
    }
    const items = Object.entries(this.returnQuantities())
      .filter(([, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (items.length === 0) {
      this.returnError.set('Select at least one item to return.');
      return;
    }

    this.returnLoading.set(true);
    this.returnError.set(null);
    try {
      const created: any = await firstValueFrom(
        this.http.post(`${API_URL}/returns`, { orderId: order.id, reason, items }, { withCredentials: true }),
      );
      this.returnStatusByOrderId.update(map => ({ ...map, [order.id]: created.status }));
      this.returnModalOrder.set(null);
      this.returnSuccess.set('Return request sent.');
      setTimeout(() => this.returnSuccess.set(null), 4000);
    } catch (err: any) {
      this.returnError.set(err?.error?.message ?? 'Unable to send the return request.');
    } finally {
      this.returnLoading.set(false);
    }
  }

  async removeFromWishlist(productId: string) {
    await this.wishlist.toggle(productId);
  }


  /** GET /wishlist non manda gli sconti: qui si mostra il prezzo di listino. */
  wishlistPrice(item: WishlistItem): string {
    const price = parseFloat(String(item.basePrice));
    if (!Number.isFinite(price)) return '';
    return formatPrice(price);
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

  // ─── GDPR: i propri dati, e la porta d'uscita ───────────────────────────

  exportLoading = signal(false);
  exportError = signal<string | null>(null);

  /**
   * Art. 20: scarica tutto quello che il negozio conserva su di te.
   *
   * Passa da `fetch` e non da un `<a href>` per la stessa ragione della fattura:
   * l'endpoint vuole il cookie di sessione e risponde con un allegato, e un link
   * diretto non porterebbe le credenziali.
   */
  async exportMyData(): Promise<void> {
    if (this.exportLoading()) return;
    this.exportLoading.set(true);
    this.exportError.set(null);

    try {
      const res = await fetch(`${API_URL}/users/me/export`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export not available');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1]
        ?? 'common-era-personal-data.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.exportError.set('Your data could not be downloaded. Please try again shortly.');
    } finally {
      this.exportLoading.set(false);
    }
  }

  // ── Cancellazione dell'account ────────────────────────────────────

  deleteAccountOpen = signal(false);
  deleteAccountPassword = signal('');
  deleteAccountLoading = signal(false);
  deleteAccountError = signal<string | null>(null);

  openDeleteAccount(): void {
    this.deleteAccountPassword.set('');
    this.deleteAccountError.set(null);
    this.deleteAccountOpen.set(true);
  }

  closeDeleteAccount(): void {
    if (this.deleteAccountLoading()) return;
    this.deleteAccountOpen.set(false);
    this.deleteAccountPassword.set('');
  }

  /**
   * Art. 17: chiude l'account.
   *
   * La password si controlla anche qui e non solo sul server: non e' sicurezza —
   * quella la fa il backend — ma evita di mandare una richiesta irreversibile
   * partita da un campo lasciato vuoto per sbaglio.
   */
  async confirmDeleteAccount(): Promise<void> {
    if (this.deleteAccountLoading()) return;

    const password = this.deleteAccountPassword();
    if (!password) {
      this.deleteAccountError.set('Enter your password to confirm.');
      return;
    }

    this.deleteAccountLoading.set(true);
    this.deleteAccountError.set(null);

    try {
      await this.auth.eraseAccount(password);
      this.deleteAccountOpen.set(false);
    } catch (err) {
      this.deleteAccountError.set(this.auth.extractErrorMessage(err));
    } finally {
      this.deleteAccountLoading.set(false);
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

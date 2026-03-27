import { Component, inject, signal, effect } from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { WishlistService } from '../../services/wishlist.service';

type TabSection = 'profile' | 'orders' | 'favorites' | 'settings';

@Component({
  selector: 'app-me',
  standalone: true,
  imports: [NgClass, DatePipe, ReactiveFormsModule, RouterModule],
  templateUrl: './me.html',
  styleUrls: ['./me.css'],
})
export class MeComponent {
  readonly auth = inject(AuthService);
  readonly wishlist = inject(WishlistService);
  private readonly fb = inject(FormBuilder);

  activeTab = signal<TabSection>('profile');

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
  }

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
    let price = p.basePrice;
    if (d?.type === 'percentage') price = price * (1 - d.value / 100);
    else if (d?.type === 'fixed_amount') price -= d.value;
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

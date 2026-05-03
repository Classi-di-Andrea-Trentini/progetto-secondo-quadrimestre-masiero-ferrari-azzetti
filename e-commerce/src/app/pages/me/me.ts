import { Component, inject, signal, effect, WritableSignal } from '@angular/core';
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
  styleUrls: ['./me.css']
})
export class MeComponent {
   // Services 
  readonly auth = inject(AuthService);
  readonly wishlist = inject(WishlistService);
  private readonly fb = inject(FormBuilder);

  //  Navigation 
  activeTab: WritableSignal<TabSection> = signal<TabSection>('profile');

  //  Profile edit 
  isEditing: WritableSignal<boolean> = signal<boolean>(false);
  saveLoading: WritableSignal<boolean> = signal<boolean>(false);
  saveError: WritableSignal<string | null> = signal<string | null>(null);
  saveSuccess: WritableSignal<boolean> = signal<boolean>(false);

  readonly profileForm = this.fb.nonNullable.group({
    fullName: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(255)],
    ],
    phone: [''],
    birthDate: [''],
    gender: [''],
  });

  //  Password change 
  passwordLoading: WritableSignal<boolean> = signal<boolean>(false);
  passwordError: WritableSignal<string | null> = signal<string | null>(null);
  passwordSuccess: WritableSignal<string | null> = signal<string | null>(null);
 
  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: [
        '',
        [Validators.required, Validators.minLength(1)],
      ],
      newPassword: [
        '',
        [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (g) =>
        g.get('newPassword')?.value === g.get('confirmPassword')?.value
          ? null
          : { mismatch: true },
    },
  );

  //  Email verification
  verifyLoading: WritableSignal<boolean> = signal<boolean>(false);
  verifyMessage: WritableSignal<string | null> = signal<string | null>(null);
 
  // Email change 
  emailChangeVisible: WritableSignal<boolean> = signal<boolean>(false);
  emailLoading: WritableSignal<boolean> = signal<boolean>(false);
  emailError: WritableSignal<string | null> = signal<string | null>(null);
  emailSuccess: WritableSignal<string | null> = signal<string | null>(null);
 
  readonly emailForm = this.fb.nonNullable.group({
    newEmail: [
      '',
      [Validators.required, Validators.email, Validators.maxLength(255)],
    ],
    currentPassword: ['', [Validators.required, Validators.minLength(1)]],
  });

  //  Constructor 
  constructor() {
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
   //  Navigation 
  setTab(tab: TabSection): void {
    this.activeTab.set(tab);
    if (tab === 'favorites') {
      this.wishlist.loadItems();
    }
  }

    //  Wishlist helpers 
  async removeFromWishlist(productId: string): Promise<void> {
    await this.wishlist.toggle(productId);
  }
 
  wishlistCoverImage(item: any): string {
    return (
      item.product?.images?.find((i: any) => i.isCover)?.url ??
      item.product?.images?.[0]?.url ??
      ''
    );
  }
 
  wishlistPrice(item: any): string {
    const p = item.product;
    if (!p) return '';

    const d = p.discounts?.[0];
    let price = parseFloat(String(p.basePrice));
 
    if (d?.type === 'percentage') {
      price = price * (1 - parseFloat(String(d.value)) / 100);
    } else if (d?.type === 'fixed_amount') {
      price -= parseFloat(String(d.value));
    }
 
    return '€ ' + price.toFixed(2).replace('.', ',');
  }

  //  Profile edit 
  startEditing(): void {
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
 
  cancelEditing(): void {
    this.isEditing.set(false);
    this.saveError.set(null);
  }
 
  async saveProfile(): Promise<void> {
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

  // ── Email verification ────────────────────────────────────────────────────
  async sendVerification(): Promise<void> {
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

  //  Email change 
  async submitEmailChange(): Promise<void> {
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

   //  Password change 
  async submitPasswordChange(): Promise<void> {
    if (this.passwordForm.invalid || this.passwordLoading()) return;
 
    this.passwordLoading.set(true);
    this.passwordError.set(null);
    this.passwordSuccess.set(null);
 
    try {
      const { currentPassword, newPassword } =
        this.passwordForm.getRawValue();
      const msg = await this.auth.changePassword(currentPassword, newPassword);
      this.passwordSuccess.set(msg);
      this.passwordForm.reset();
    } catch (err) {
      this.passwordError.set(this.auth.extractErrorMessage(err));
    } finally {
      this.passwordLoading.set(false);
    }
  }
 
 //  Auth 
  async logout(): Promise<void> {
    await this.auth.logout();
  }
 
  //  Form control shortcuts 
  get fullName() { return this.profileForm.controls.fullName; }
  get newEmail() { return this.emailForm.controls.newEmail; }
  get currentPassword() { return this.emailForm.controls.currentPassword; }
  get newPassword() { return this.passwordForm.controls.newPassword; }
  get confirmPassword() { return this.passwordForm.controls.confirmPassword; }
}


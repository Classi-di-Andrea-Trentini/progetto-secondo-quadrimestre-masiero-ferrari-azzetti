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
}

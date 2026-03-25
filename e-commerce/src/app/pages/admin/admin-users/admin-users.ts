import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type UserRole = 'Customer' | 'Admin';
type UserStatus = 'Active' | 'Inactive';

interface AdminUserRow {
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
})
export class AdminUsers {
  readonly users: AdminUserRow[] = [];

  isModalOpen = false;
  isEditing = false;
  editingIndex: number | null = null;

  modalForm: AdminUserRow = this.createEmptyForm();

  openCreateModal(): void {
    this.isEditing = false;
    this.editingIndex = null;
    this.modalForm = this.createEmptyForm();
    this.isModalOpen = true;
  }

  openEditModal(index: number): void {
    const user = this.users[index];
    if (!user) return;

    this.isEditing = true;
    this.editingIndex = index;
    this.modalForm = { ...user };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  saveModal(): void {
    const fullName = this.modalForm.fullName.trim();
    const email = this.modalForm.email.trim();

    if (!fullName || !email) {
      return;
    }

    const normalizedRow: AdminUserRow = {
      fullName,
      email,
      role: this.modalForm.role,
      status: this.modalForm.status,
    };

    if (this.isEditing && this.editingIndex !== null) {
      this.users[this.editingIndex] = normalizedRow;
    } else {
      this.users.push(normalizedRow);
    }

    this.closeModal();
  }

  private createEmptyForm(): AdminUserRow {
    return {
      fullName: '',
      email: '',
      role: 'Customer',
      status: 'Active',
    };
  }

}

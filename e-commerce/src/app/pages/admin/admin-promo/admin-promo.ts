import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type PromotionStatus = 'Active' | 'Scheduled' | 'Finished';

interface PromotionRow {
  campaignName: string;
  code: string;
  discountValue: number;
  startDate: string;
  endDate: string;
  validity: string;
  status: PromotionStatus;
}

interface PromotionForm {
  campaignName: string;
  code: string;
  discountValue: number;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-admin-promo',
  imports: [FormsModule],
  templateUrl: './admin-promo.html',
  styleUrl: './admin-promo.css',
})
export class AdminPromo {
  readonly promotions: PromotionRow[] = [];

  isModalOpen = false;
  isEditing = false;
  editingIndex: number | null = null;
  formError = '';

  modalForm: PromotionForm = this.createEmptyForm();

  openCreateModal(): void {
    this.isEditing = false;
    this.editingIndex = null;
    this.formError = '';
    this.modalForm = this.createEmptyForm();
    this.isModalOpen = true;
  }

  openEditModal(index: number): void {
    const promo = this.promotions[index];
    if (!promo) return;

    this.isEditing = true;
    this.editingIndex = index;
    this.formError = '';
    this.modalForm = {
      campaignName: promo.campaignName,
      code: promo.code,
      discountValue: promo.discountValue,
      startDate: promo.startDate,
      endDate: promo.endDate,
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.formError = '';
  }

  savePromotion(): void {
    const campaignName = this.modalForm.campaignName.trim();
    const code = this.modalForm.code.trim().toUpperCase();
    const discountValue = Number(this.modalForm.discountValue) || 0;

    if (!campaignName || !code || discountValue <= 0 || discountValue > 100 || !this.modalForm.startDate) {
      this.formError = 'Compila tutti i campi obbligatori e inserisci uno sconto valido (1-100%).';
      return;
    }

    const start = this.parseDateOnly(this.modalForm.startDate);
    const end = this.modalForm.endDate ? this.parseDateOnly(this.modalForm.endDate) : null;

    if (!start) {
      this.formError = 'Data di inizio non valida.';
      return;
    }

    if (end && end < start) {
      this.formError = 'La data di fine non puo essere prima della data di inizio.';
      return;
    }

    this.formError = '';

    const validity = end
      ? `${this.formatDateRangePart(start)} - ${this.formatDateRangePart(end)}`
      : `From ${this.formatDateRangePart(start)}`;

    const status = this.computeStatus(start, end);

    const newOrUpdatedPromotion: PromotionRow = {
      campaignName,
      code,
      discountValue,
      startDate: this.modalForm.startDate,
      endDate: this.modalForm.endDate,
      validity,
      status,
    };

    if (this.isEditing && this.editingIndex !== null) {
      this.promotions[this.editingIndex] = newOrUpdatedPromotion;
    } else {
      this.promotions.push(newOrUpdatedPromotion);
    }

    this.closeModal();
  }

  isDateRangeInvalid(): boolean {
    const start = this.parseDateOnly(this.modalForm.startDate);
    const end = this.modalForm.endDate ? this.parseDateOnly(this.modalForm.endDate) : null;
    return !!(start && end && end < start);
  }

  isSaveDisabled(): boolean {
    const campaignName = this.modalForm.campaignName.trim();
    const code = this.modalForm.code.trim();
    const discountValue = Number(this.modalForm.discountValue) || 0;

    if (!campaignName || !code || !this.modalForm.startDate) return true;
    if (discountValue <= 0 || discountValue > 100) return true;
    if (this.isDateRangeInvalid()) return true;

    return false;
  }

  private formatDateRangePart(value: Date): string {
    return value.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  }

  private computeStatus(start: Date, end: Date | null): PromotionStatus {
    const today = this.getTodayDateOnly();

    if (start > today) return 'Scheduled';
    if (end && end < today) return 'Finished';
    return 'Active';
  }

  private getTodayDateOnly(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private parseDateOnly(value: string): Date | null {
    if (!value) return null;
    const [yearStr, monthStr, dayStr] = value.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private createEmptyForm(): PromotionForm {
    return {
      campaignName: '',
      code: '',
      discountValue: 0,
      startDate: '',
      endDate: '',
    };
  }

}

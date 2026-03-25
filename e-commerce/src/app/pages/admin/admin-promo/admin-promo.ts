import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type PromotionStatus = 'Active' | 'Scheduled';

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

  modalForm: PromotionForm = this.createEmptyForm();

  openCreateModal(): void {
    this.isEditing = false;
    this.editingIndex = null;
    this.modalForm = this.createEmptyForm();
    this.isModalOpen = true;
  }

  openEditModal(index: number): void {
    const promo = this.promotions[index];
    if (!promo) return;

    this.isEditing = true;
    this.editingIndex = index;
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
  }

  savePromotion(): void {
    const campaignName = this.modalForm.campaignName.trim();
    const code = this.modalForm.code.trim().toUpperCase();
    const discountValue = Number(this.modalForm.discountValue) || 0;

    if (!campaignName || !code || discountValue <= 0 || !this.modalForm.startDate) {
      return;
    }

    const start = new Date(this.modalForm.startDate);
    const end = this.modalForm.endDate ? new Date(this.modalForm.endDate) : null;

    const validity = end
      ? `${this.formatDateRangePart(start)} - ${this.formatDateRangePart(end)}`
      : `From ${this.formatDateRangePart(start)}`;

    const status: PromotionStatus = start <= new Date() ? 'Active' : 'Scheduled';

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

  private formatDateRangePart(value: Date): string {
    return value.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
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

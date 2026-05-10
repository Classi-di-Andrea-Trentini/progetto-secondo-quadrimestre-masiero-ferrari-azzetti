import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';

export interface AdminReturn {
  id: string;
  status: string;
  reason: string;
  adminNote: string | null;
  refundAmount: string | null;
  createdAt: string;
  resolvedAt: string | null;
  order: { id: string; total: string };
  user: { fullName: string; email: string };
  items: { id: string; quantity: number; orderItem: { productName: string; unitPrice: string } }[];
}

export interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalProducts: number;
  totalRevenue: number;
  pendingOrders: number;
  recentOrders: AdminOrderSummary[];
  topProducts: { id: string; name: string; slug: string; soldCount: number; basePrice: string }[];
  ordersByStatus: { status: string; count: number }[];
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  _count: { orders: number };
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: string;
  isActive: boolean;
  soldCount: number;
  rating: string;
  createdAt: string;
  category: { name: string } | null;
  images: { url: string }[];
  discounts: { discountType?: string; type?: string; value: string; isActive: boolean }[];
  _count: { variants: number };
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  material: string | null;
  priceOverride: string | null;
  stockQty: number;
  isActive: boolean;
  createdAt: string;
}

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isCover: boolean;
}

export interface AdminProductDetail extends AdminProduct {
  variants: ProductVariant[];
  images: ProductImage[];
  category: { id: string; name: string } | null;
}

export interface AdminOrderSummary {
  id: string;
  status: string;
  total: string;
  createdAt: string;
  user: { fullName: string; email: string };
  items: { productName: string; quantity: number; lineTotal: string }[];
  address?: { city: string; country: string };
}

export interface AdminOrderDetail extends AdminOrderSummary {
  subtotal: string;
  discountTotal: string;
  shippingCost: string;
  shippingMethod: string;
  notes: string | null;
  address: {
    fullName: string;
    street: string;
    street2: string | null;
    city: string;
    province: string | null;
    postalCode: string;
    country: string;
  };
  payments: { status: string; method: string; amount: string; paidAt: string | null }[];
  statusHistory: { status: string; note: string | null; createdAt: string }[];
  promoCode: { code: string } | null;
}

export interface AdminReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  createdAt: string;
  user: { fullName: string; email: string };
  product: { name: string; slug: string };
}

export interface AdminPromoCode {
  id: string;
  code: string;
  discountType: string;
  discountValue: string;
  minOrderAmount: string | null;
  maxUses: number | null;
  currentUses: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { uses: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AdminListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
  isActive?: boolean | string;
  discountType?: string;
}

export interface CreateProductPayload {
  name: string;
  slug: string;
  description?: string;
  categoryId?: string;
  basePrice: number;
  isActive?: boolean;
}

export interface CreatePromoCodePayload {
  code: string;
  discountType: string;
  discountValue: number;
  minOrderAmount?: number;
  maxUses?: number;
  expiresAt?: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_URL}/admin`;

  private buildParams(query: AdminListQuery): HttpParams {
    let params = new HttpParams();
    if (query.page) params = params.set('page', query.page);
    if (query.limit) params = params.set('limit', query.limit);
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    if (query.role) params = params.set('role', query.role);
    if (query.isActive !== undefined && query.isActive !== '') params = params.set('isActive', String(query.isActive));
    if (query.discountType) params = params.set('discountType', query.discountType);
    return params;
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.base}/dashboard/stats`, { withCredentials: true });
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  getUsers(query: AdminListQuery = {}): Observable<PaginatedResponse<AdminUser>> {
    return this.http.get<PaginatedResponse<AdminUser>>(`${this.base}/users`, {
      params: this.buildParams(query),
      withCredentials: true,
    });
  }

  updateUserRole(id: string, role: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.base}/users/${id}/role`, { role }, { withCredentials: true });
  }

  deleteUser(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/users/${id}`, { withCredentials: true });
  }

  // ─── Products ─────────────────────────────────────────────────────────────

  getProducts(query: AdminListQuery = {}): Observable<PaginatedResponse<AdminProduct>> {
    return this.http.get<PaginatedResponse<AdminProduct>>(`${this.base}/products`, {
      params: this.buildParams(query),
      withCredentials: true,
    });
  }

  getProductDetail(id: string): Observable<AdminProductDetail> {
    return this.http.get<AdminProductDetail>(`${this.base}/products/${id}`, { withCredentials: true });
  }

  createProduct(payload: CreateProductPayload): Observable<AdminProduct> {
    return this.http.post<AdminProduct>(`${this.base}/products`, payload, { withCredentials: true });
  }

  updateProduct(id: string, payload: Partial<CreateProductPayload>): Observable<AdminProduct> {
    return this.http.patch<AdminProduct>(`${this.base}/products/${id}`, payload, { withCredentials: true });
  }

  deleteProduct(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/products/${id}`, { withCredentials: true });
  }

  // ─── Variants ─────────────────────────────────────────────────────────────

  createVariant(productId: string, payload: Partial<ProductVariant>): Observable<ProductVariant> {
    return this.http.post<ProductVariant>(`${this.base}/products/${productId}/variants`, payload, { withCredentials: true });
  }

  updateVariant(productId: string, variantId: string, payload: Partial<ProductVariant>): Observable<ProductVariant> {
    return this.http.patch<ProductVariant>(`${this.base}/products/${productId}/variants/${variantId}`, payload, { withCredentials: true });
  }

  deleteVariant(productId: string, variantId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/products/${productId}/variants/${variantId}`, { withCredentials: true });
  }

  // ─── Images ───────────────────────────────────────────────────────────────

  addImage(productId: string, payload: { url: string; altText?: string; isCover?: boolean }): Observable<ProductImage> {
    return this.http.post<ProductImage>(`${this.base}/products/${productId}/images`, payload, { withCredentials: true });
  }

  uploadImage(productId: string, file: File): Observable<ProductImage> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ProductImage>(`${this.base}/products/${productId}/images/upload`, form, { withCredentials: true });
  }

  deleteImage(productId: string, imageId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/products/${productId}/images/${imageId}`, { withCredentials: true });
  }

  setCoverImage(productId: string, imageId: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.base}/products/${productId}/images/${imageId}/cover`, {}, { withCredentials: true });
  }

  // ─── Orders ───────────────────────────────────────────────────────────────

  getOrders(query: AdminListQuery = {}): Observable<PaginatedResponse<AdminOrderSummary>> {
    return this.http.get<PaginatedResponse<AdminOrderSummary>>(`${this.base}/orders`, {
      params: this.buildParams(query),
      withCredentials: true,
    });
  }

  getOrderDetail(id: string): Observable<AdminOrderDetail> {
    return this.http.get<AdminOrderDetail>(`${this.base}/orders/${id}`, { withCredentials: true });
  }

  updateOrderStatus(id: string, status: string, note?: string): Observable<{ id: string; status: string }> {
    return this.http.patch<{ id: string; status: string }>(
      `${this.base}/orders/${id}/status`,
      { status, note },
      { withCredentials: true },
    );
  }

  // ─── Promo Codes ──────────────────────────────────────────────────────────

  getPromoCodes(query: AdminListQuery = {}): Observable<PaginatedResponse<AdminPromoCode>> {
    return this.http.get<PaginatedResponse<AdminPromoCode>>(`${this.base}/promo-codes`, {
      params: this.buildParams(query),
      withCredentials: true,
    });
  }

  createPromoCode(payload: CreatePromoCodePayload): Observable<AdminPromoCode> {
    return this.http.post<AdminPromoCode>(`${this.base}/promo-codes`, payload, { withCredentials: true });
  }

  updatePromoCode(id: string, payload: { isActive?: boolean; maxUses?: number; expiresAt?: string }): Observable<AdminPromoCode> {
    return this.http.patch<AdminPromoCode>(`${this.base}/promo-codes/${id}`, payload, { withCredentials: true });
  }

  deletePromoCode(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/promo-codes/${id}`, { withCredentials: true });
  }

  // ─── Reviews ──────────────────────────────────────────────────────────────

  getReviews(query: AdminListQuery = {}): Observable<PaginatedResponse<AdminReview>> {
    return this.http.get<PaginatedResponse<AdminReview>>(`${this.base}/reviews`, {
      params: this.buildParams(query),
      withCredentials: true,
    });
  }

  updateReviewStatus(id: string, status: 'approved' | 'rejected'): Observable<AdminReview> {
    return this.http.patch<AdminReview>(`${this.base}/reviews/${id}/status`, { status }, { withCredentials: true });
  }

  deleteReview(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/reviews/${id}`, { withCredentials: true });
  }

  // ─── Returns ──────────────────────────────────────────────────────────────

  getReturns(query: AdminListQuery = {}): Observable<PaginatedResponse<AdminReturn>> {
    return this.http.get<PaginatedResponse<AdminReturn>>(`${this.base}/returns`, {
      params: this.buildParams(query),
      withCredentials: true,
    });
  }

  updateReturnStatus(id: string, payload: { status: string; adminNote?: string; refundAmount?: number }): Observable<AdminReturn> {
    return this.http.patch<AdminReturn>(`${this.base}/returns/${id}/status`, payload, { withCredentials: true });
  }

  exportOrders(query: { status?: string; dateFrom?: string; dateTo?: string } = {}): string {
    let params = new HttpParams();
    if (query.status) params = params.set('status', query.status);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    return `${this.base}/orders/export?${params.toString()}`;
  }

  exportUsers(): string {
    return `${this.base}/users/export`;
  }
}

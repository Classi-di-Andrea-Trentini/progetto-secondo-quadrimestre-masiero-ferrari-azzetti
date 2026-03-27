import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

const API_URL = 'http://localhost:3000';

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  isCover: boolean;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  priceOverride: number | null;
  stockQty: number;
}

export interface ProductDiscount {
  type: 'percentage' | 'fixed_amount';
  value: number;
  label: string | null;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  shortDesc: string | null;
  brand: string | null;
  basePrice: number;
  isNewArrival: boolean;
  isFeatured: boolean;
  avgRating: number | null;
  soldCount: number;
  category: ProductCategory;
  images: ProductImage[];
  variants: ProductVariant[];
  discounts: ProductDiscount[];
}

export interface ProductFull extends ProductListItem {
  description: string | null;
}

export interface ProductFilters {
  categories: (ProductCategory & { parentId: string | null })[];
  colors: { color: string; colorHex: string }[];
  sizes: string[];
  priceRange: { min: number; max: number };
}

export interface ProductsResponse {
  data: ProductListItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface GetProductsParams {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
  sortBy?: string;
  isNewArrival?: boolean;
  isFeatured?: boolean;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private http = inject(HttpClient);
  private base = `${API_URL}/products`;

  getProducts(params: GetProductsParams = {}) {
    let p = new HttpParams();
    if (params.search)      p = p.set('search', params.search);
    if (params.categoryId)  p = p.set('categoryId', params.categoryId);
    if (params.minPrice !== undefined) p = p.set('minPrice', params.minPrice);
    if (params.maxPrice !== undefined) p = p.set('maxPrice', params.maxPrice);
    if (params.sortBy)      p = p.set('sortBy', params.sortBy);
    if (params.isNewArrival !== undefined) p = p.set('isNewArrival', params.isNewArrival);
    if (params.isFeatured !== undefined)   p = p.set('isFeatured', params.isFeatured);
    if (params.page)        p = p.set('page', params.page);
    if (params.limit)       p = p.set('limit', params.limit);
    params.colors?.forEach(c => { p = p.append('colors[]', c); });
    params.sizes?.forEach(s => { p = p.append('sizes[]', s); });
    return this.http.get<ProductsResponse>(this.base, { params: p });
  }

  getFilters() {
    return this.http.get<ProductFilters>(`${this.base}/filters`);
  }

  getProductBySlug(slug: string) {
    return this.http.get<{ product: ProductFull; related: ProductListItem[] }>(`${this.base}/${slug}`);
  }
}

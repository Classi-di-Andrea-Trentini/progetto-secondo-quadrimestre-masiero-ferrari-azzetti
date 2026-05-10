import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './api.config';

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  isVerified: boolean;
  helpfulCount: number;
  createdAt: string;
  user: { fullName: string; avatarUrl: string | null };
  replies: { id: string; body: string; createdAt: string; admin: { fullName: string } }[];
}

export interface ReviewsResponse {
  data: Review[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http = inject(HttpClient);

  getByProduct(productId: string, page = 1, limit = 10): Observable<ReviewsResponse> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<ReviewsResponse>(`${API_URL}/reviews/product/${productId}`, { params });
  }

  create(payload: { productId: string; rating: number; title?: string; body?: string }): Observable<Review> {
    return this.http.post<Review>(`${API_URL}/reviews`, payload, { withCredentials: true });
  }

  voteHelpful(reviewId: string): Observable<any> {
    return this.http.post(`${API_URL}/reviews/${reviewId}/helpful`, {}, { withCredentials: true });
  }

  delete(reviewId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/reviews/${reviewId}`, { withCredentials: true });
  }
}

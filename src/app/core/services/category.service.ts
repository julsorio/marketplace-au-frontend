import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CategoryResponse } from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/categories`;

  private readonly _categories = signal<CategoryResponse[]>([]);
  readonly categories = this._categories.asReadonly();

  private loaded = false;

  loadCategories() {
    if (this.loaded) {
      return;
    }

    this.http.get<CategoryResponse[]>(this.apiUrl).pipe(
      tap((result) => {
        this._categories.set(result);
        this.loaded = true;
      })
    ).subscribe();
  }

  getSubcategories(categoryId: string): CategoryResponse[] {
    const category = this._categories().find(c => c.id === categoryId);
    return category?.subcategories ?? [];
  }
}
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

  /**
   * Carga el listado de categorías desde el backend y lo guarda en el signal `categories`.
   * Es idempotente: si ya se cargaron antes, no vuelve a pedirlas al servidor.
   */
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

  /**
   * Devuelve las subcategorías de una categoría dada.
   * @param categoryId Id de la categoría padre.
   * @returns Las subcategorías de esa categoría, o un array vacío si no existe o no tiene.
   */
  getSubcategories(categoryId: string): CategoryResponse[] {
    const category = this._categories().find(c => c.id === categoryId);
    return category?.subcategories ?? [];
  }
}

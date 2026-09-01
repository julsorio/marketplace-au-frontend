/**
 * Categoría de anuncios. Es un árbol, no una lista plana: las categorías raíz traen
 * sus subcategorías anidadas en `subcategories`, que a su vez podrían tener las suyas.
 */
export interface CategoryResponse {
  id: string;
  name: string;
  icon: string;
  subcategories: CategoryResponse[];
}
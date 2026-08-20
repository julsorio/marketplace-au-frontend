import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.Register)
  },
  {
    path: 'listings',
    loadComponent: () => import('./features/listings/listing-list/listing-list').then(m => m.ListingList)
  },
  {
    path: '',
    redirectTo: 'listings',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'listings'
  }
];
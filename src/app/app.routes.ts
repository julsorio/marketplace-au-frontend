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
    path: 'listings/new',
    loadComponent: () => import('./features/listings/listing-form/listing-form').then(m => m.ListingForm),
    canActivate: [authGuard]
  },
  {
    path: 'listings/:id/edit',
    loadComponent: () => import('./features/listings/listing-form/listing-form').then(m => m.ListingForm),
    canActivate: [authGuard]
  },
  {
    path: 'listings/:id',
    loadComponent: () => import('./features/listings/listing-detail/listing-detail').then(m => m.ListingDetail)
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
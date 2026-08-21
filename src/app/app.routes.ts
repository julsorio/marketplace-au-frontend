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
    path: 'favorites',
    loadComponent: () => import('./features/favorites/favorites-list/favorites-list').then(m => m.FavoritesList),
    canActivate: [authGuard]
  },
  {
    path: 'conversations',
    loadComponent: () => import('./features/conversations/conversation-list/conversation-list').then(m => m.ConversationList),
    canActivate: [authGuard]
  },
  {
    // Debe ir antes de 'conversations/:id' para que 'new' no se interprete como un id.
    path: 'conversations/new',
    loadComponent: () => import('./features/conversations/conversation-thread/conversation-thread').then(m => m.ConversationThread),
    canActivate: [authGuard]
  },
  {
    path: 'conversations/:id',
    loadComponent: () => import('./features/conversations/conversation-thread/conversation-thread').then(m => m.ConversationThread),
    canActivate: [authGuard]
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
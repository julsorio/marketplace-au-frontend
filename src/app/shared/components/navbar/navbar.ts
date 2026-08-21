import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../../core/services/auth.service';
import { FavoriteService } from '../../../core/services/favorite.service';
import { ConversationService } from '../../../core/services/conversation.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class Navbar {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  private readonly favoriteService = inject(FavoriteService);
  readonly conversationService = inject(ConversationService);

  constructor() {
    // Carga los ids de favoritos y arranca el polling de mensajes no leídos en cuanto hay
    // sesión iniciada (al arrancar la app con un token ya guardado, o justo tras iniciar
    // sesión), para que el corazón de listing-list/listing-detail y el badge de "Mensajes"
    // se pinten correctamente sin depender de qué pantalla se visite primero.
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.favoriteService.ensureLoaded();
        this.conversationService.ensureUnreadPolling();
      }
    });
  }

  onLogout(): void {
    this.authService.logout();
    this.favoriteService.reset();
    this.conversationService.resetUnreadCount();
    this.router.navigate(['/login']);
  }
}
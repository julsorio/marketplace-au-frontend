import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserService } from '../../../core/services/user.service';
import { ReviewService } from '../../../core/services/review.service';
import { UserPublicProfile } from '../../../core/models/user.model';
import { ReviewResponse } from '../../../core/models/review.model';

/**
 * Perfil público mínimo de un usuario (vendedor/comprador): nombre, rating agregado y sus
 * reseñas recibidas.
 *
 * Público a propósito, igual que /listings/:id — no requiere sesión.
 */
@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.scss'
})
export class UserProfile implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly userService = inject(UserService);
  private readonly reviewService = inject(ReviewService);

  readonly stars = [1, 2, 3, 4, 5];

  readonly profile = signal<UserPublicProfile | null>(null);
  readonly reviews = signal<ReviewResponse[]>([]);
  readonly isLoading = signal(true);
  readonly notFound = signal(false);

  /**
   * Carga el perfil público del usuario indicado en la ruta (`:id`) y, si existe, sus reseñas
   * recibidas. Si no hay id en la ruta o el perfil no se encuentra, marca `notFound`.
   */
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    this.userService.getPublicProfile(id).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.isLoading.set(false);
        this.reviewService.getReviewsForUser(id).subscribe({
          next: (reviews) => this.reviews.set(reviews),
          error: () => this.reviews.set([])
        });
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Formatea una fecha ISO como fecha localizada (en-AU) para mostrar en las reseñas.
   *
   * @param iso Fecha en formato ISO 8601.
   * @returns La fecha formateada como cadena legible.
   */
  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

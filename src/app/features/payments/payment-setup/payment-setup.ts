import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PaymentService } from '../../../core/services/payment.service';
import { ConnectStatus } from '../../../core/models/payment.model';

/**
 * Alta del usuario como vendedor en Stripe Connect para cobrar ventas con tarjeta. El formulario
 * (identidad y cuenta bancaria) lo aloja Stripe: aquí solo se pide el enlace y se redirige.
 *
 * Stripe vuelve a esta misma página con ?onboarding=return al terminar, o ?onboarding=refresh si
 * el enlace caducó (en ese caso se pide uno nuevo y se redirige otra vez).
 */
@Component({
  selector: 'app-payment-setup',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './payment-setup.html',
  styleUrl: './payment-setup.scss'
})
export class PaymentSetup implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly paymentService = inject(PaymentService);
  private readonly snackBar = inject(MatSnackBar);

  readonly status = signal<ConnectStatus | null>(null);
  readonly isLoading = signal(true);
  readonly isRedirecting = signal(false);
  readonly loadError = signal(false);

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('onboarding') === 'refresh') {
      this.startOnboarding();
      return;
    }
    this.loadStatus();
  }

  private loadStatus(): void {
    this.isLoading.set(true);
    this.paymentService.getConnectStatus().subscribe({
      next: (status) => {
        this.status.set(status);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  startOnboarding(): void {
    this.isRedirecting.set(true);
    this.paymentService.getOnboardingLink().subscribe({
      next: ({ url }) => {
        window.location.href = url;
      },
      error: (err) => {
        this.isRedirecting.set(false);
        this.isLoading.set(false);
        this.snackBar.open(err?.error?.message ?? 'No se pudo iniciar el alta', 'Cerrar', { duration: 4000 });
      }
    });
  }
}

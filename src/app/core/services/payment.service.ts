import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment';
import { ConnectStatus, OnboardingLink } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/payments`;

  // loadStripe inserta el script oficial desde js.stripe.com (no va en nuestro bundle) y debe
  // cargarse una sola vez por página.
  private stripePromise: Promise<Stripe | null> | null = null;

  get isCardPaymentConfigured(): boolean {
    return !!environment.stripePublishableKey;
  }

  getStripe(): Promise<Stripe | null> {
    if (!this.isCardPaymentConfigured) {
      return Promise.resolve(null);
    }
    this.stripePromise ??= loadStripe(environment.stripePublishableKey);
    return this.stripePromise;
  }

  getOnboardingLink(): Observable<OnboardingLink> {
    return this.http.post<OnboardingLink>(`${this.apiUrl}/connect/onboarding-link`, {});
  }

  getConnectStatus(): Observable<ConnectStatus> {
    return this.http.get<ConnectStatus>(`${this.apiUrl}/connect/status`);
  }
}

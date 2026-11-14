import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { Stripe, StripeElements } from '@stripe/stripe-js';
import { PaymentService } from '../../../core/services/payment.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { TransactionResponse } from '../../../core/models/transaction.model';

export interface CardPaymentDialogData {
  transactionId: string;
  listingId: string;
  amount: number;
  currency: string;
}

// 'paid': el backend ya recibió la confirmación de Stripe. 'processing': Stripe aceptó el pago pero
// el webhook aún no ha llegado. undefined: el comprador cerró sin pagar (la reserva sigue abierta
// hasta que caduque y puede pagar después desde el anuncio).
export type CardPaymentDialogResult = 'paid' | 'processing' | undefined;

type State = 'loading' | 'ready' | 'paying' | 'confirming' | 'unavailable';

const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 15;

/**
 * Pago con tarjeta de una transacción. Los datos de la tarjeta se escriben en el Payment Element,
 * un iframe servido por Stripe: nunca pasan por nuestro código ni por el backend.
 *
 * El navegador solo envía el pago: la transacción pasa a pagada cuando el webhook de Stripe llega al
 * backend, así que tras confirmar se consulta el estado hasta verla cambiar.
 */
@Component({
  selector: 'app-card-payment-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './card-payment-dialog.html',
  styleUrl: './card-payment-dialog.scss'
})
export class CardPaymentDialog implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<CardPaymentDialog, CardPaymentDialogResult>);
  private readonly paymentService = inject(PaymentService);
  private readonly transactionService = inject(TransactionService);
  readonly data = inject<CardPaymentDialogData>(MAT_DIALOG_DATA);

  private readonly paymentElementRef = viewChild.required<ElementRef<HTMLDivElement>>('paymentElement');

  readonly state = signal<State>('loading');
  readonly errorMessage = signal<string | null>(null);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private destroyed = false;

  readonly formattedAmount = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: this.data.currency
  }).format(this.data.amount);

  async ngOnInit(): Promise<void> {
    try {
      this.stripe = await this.paymentService.getStripe();
      if (!this.stripe) {
        this.state.set('unavailable');
        return;
      }

      const { clientSecret } = await firstValueFrom(this.transactionService.getPaymentIntent(this.data.transactionId));
      if (this.destroyed) return;

      this.elements = this.stripe.elements({ clientSecret, appearance: { theme: 'stripe' } });
      const paymentElement = this.elements.create('payment');
      paymentElement.mount(this.paymentElementRef().nativeElement);
      paymentElement.on('ready', () => this.state.set('ready'));
    } catch (err: unknown) {
      this.state.set('unavailable');
      this.errorMessage.set(this.backendMessage(err) ?? 'No se pudo iniciar el pago');
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  async pay(): Promise<void> {
    if (!this.stripe || !this.elements) return;

    this.state.set('paying');
    this.errorMessage.set(null);

    // redirect 'if_required': la mayoría de tarjetas (incluida la verificación 3D Secure) se
    // resuelven en un modal sin salir de la página; solo algunos métodos redirigen a return_url.
    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: {
        return_url: `${window.location.origin}/listings/${this.data.listingId}?payment=return`
      },
      redirect: 'if_required'
    });

    if (error) {
      this.state.set('ready');
      this.errorMessage.set(error.message ?? 'No se pudo completar el pago');
      return;
    }

    this.state.set('confirming');
    this.dialogRef.disableClose = true;
    this.dialogRef.close(await this.waitForWebhook());
  }

  close(): void {
    this.dialogRef.close();
  }

  private async waitForWebhook(): Promise<CardPaymentDialogResult> {
    for (let attempt = 0; attempt < POLL_ATTEMPTS && !this.destroyed; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      try {
        const purchases = await firstValueFrom(this.transactionService.getPurchases());
        const t: TransactionResponse | undefined = purchases.find((p) => p.id === this.data.transactionId);
        if (t && t.status !== 'awaiting_payment') {
          return 'paid';
        }
      } catch {
        // error puntual de red: se reintenta en la siguiente vuelta
      }
    }
    return 'processing';
  }

  private backendMessage(err: unknown): string | null {
    const message = (err as { error?: { message?: string } })?.error?.message;
    return typeof message === 'string' ? message : null;
  }
}

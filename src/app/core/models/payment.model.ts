export interface PaymentIntentResponse {
  clientSecret: string;
}

// Alta del usuario como vendedor en Stripe Connect
export interface ConnectStatus {
  hasAccount: boolean;
  payoutsEnabled: boolean;
}

export interface OnboardingLink {
  url: string;
}

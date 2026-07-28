import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: "2024-04-10", typescript: true });
  }
  return _stripe;
}

/** @deprecated Usar Cecabank o PayPal. Stripe solo se mantiene para webhooks legacy. */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    const s = getStripe();
    if (!s) throw new Error("STRIPE_SECRET_KEY no configurada — Stripe ya no se usa para pagos");
    return (s as any)[prop];
  },
});

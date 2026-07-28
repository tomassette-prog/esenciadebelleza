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

/** Proxy lazy — lanza error solo si se intenta usar sin clave configurada. */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    const s = getStripe();
    if (!s) throw new Error("STRIPE_SECRET_KEY no configurada");
    return (s as any)[prop];
  },
});

import Stripe from 'stripe';
import ENV from './env.js';

if (!ENV.STRIPE_API_KEY) {
  console.warn('⚠️ Stripe API Key is not set in Payment Service.');
}

const stripe = new Stripe(ENV.STRIPE_API_KEY);

export default stripe;


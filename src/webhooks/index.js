import express from 'express';
import { handleStripeWebhook } from './stripe.webhook.js';

export const mountWebhooks = (app) => {
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    handleStripeWebhook
  );
};


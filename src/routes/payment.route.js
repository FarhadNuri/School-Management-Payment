import { Router } from 'express';
import {
  createInvoice,
  getPayments,
  getPaymentById,
  updatePayment,
  createCheckout,
  confirmCheckoutSession,
  syncPayment,
  resendInvoice,
  cancelPayment,
} from '../controllers/payment.controller.js';

const router = Router();

router.post('/', createInvoice);
router.get('/', getPayments);
router.get('/:id', getPaymentById);
router.patch('/:id', updatePayment);
router.post('/:id/checkout', createCheckout);
router.get('/checkout-session/:sessionId', confirmCheckoutSession);
router.post('/:id/sync', syncPayment);
router.post('/:id/resend', resendInvoice);
router.post('/:id/cancel', cancelPayment);

export default router;


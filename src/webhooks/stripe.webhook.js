import prisma from '../config/prisma.js';
import stripe from '../config/stripe.js';
import ENV from '../config/env.js';
import stripeService from '../services/stripe.service.js';
import { publishEvent } from '../config/rabbitmq.js';
import { sendPaymentReceiptEmail } from '../utils/paymentEmails.js';
import { serializePayment } from '../utils/payment.helpers.js';

const findPaymentForInvoice = async (invoice) => {
  if (!invoice) return null;
  const paymentId = invoice.metadata?.paymentId;
  if (paymentId) {
    const byId = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (byId) return byId;
  }
  if (invoice.id) {
    return prisma.payment.findFirst({ where: { stripeInvoiceId: invoice.id } });
  }
  return null;
};

const findPaymentForCheckoutSession = async (session) => {
  if (!session) return null;
  const paymentId = session.metadata?.paymentId || session.client_reference_id;
  if (paymentId) {
    const byId = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (byId) return byId;
  }
  if (session.id) {
    return prisma.payment.findFirst({ where: { stripeCheckoutSessionId: session.id } });
  }
  return null;
};

const settleCheckoutSession = async (session) => {
  let payment = await findPaymentForCheckoutSession(session);

  const isPaid = session.payment_status === 'paid';
  const updatedData = {
    stripeCheckoutSessionId: session.id,
  };

  if (session.customer) {
    updatedData.stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
  }

  if (session.payment_intent) {
    const pi = session.payment_intent;
    updatedData.stripePaymentIntentId = typeof pi === 'string' ? pi : pi.id;
    if (typeof pi === 'object' && pi.latest_charge) {
      const ch = pi.latest_charge;
      updatedData.receiptUrl = ch.receipt_url || '';
      updatedData.transactionId = ch.id || '';
    }
  }

  if (isPaid) {
    updatedData.status = 'paid';
    updatedData.amountPaid = session.amount_total ? session.amount_total / 100 : (payment ? payment.amount : 0);
    updatedData.paidDate = new Date();
  }

  let updatedPayment;
  if (payment) {
    updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: updatedData,
    });
  } else {
    const paymentId = session.metadata?.paymentId || session.client_reference_id || session.id;
    updatedPayment = await prisma.payment.create({
      data: {
        id: paymentId,
        studentId: session.metadata?.studentId || 'unknown',
        guardianId: session.metadata?.guardianId || 'unknown',
        title: session.description || 'School Fee',
        amount: session.amount_total ? session.amount_total / 100 : 0,
        amountPaid: updatedData.amountPaid || 0,
        currency: (session.currency || 'USD').toUpperCase(),
        status: updatedData.status || 'pending',
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: updatedData.stripeCustomerId || '',
        stripePaymentIntentId: updatedData.stripePaymentIntentId || '',
        transactionId: updatedData.transactionId || '',
        receiptUrl: updatedData.receiptUrl || '',
        paidDate: updatedData.paidDate || null,
      },
    });
  }

  if (updatedPayment.status === 'paid' && updatedPayment.stripeInvoiceId) {
    try {
      await stripeService.markInvoicePaidOutOfBand(updatedPayment.stripeInvoiceId);
    } catch (err) {
      console.warn('[Webhook] out-of-band settle warning:', err.message);
    }
  }

  if (updatedPayment.status === 'paid') {
    try {
      await sendPaymentReceiptEmail(updatedPayment);
    } catch (e) {
      console.warn('[Webhook] receipt email failed:', e.message);
    }

    // Publish payment.completed event to RabbitMQ
    await publishEvent('payment.completed', serializePayment(updatedPayment)).catch(() => {});
  }
};

const settleInvoice = async (invoice) => {
  let payment = await findPaymentForInvoice(invoice);

  const updatedData = {
    stripeInvoiceId: invoice.id || '',
    status: invoice.status === 'paid' ? 'paid' : (payment ? payment.status : 'pending'),
    amountPaid: invoice.amount_paid ? invoice.amount_paid / 100 : (payment ? payment.amount : 0),
    paidDate: invoice.status === 'paid' ? new Date() : (payment ? payment.paidDate : null),
    stripeHostedInvoiceUrl: invoice.hosted_invoice_url || (payment ? payment.stripeHostedInvoiceUrl : ''),
    stripeInvoicePdf: invoice.invoice_pdf || (payment ? payment.stripeInvoicePdf : ''),
    receiptUrl: invoice.hosted_invoice_url || (payment ? payment.receiptUrl : ''),
  };

  let updatedPayment;
  if (payment) {
    updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: updatedData,
    });
  } else {
    const paymentId = invoice.metadata?.paymentId || invoice.id;
    updatedPayment = await prisma.payment.create({
      data: {
        id: paymentId,
        studentId: invoice.metadata?.studentId || 'unknown',
        guardianId: invoice.metadata?.guardianId || 'unknown',
        title: invoice.description || invoice.lines?.data?.[0]?.description || 'School Fee',
        amount: invoice.total ? invoice.total / 100 : 0,
        amountPaid: updatedData.amountPaid || 0,
        currency: (invoice.currency || 'USD').toUpperCase(),
        status: updatedData.status,
        stripeInvoiceId: invoice.id,
        stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || '',
        stripeHostedInvoiceUrl: updatedData.stripeHostedInvoiceUrl,
        stripeInvoicePdf: updatedData.stripeInvoicePdf,
        receiptUrl: updatedData.receiptUrl,
        paidDate: updatedData.paidDate,
      },
    });
  }

  if (updatedPayment.status === 'paid') {
    try {
      await sendPaymentReceiptEmail(updatedPayment);
    } catch (e) {
      console.warn('[Webhook] invoice receipt email failed:', e.message);
    }

    // Publish payment.completed event to RabbitMQ
    await publishEvent('payment.completed', serializePayment(updatedPayment)).catch(() => {});
  }
};

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = ENV.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await settleCheckoutSession(event.data.object);
        break;

      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        await settleInvoice(event.data.object);
        break;

      case 'invoice.voided': {
        const inv = event.data.object;
        const p = await findPaymentForInvoice(inv);
        if (p) {
          await prisma.payment.update({ where: { id: p.id }, data: { status: 'cancelled' } });
        }
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handling error:', err);
    return res.status(500).json({ error: err.message });
  }
};

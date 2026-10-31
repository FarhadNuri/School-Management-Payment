import mailer from './Mailer.js';
import { invoiceIssuedEmail, paymentReceiptEmail } from './emailTemplate.js';
import { PURPOSE_LABELS, METHOD_LABELS } from './payment.helpers.js';
import ENV from '../config/env.js';

export const formatMoney = (amount, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${(currency || 'USD').toUpperCase()} ${Number(amount) || 0}`;
  }
};

export const formatDateLabel = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const sendPaymentReceiptEmail = async (payment) => {
  if (!payment) return false;
  const guardianEmail = payment.guardianEmail || payment.guardian?.user?.email || payment.guardian?.email;
  if (!guardianEmail) return false;

  const guardianName = payment.guardianName || 'Guardian';
  const studentName = payment.studentName || 'Student';
  const feeType = PURPOSE_LABELS[payment.purpose] || payment.purpose || 'School fee';
  const amountLabel = formatMoney(payment.amountPaid || payment.amount, payment.currency);
  const paidDateLabel = formatDateLabel(payment.paidDate || new Date());
  const receiptNumber = payment.transactionId || payment.stripePaymentIntentId || payment.stripeInvoiceId || String(payment._id || '-');
  const paymentMethod = METHOD_LABELS[payment.method] || payment.method || 'Card';
  const receiptPdfUrl = payment.receiptUrl || payment.stripeInvoicePdf || '';
  const dashboardUrl = `${ENV.FRONTEND_URL}/dashboard/payments`;

  const { subject, text, html } = paymentReceiptEmail({
    firstName: guardianName,
    studentName,
    title: payment.title,
    feeType,
    amountLabel,
    paidDateLabel,
    receiptNumber,
    paymentMethod,
    receiptPdfUrl,
    dashboardUrl,
  });

  return mailer.sendEmail({ to: guardianEmail, subject, text, html });
};

export const sendInvoiceNotificationEmail = async (payment) => {
  if (!payment) return false;
  const guardianEmail = payment.guardianEmail || payment.guardian?.user?.email || payment.guardian?.email;
  if (!guardianEmail) return false;

  const guardianName = payment.guardianName || 'Guardian';
  const studentName = payment.studentName || 'Student';
  const feeType = PURPOSE_LABELS[payment.purpose] || payment.purpose || 'School fee';
  const amountLabel = formatMoney(payment.amount, payment.currency);
  const dueDateLabel = formatDateLabel(payment.dueDate);
  const payUrl = payment.stripeHostedInvoiceUrl || '';
  const dashboardUrl = `${ENV.FRONTEND_URL}/dashboard/payments`;

  const { subject, text, html } = invoiceIssuedEmail({
    firstName: guardianName,
    studentName,
    title: payment.title,
    feeType,
    amountLabel,
    dueDateLabel,
    payUrl,
    dashboardUrl,
  });

  return mailer.sendEmail({ to: guardianEmail, subject, text, html });
};


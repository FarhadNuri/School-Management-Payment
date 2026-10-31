import prisma from '../config/prisma.js';

const PURPOSES = [
  'tuition',
  'exam_fee',
  'transport',
  'uniform',
  'books',
  'hostel',
  'activity',
  'library',
  'other',
];

const METHODS = [
  'cash',
  'card',
  'bank_transfer',
  'mobile_money',
  'cheque',
  'stripe',
  'other',
];

const STATUSES = [
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_paid',
  'cancelled',
];

export { PURPOSES, METHODS, STATUSES };
export default prisma.payment;

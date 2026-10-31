import prisma from '../config/prisma.js';
import stripeService from '../services/stripe.service.js';
import { publishEvent } from '../config/rabbitmq.js';
import {
  serializePayment,
  resolvePurpose,
} from '../utils/payment.helpers.js';
import {
  sendInvoiceNotificationEmail,
  sendPaymentReceiptEmail,
} from '../utils/paymentEmails.js';

export const createInvoice = async (req, res) => {
  try {
    const {
      id,
      student,
      guardian,
      class: classId,
      studentName,
      guardianEmail,
      guardianName,
      title,
      feeType,
      purpose: rawPurpose,
      description,
      amount,
      dueDate,
      term,
      academicYear,
      notes,
    } = req.body;

    const studentId = String(student || '').trim();
    const guardianId = String(guardian || '').trim();

    if (!studentId || !guardianId) {
      return res.status(400).json({ error: 'Student and Guardian IDs are required' });
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    const resolvedPurpose = resolvePurpose(feeType || rawPurpose) || 'tuition';

    // 1. Create in Neon PostgreSQL via Prisma
    let payment = await prisma.payment.create({
      data: {
        ...(id ? { id: String(id) } : {}),
        studentId,
        guardianId,
        classId: classId ? String(classId) : null,
        studentName: studentName || '',
        guardianEmail: guardianEmail || '',
        guardianName: guardianName || '',
        title: title || 'School Fee Invoice',
        purpose: resolvedPurpose,
        description: description || '',
        amount: numAmount,
        dueDate: dueDate ? new Date(dueDate) : null,
        term: term || '',
        academicYear: academicYear || '',
        notes: notes || '',
        status: 'pending',
        method: 'stripe',
      },
    });

    // 2. Create Stripe Customer & Finalize Invoice if guardian email is present
    if (guardianEmail) {
      try {
        const customer = await stripeService.getOrCreateCustomer({
          guardianId,
          email: guardianEmail,
          name: guardianName,
        });

        const invoice = await stripeService.createAndFinalizeInvoice({
          customerId: customer.id,
          payment,
          studentName: studentName || 'Student',
        });

        const updatedFields = {
          stripeCustomerId: customer.id,
          stripeInvoiceId: invoice.id || '',
          stripeHostedInvoiceUrl: invoice.hosted_invoice_url || '',
          stripeInvoicePdf: invoice.invoice_pdf || '',
          status: invoice.status === 'paid' ? 'paid' : payment.status,
        };

        payment = await prisma.payment.update({
          where: { id: payment.id },
          data: updatedFields,
        });

        // Send email
        try {
          await sendInvoiceNotificationEmail(payment);
        } catch (emailErr) {
          console.warn('Failed to send invoice email:', emailErr.message);
        }
      } catch (stripeErr) {
        console.warn('Stripe invoice generation skipped or failed:', stripeErr.message);
      }
    }

    // Publish payment.created event to RabbitMQ
    await publishEvent('payment.created', serializePayment(payment)).catch(() => {});

    return res.status(201).json({
      message: 'Invoice created successfully',
      payment: serializePayment(payment),
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getPayments = async (req, res) => {
  try {
    const { student, guardian, class: classId, status, purpose, page = 1, limit = 50 } = req.query;
    const where = { isActive: true };

    if (student) where.studentId = String(student);
    if (guardian) where.guardianId = String(guardian);
    if (classId) where.classId = String(classId);
    if (status) where.status = String(status);
    if (purpose) where.purpose = String(purpose);

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.payment.count({ where }),
    ]);

    return res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      payments: payments.map(serializePayment),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getPaymentById = async (req, res) => {
  try {
    let payment = await prisma.payment.findFirst({
      where: { id: req.params.id, isActive: true },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Attempt Stripe sync if pending and has invoice
    if (payment.status !== 'paid' && (payment.stripeInvoiceId || payment.stripeCheckoutSessionId)) {
      try {
        if (payment.stripeInvoiceId) {
          const inv = await stripeService.retrieveInvoice(payment.stripeInvoiceId);
          if (inv && inv.status === 'paid') {
            payment = await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'paid',
                amountPaid: (inv.amount_paid ? inv.amount_paid / 100 : payment.amount),
                paidDate: new Date(),
                receiptUrl: inv.hosted_invoice_url || payment.receiptUrl,
                stripeInvoicePdf: inv.invoice_pdf || payment.stripeInvoicePdf,
              },
            });

            // Emit payment.completed event
            await publishEvent('payment.completed', serializePayment(payment)).catch(() => {});
          }
        }
      } catch (syncErr) {
        console.warn('Stripe sync error:', syncErr.message);
      }
    }

    return res.json({ payment: serializePayment(payment) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const updatePayment = async (req, res) => {
  try {
    const existing = await prisma.payment.findFirst({
      where: { id: req.params.id, isActive: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const { title, description, amount, status, notes, dueDate } = req.body;
    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (status !== undefined) updateData.status = status;

    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: updateData,
    });

    if (status === 'paid' && existing.status !== 'paid') {
      await publishEvent('payment.completed', serializePayment(payment)).catch(() => {});
    }

    return res.json({ message: 'Payment updated', payment: serializePayment(payment) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const createCheckout = async (req, res) => {
  try {
    let payment = await prisma.payment.findFirst({
      where: { id: req.params.id, isActive: true },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status === 'paid') {
      return res.status(400).json({ error: 'Invoice has already been paid' });
    }

    let customerId = payment.stripeCustomerId;
    if (!customerId && payment.guardianEmail) {
      const customer = await stripeService.getOrCreateCustomer({
        guardianId: payment.guardianId,
        email: payment.guardianEmail,
        name: payment.guardianName,
      });
      customerId = customer.id;
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripeService.createCheckoutSession({
      payment,
      customerId,
      studentName: payment.studentName || 'Student',
    });

    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    return res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      payment: serializePayment(payment),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const confirmCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await stripeService.retrieveCheckoutSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Checkout session not found on Stripe' });
    }

    const paymentId = session.client_reference_id || session.metadata?.paymentId;
    let payment = null;
    if (paymentId) {
      payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    }
    if (!payment) {
      payment = await prisma.payment.findFirst({ where: { stripeCheckoutSessionId: sessionId } });
    }

    if (!payment) {
      return res.status(404).json({ error: 'Associated payment not found' });
    }

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
      updatedData.amountPaid = session.amount_total ? session.amount_total / 100 : payment.amount;
      updatedData.paidDate = new Date();
    }

    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: updatedData,
    });

    if (payment.status === 'paid' && payment.stripeInvoiceId) {
      try {
        await stripeService.markInvoicePaidOutOfBand(payment.stripeInvoiceId);
      } catch (e) {
        console.warn('OutOfBand invoice settle warning:', e.message);
      }
    }

    if (payment.status === 'paid') {
      try {
        await sendPaymentReceiptEmail(payment);
      } catch (receiptErr) {
        console.warn('Receipt email error:', receiptErr.message);
      }

      // Publish event to RabbitMQ
      await publishEvent('payment.completed', serializePayment(payment)).catch(() => {});
    }

    return res.json({
      message: 'Checkout session confirmed',
      payment: serializePayment(payment),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const syncPayment = async (req, res) => {
  try {
    let payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (payment.stripeInvoiceId) {
      const invoice = await stripeService.retrieveInvoice(payment.stripeInvoiceId);
      if (invoice && invoice.status === 'paid') {
        payment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'paid',
            amountPaid: invoice.amount_paid ? invoice.amount_paid / 100 : payment.amount,
            paidDate: new Date(),
            receiptUrl: invoice.hosted_invoice_url || payment.receiptUrl,
            stripeInvoicePdf: invoice.invoice_pdf || payment.stripeInvoicePdf,
          },
        });

        // Publish event to RabbitMQ
        await publishEvent('payment.completed', serializePayment(payment)).catch(() => {});
      }
    }

    return res.json({
      message: 'Payment synced successfully',
      payment: serializePayment(payment),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const resendInvoice = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const sent = await sendInvoiceNotificationEmail(payment);
    return res.json({
      success: !!sent,
      message: sent ? 'Invoice notification sent' : 'Failed or skipped sending invoice',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const cancelPayment = async (req, res) => {
  try {
    let payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (payment.stripeInvoiceId) {
      try {
        await stripeService.voidInvoice(payment.stripeInvoiceId);
      } catch (e) {
        console.warn('Stripe void invoice warning:', e.message);
      }
    }

    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'cancelled' },
    });

    return res.json({
      message: 'Payment cancelled successfully',
      payment: serializePayment(payment),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

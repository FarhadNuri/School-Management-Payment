export const invoiceIssuedEmail = ({
  firstName,
  studentName,
  title,
  feeType,
  amountLabel,
  dueDateLabel,
  payUrl,
  dashboardUrl,
}) => {
  const safeName = firstName || 'Guardian';
  const safeStudent = studentName || 'your student';
  const safeTitle = title || 'School invoice';

  return {
    subject: `Invoice: ${safeTitle} for ${safeStudent}`,
    text: `Hello ${safeName},\n\nA new invoice has been issued for ${safeStudent}.\n\n${safeTitle}\nFee type: ${feeType || 'Fee'}\nAmount: ${amountLabel || ''}\nDue: ${dueDateLabel || 'See dashboard'}\n\nPay online: ${payUrl || dashboardUrl || ''}\n\n- School Management`,
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px;">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
        <h2 style="color:#1d4ed8;margin-top:0;">New Invoice for ${safeStudent}</h2>
        <p>Hello ${safeName}, an invoice has been generated for <strong>${safeStudent}</strong>.</p>
        <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:4px 0;"><strong>Invoice:</strong> ${safeTitle}</p>
          <p style="margin:4px 0;"><strong>Fee Type:</strong> ${feeType || 'Fee'}</p>
          <p style="margin:4px 0;"><strong>Amount:</strong> ${amountLabel || ''}</p>
          <p style="margin:4px 0;"><strong>Due Date:</strong> ${dueDateLabel || 'See dashboard'}</p>
        </div>
        ${payUrl ? `<div style="text-align:center;margin:24px 0;"><a href="${payUrl}" style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Pay Invoice Online</a></div>` : ''}
        ${dashboardUrl ? `<p style="font-size:12px;color:#64748b;text-align:center;">Or view your <a href="${dashboardUrl}">billing dashboard</a>.</p>` : ''}
      </div></body></html>`,
  };
};

export const paymentReceiptEmail = ({
  firstName,
  studentName,
  title,
  feeType,
  amountLabel,
  paidDateLabel,
  receiptNumber,
  paymentMethod,
  receiptPdfUrl,
  dashboardUrl,
}) => {
  const safeName = firstName || 'Guardian';
  const safeStudent = studentName || 'your student';
  const safeTitle = title || 'School fee';

  return {
    subject: `Receipt: ${safeTitle} - ${amountLabel || ''}`,
    text: `Hello ${safeName},\n\nYour payment of ${amountLabel} for ${safeStudent} was received successfully.\nReceipt #: ${receiptNumber || '-'}\nPaid on: ${paidDateLabel || 'Today'}\n\n- School Management`,
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px;">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
        <h2 style="color:#15803d;margin-top:0;">Payment Confirmed</h2>
        <p>Hello ${safeName}, your payment has been processed successfully.</p>
        <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:4px 0;"><strong>Student:</strong> ${safeStudent}</p>
          <p style="margin:4px 0;"><strong>Fee:</strong> ${safeTitle} (${feeType || 'Fee'})</p>
          <p style="margin:4px 0;"><strong>Amount Paid:</strong> <strong style="color:#15803d;">${amountLabel}</strong></p>
          <p style="margin:4px 0;"><strong>Date:</strong> ${paidDateLabel || 'Today'}</p>
          <p style="margin:4px 0;"><strong>Method:</strong> ${paymentMethod || 'Card'}</p>
          <p style="margin:4px 0;"><strong>Receipt #:</strong> ${receiptNumber || '-'}</p>
        </div>
        ${receiptPdfUrl ? `<p style="text-align:center;"><a href="${receiptPdfUrl}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;display:inline-block;">View Official Receipt</a></p>` : ''}
      </div></body></html>`,
  };
};


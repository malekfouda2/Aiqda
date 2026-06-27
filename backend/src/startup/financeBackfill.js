import Payment from '../modules/payments/payment.model.js';
import { generateEarningsForPayment } from '../modules/finance/earnings.service.js';

// Idempotent, EXPLICIT-ONLY backfill. NOT wired into server boot: running it turns historical
// successful subscription payments into instructor earning liability. Invoke deliberately
// (e.g. `node src/startup/financeBackfill.js` after connecting, or from an admin tooling script).
export const backfillFinanceEarnings = async () => {
  const payments = await Payment.find({
    subscription: { $ne: null },
    status: { $in: ['approved', 'captured'] },
  }).select('_id').lean();

  let processed = 0;
  for (const payment of payments) {
    const txn = await generateEarningsForPayment(payment._id);
    if (txn) processed += 1;
  }

  return { scanned: payments.length, processed };
};

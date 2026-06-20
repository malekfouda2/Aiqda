import * as paymentsService from './payments.service.js';

const getRequestOrigin = (req) => {
  const originHeader = req.get('origin');
  if (originHeader) {
    return originHeader.replace(/\/$/, '');
  }

  const refererHeader = req.get('referer');
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin.replace(/\/$/, '');
    } catch {
      return null;
    }
  }

  return null;
};

export const getTapCheckoutConfig = async (req, res) => {
  try {
    const config = paymentsService.getTapCheckoutConfig();
    res.json(config);
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
};

export const createTapSubscriptionCharge = async (req, res) => {
  try {
    const result = await paymentsService.createTapSubscriptionCharge(req.user.id, {
      subscriptionId: req.body.subscriptionId,
      tokenId: req.body.tokenId,
      useSavedPaymentMethod: req.body.useSavedPaymentMethod,
      checkoutMethod: req.body.checkoutMethod,
      phoneCountryCode: req.body.phoneCountryCode,
      phoneNumber: req.body.phoneNumber,
      checkoutDisclaimerAccepted: req.body.checkoutDisclaimerAccepted,
      frontendBaseUrl: getRequestOrigin(req),
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createTapBillingProfileSetupCharge = async (req, res) => {
  try {
    const result = await paymentsService.createTapBillingProfileSetupCharge(req.user.id, {
      tokenId: req.body.tokenId,
      checkoutMethod: req.body.checkoutMethod,
      phoneCountryCode: req.body.phoneCountryCode,
      phoneNumber: req.body.phoneNumber,
      checkoutDisclaimerAccepted: req.body.checkoutDisclaimerAccepted,
      frontendBaseUrl: getRequestOrigin(req),
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const syncTapChargeForUser = async (req, res) => {
  try {
    const payment = await paymentsService.syncTapChargeForUser(req.user.id, req.params.chargeId);
    res.json(payment);
  } catch (error) {
    const statusCode = error.message === 'Payment not found' ? 404 : 400;
    res.status(statusCode).json({ error: error.message });
  }
};

export const processTapWebhook = async (req, res) => {
  try {
    await paymentsService.processTapWebhook(req.body, req.headers.hashstring || req.headers.hash || '');
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getUserPayments = async (req, res) => {
  try {
    const payments = await paymentsService.getUserPayments(req.user.id);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const payments = await paymentsService.getAllPayments(req.query.status);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPaymentById = async (req, res) => {
  try {
    const payment = await paymentsService.getPaymentById(req.params.id, req.user);
    res.json(payment);
  } catch (error) {
    const statusCode = error.message === 'Access denied. Insufficient permissions.' ? 403 : 404;
    res.status(statusCode).json({ error: error.message });
  }
};

export const removePayment = async (req, res) => {
  try {
    await paymentsService.removePayment(req.params.id);
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    const statusCode = error.message === 'Payment not found' ? 404 : 400;
    res.status(statusCode).json({ error: error.message });
  }
};

export const refundPayment = async (req, res) => {
  try {
    const payment = await paymentsService.refundSuccessfulPayment(req.params.id, {
      reason: req.body.reason,
      refundedBy: req.user.id,
      amount: req.body.amount,
    });
    res.json(payment);
  } catch (error) {
    const statusCode = error.message === 'Payment not found' ? 404 : 400;
    res.status(statusCode).json({ error: error.message });
  }
};

export const removeTapBillingProfile = async (req, res) => {
  try {
    const billingProfile = await paymentsService.removeTapBillingProfile(req.user.id);
    res.json(billingProfile);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

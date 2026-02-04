import * as paymentsService from './payments.service.js';

export const submitPayment = async (req, res) => {
  try {
    const paymentData = {
      subscriptionId: req.body.subscriptionId,
      amount: req.body.amount,
      paymentReference: req.body.paymentReference,
      proofFile: req.file ? req.file.filename : null
    };
    const payment = await paymentsService.submitPayment(req.user.id, paymentData);
    res.status(201).json(payment);
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
    const payment = await paymentsService.getPaymentById(req.params.id);
    res.json(payment);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const approvePayment = async (req, res) => {
  try {
    const payment = await paymentsService.approvePayment(req.params.id, req.user.id);
    res.json(payment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const rejectPayment = async (req, res) => {
  try {
    const { reason } = req.body;
    const payment = await paymentsService.rejectPayment(req.params.id, req.user.id, reason);
    res.json(payment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getBankDetails = async (req, res) => {
  try {
    const bankDetails = paymentsService.getBankDetails();
    res.json(bankDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

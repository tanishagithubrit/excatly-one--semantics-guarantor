const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const PaymentRequest = require('../models/PaymentRequest');

const TTL_SECONDS = parseInt(process.env.TTL_SECONDS) || 30;

/**
 * POST /api/payments/initiate
 * Create a new payment request (idempotent)
 */
router.post('/initiate', async (req, res) => {
  try {
    const {
      amount,
      currency = 'USD',
      description,
      customerName,
      customerEmail,
      idempotencyKey
    } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!idempotencyKey) {
      return res.status(400).json({ error: 'idempotencyKey is required' });
    }

    // ✅ IDEMPOTENCY CHECK
    const existing = await PaymentRequest.findOne({ idempotencyKey });

    if (existing) {
      return res.status(200).json({
        message: 'Duplicate request (idempotent)',
        ...existing.toObject()
      });
    }

    // ⚠️ (Optional) keep your "one active request" rule
    const destroyed = await PaymentRequest.updateMany(
      { status: 'pending' },
      { $set: { status: 'destroyed' } }
    );

    if (destroyed.modifiedCount > 0) {
      console.log(`[Guarantor] Destroyed ${destroyed.modifiedCount} old pending request(s)`);
    }

    const id = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TTL_SECONDS * 1000);

    const paymentRequest = new PaymentRequest({
      id,
      idempotencyKey, // ✅ NEW FIELD
      metadata: { amount, currency, description, customerName, customerEmail },
      timestamp: now,
      expiresAt,
      ttlSeconds: TTL_SECONDS,
      status: 'pending'
    });

    await paymentRequest.save();

    console.log(`[Payment] Created: ${id}`);

    res.status(201).json({
      message: 'Payment request generated',
      ...paymentRequest.toObject(),
      destroyedPrevious: destroyed.modifiedCount
    });

  } catch (err) {
    console.error('[Payment] Initiate error:', err.message);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});


/**
 * POST /api/payments/confirm/:id
 * Confirm payment (EXACTLY-ONCE GUARANTEED)
 */
router.post('/confirm/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const now = new Date();

    // ✅ ATOMIC UPDATE (CORE FIX)
    const payment = await PaymentRequest.findOneAndUpdate(
      {
        id,
        status: 'pending',
        expiresAt: { $gt: now } // not expired
      },
      {
        $set: { status: 'success' }
      },
      { new: true }
    );

    // ❌ If update failed → handle safely
    if (!payment) {
      const existing = await PaymentRequest.findOne({ id });

      if (!existing) {
        return res.status(404).json({ error: 'Payment request not found' });
      }

      if (existing.status === 'success') {
        return res.status(200).json({
          message: 'Already processed (idempotent)',
          status: 'success',
          id
        });
      }

      if (existing.expiresAt < now) {
        // mark destroyed if expired
        existing.status = 'destroyed';
        await existing.save();

        return res.status(410).json({
          error: 'TTL expired. Request destroyed. Please retry.'
        });
      }

      return res.status(400).json({
        error: 'Invalid state transition'
      });
    }

    console.log(`[Payment] Success: ${id}`);

    res.json({
      message: 'Payment successful!',
      status: 'success',
      id,
      metadata: payment.metadata
    });

  } catch (err) {
    console.error('[Payment] Confirm error:', err.message);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});


/**
 * GET /api/payments
 */
router.get('/', async (req, res) => {
  try {
    const payments = await PaymentRequest
      .find()
      .sort({ timestamp: -1 })
      .limit(50);

    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});


/**
 * GET /api/payments/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const payment = await PaymentRequest.findOne({ id: req.params.id });

    if (!payment) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});


/**
 * DELETE /api/payments/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const payment = await PaymentRequest.findOne({ id: req.params.id });

    if (!payment) {
      return res.status(404).json({ error: 'Not found' });
    }

    payment.status = 'destroyed';
    await payment.save();

    res.json({
      message: 'Payment request destroyed',
      id: req.params.id
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to destroy payment' });
  }
});

module.exports = router;
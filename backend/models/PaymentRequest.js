const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  metadata: {
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    description: { type: String },
    customerName: { type: String },
    customerEmail: { type: String }
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'expired', 'destroyed'],
    default: 'pending'
  },
  ttlSeconds: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);

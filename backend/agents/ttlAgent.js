const PaymentRequest = require('../models/PaymentRequest');

let agentInterval = null;

async function runTTLCheck() {
  try {
    const now = new Date();
    // Find all pending requests that have expired
    const expired = await PaymentRequest.find({
      status: 'pending',
      expiresAt: { $lte: now }
    });

    for (const req of expired) {
      req.status = 'destroyed';
      await req.save();
      console.log(`[TTL Agent] Destroyed expired request: ${req.id}`);
    }

    if (expired.length > 0) {
      console.log(`[TTL Agent] Cleaned up ${expired.length} expired request(s)`);
    }
  } catch (err) {
    console.error('[TTL Agent] Error during TTL check:', err.message);
  }
}

function startTTLAgent(intervalMs = 5000) {
  console.log('[TTL Agent] Started — checking every', intervalMs / 1000, 'seconds');
  agentInterval = setInterval(runTTLCheck, intervalMs);
}

function stopTTLAgent() {
  if (agentInterval) clearInterval(agentInterval);
}

module.exports = { startTTLAgent, stopTTLAgent, runTTLCheck };

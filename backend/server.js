require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit'); // ✅ added
const paymentRoutes = require('./routes/payment');

const app = express();
app.set('trust proxy', 1); // ✅ ADD THIS LINE

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Rate Limiting (production touch)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20
});
app.use(limiter);

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch(err => console.error('MongoDB connection error:', err));

// ✅ Routes
app.use('/api/payments', paymentRoutes);

// ✅ Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
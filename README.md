# Exactly Once Semantics Guarantor

A MERN stack application demonstrating **exactly-once payment processing** using a TTL Agent that destroys unconfirmed payment requests after a configurable time window.

## Architecture

```
[Pay Button] → Request (id, metadata, timestamp) → MongoDB Store
                                                          ↑
                                              TTL Agent monitors
                                                    ↙         ↘
                                     Confirm in time      No response in time
                                   [Payment Successful]   [Request Destroyed]
```

## How It Works

1. **Pay Button** triggers a new payment request with a unique `id`, `metadata` (amount, currency, customer info), and `timestamp`
2. **MongoDB** stores the request with a TTL (`expiresAt` field)
3. **TTL Agent** runs every 5 seconds, finds expired pending requests and marks them as `destroyed`
4. If the payment gateway **confirms** within the TTL window → `success`
5. If not → request is `destroyed` — guaranteeing **exactly-once** processing

## Setup

### Prerequisites
- Node.js >= 16
- MongoDB running locally on port 27017

### Backend
```bash
cd backend
npm install
# Edit .env if needed (MONGO_URI, TTL_SECONDS)
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000

## Environment Variables (backend/.env)
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 5000 | Backend port |
| MONGO_URI | mongodb://localhost:27017/exactlyonce | MongoDB connection string |
| TTL_SECONDS | 30 | Seconds before a pending request is destroyed |

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/payments/initiate | Create a payment request |
| POST | /api/payments/confirm/:id | Confirm/process a payment |
| GET | /api/payments | List all payment requests |
| GET | /api/payments/:id | Get a single request |
| DELETE | /api/payments/:id | Manually destroy a request |

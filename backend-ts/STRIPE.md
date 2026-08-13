# Stripe Payment Integration

## Setup Instructions

### 1. Get Stripe Test Keys

1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Navigate to **Developers → API Keys**
3. Copy your **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`)

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
LEGALMIND_STRIPE_PUBLISHABLE_KEY=pk_test_...
LEGALMIND_STRIPE_SECRET_KEY=sk_test_...
LEGALMIND_STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Add Webhook Endpoint in Stripe Dashboard

1. Go to **Developers → Webhooks** in the Stripe Dashboard
2. Click **Add endpoint**
3. Set the endpoint URL: `https://your-domain.com/api/v1/payments/webhook`
   - For local development: `https://your-ngrok-url.ngrok.io/api/v1/payments/webhook`
4. Select these events to listen to:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Click **Add endpoint**
6. Copy the **Signing secret** (`whsec_...`) and add it to your `.env` as `LEGALMIND_STRIPE_WEBHOOK_SECRET`

### 4. Test Card Numbers

| Card Number | Behavior |
|-------------|----------|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 0002` | Payment is declined |
| `4000 0000 0000 3220` | Requires 3D Secure authentication |

Use any future expiration date (e.g., `12/34`), any 3-digit CVC, and any postal code.

### 5. Run Locally with ngrok for Webhooks

```bash
# Install ngrok (if not installed)
# Windows: scoop install ngrok
# macOS: brew install ngrok
# Linux: snap install ngrok

# Start your backend
npm run dev

# In a separate terminal, expose your local server
ngrok http 3000
```

Copy the `https://xxx.ngrok.io` URL and:
1. Update your webhook endpoint in the Stripe Dashboard
2. Update `LEGALMIND_CORS_ORIGINS` in `.env` to include the ngrok URL

### 6. API Endpoints

#### Create Checkout Session (Authenticated)
```
POST /api/v1/payments/checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "planId": "pro-monthly",
  "amount": 2999,
  "currency": "usd",
  "description": "Pro Plan - Monthly"
}
```

#### Get Checkout Session Status (Authenticated)
```
GET /api/v1/payments/checkout/status?session_id=cs_test_...
Authorization: Bearer <token>
```

#### Payment History (Authenticated)
```
GET /api/v1/payments/history?page=1&limit=10&status=succeeded
Authorization: Bearer <token>
```

#### Webhook (No Auth - Stripe Signature Verified)
```
POST /api/v1/payments/webhook
Stripe-Signature: <signature>
```

## Security Notes

- **Webhook signature verification**: The webhook endpoint verifies Stripe signatures using `stripe.webhooks.constructEvent()`. Never trust raw requests from the frontend alone.
- **Environment variables**: All secrets are loaded from `.env` via Zod-validated `env` schema. Never hardcode keys.
- **Idempotency**: Duplicate webhook events for the same session or payment intent are handled gracefully — updating the same record instead of creating duplicates.
- **Rate limiting**: Checkout creation is rate-limited (20 requests per 15 minutes per IP).
- **Input validation**: All request bodies and query parameters are validated with Zod schemas.

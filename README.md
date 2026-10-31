# Sunrise Model School - Payment Microservice

A high-reliability, event-driven Payment and Invoicing microservice designed for the School Management platform. Built with **Node.js**, **Express**, **Prisma ORM**, **Neon PostgreSQL**, **Stripe**, and **RabbitMQ (CloudAMQP)**.

---

## Architecture Highlights

- **Polyglot Persistence**: Operates with its own isolated **PostgreSQL** database on **Neon**, enforcing ACID compliance and decimal precision for financial ledgers independent of the core monolith.
- **Event-Driven Architecture (EDA)**: Asynchronously publishes `payment.completed` and `payment.created` events to a RabbitMQ topic exchange (`school.events`) for loose coupling and eventual consistency.
- **Stripe Invoicing & Checkout**: Manages the complete Stripe customer lifecycle, invoice finalization, and Hosted Checkout sessions.
- **Webhook Reconciliation**: Cryptographically verifies raw Stripe signatures (`invoice.paid`, `checkout.session.completed`) with automatic out-of-band invoice settlement.
- **Automated Notifications**: Dispatches transactional HTML invoice notifications and receipt emails via SMTP/Nodemailer.

---

## Architecture & Data Flow

<p align="center">
  <img src="./public/Diagram.jpg" alt="Architecture & Data Flow" width="100%">
</p>

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime & Framework** | Node.js (ES Modules), Express.js |
| **Database & ORM** | Neon Serverless PostgreSQL, Prisma ORM |
| **Message Broker** | RabbitMQ / CloudAMQP (`amqplib`) |
| **Payment Gateway** | Stripe API SDK (Invoices, Checkout, Webhooks) |
| **Mailing** | Nodemailer (Gmail / SMTP) |

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the service root:
```env
PORT=5001
NODE_ENV=development

# Database (Neon Serverless PostgreSQL)
DATABASE_URL="postgresql://user:password@ep-xyz.aws.neon.tech/neondb?sslmode=require"

# Message Broker (CloudAMQP / RabbitMQ)
RABBITMQ_URL="amqps://user:password@hostname.cloudamqp.com/vhost"

# Stripe Configuration
STRIPE_API_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend & Core Monolith URLs
FRONTEND_URL=http://localhost:5173
ADMIN_URL=http://localhost:5174
MAIN_APP_URL=http://localhost:5000

# Email Delivery
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM_NAME="School Billing Department"
```

### 3. Sync Database Schema
```bash
npx prisma generate
npx prisma db push
```

### 4. Run the Service
```bash
# Development
npm run dev

# Production
npm start
```

---

## Core API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status, uptime, and port verification |
| `POST` | `/api/payments` | Create invoice in Neon DB, finalize Stripe invoice, publish event |
| `GET` | `/api/payments` | Paginated query (filters: `student`, `guardian`, `status`, `purpose`) |
| `GET` | `/api/payments/:id` | Retrieve invoice by ID with on-demand Stripe reconciliation |
| `PATCH` | `/api/payments/:id` | Update invoice details (amount, status, due date, notes) |
| `POST` | `/api/payments/:id/checkout` | Generate Stripe Checkout session URL |
| `GET` | `/api/payments/checkout-session/:sessionId` | Verify checkout session & emit `payment.completed` event |
| `POST` | `/api/payments/:id/sync` | Force manual synchronization with Stripe ledger |
| `POST` | `/api/payments/:id/resend` | Re-trigger invoice notification email to guardian |
| `POST` | `/api/payments/:id/cancel` | Void remote Stripe invoice and mark status as cancelled |
| `POST` | `/api/webhooks/stripe` | Raw webhook endpoint for Stripe event settlement |

---

## Message Queue Events (RabbitMQ)

- **Exchange**: `school.events` (`topic`, durable)
- **Routing Keys**:
  - `payment.completed`: Dispatched when an invoice or checkout session is settled. Consumed by the core backend to unlock student enrollments and update academic standing.
  - `payment.created`: Dispatched upon initial invoice generation.


---
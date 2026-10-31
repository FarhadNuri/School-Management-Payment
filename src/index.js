import express from 'express';
import cors from 'cors';
import ENV from './config/env.js';
import connectDB from './config/database.js';
import { connectRabbitMQ } from './config/rabbitmq.js';
import { mountWebhooks } from './webhooks/index.js';
import paymentRoutes from './routes/payment.route.js';

const app = express();

app.use(cors({
  origin: '*',
  credentials: true,
}));

// Mount inbound webhook route before express.json() for Stripe raw signature verification
mountWebhooks(app);

app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    service: 'Payment & Invoicing Microservice',
    status: 'OK',
    uptime: process.uptime(),
    port: ENV.PORT,
    timestamp: new Date().toISOString(),
  });
});

// Mount Payment domain routes
app.use('/api/payments', paymentRoutes);

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[PaymentService Error]', err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const startServer = async () => {
  try {
    await connectDB();
    await connectRabbitMQ().catch((err) => {
      console.warn('⚠️ RabbitMQ connection warning:', err.message);
    });
    app.listen(ENV.PORT, () => {
      console.log(`🚀 Payment Microservice running on port ${ENV.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Payment Service:', error);
    process.exit(1);
  }
};

startServer();


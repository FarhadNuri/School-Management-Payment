import dotenv from 'dotenv';
dotenv.config();

const ENV = {
  PORT: process.env.PORT || 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  ADMIN_URL: process.env.ADMIN_URL || 'http://localhost:5174',
  MAIN_APP_URL: process.env.MAIN_APP_URL || 'http://localhost:5000',
  STRIPE_API_KEY: process.env.STRIPE_API_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  DATABASE_URL: process.env.DATABASE_URL,
  RABBITMQ_URL: process.env.RABBITMQ_URL,
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'School Payment Service',
};

export default ENV;


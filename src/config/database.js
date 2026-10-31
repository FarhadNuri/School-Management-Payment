import prisma from './prisma.js';

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('💳 [Payment Service] Neon PostgreSQL (Prisma) Connected Successfully');
    return prisma;
  } catch (error) {
    console.error('❌ [Payment Service] Neon PostgreSQL Connection Error:', error.message);
    process.exit(1);
  }
};

export default connectDB;

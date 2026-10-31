import amqp from 'amqplib';

const EXCHANGE_NAME = 'school.events';
let connection = null;
let channel = null;
let isConnecting = false;

export const connectRabbitMQ = async () => {
  if (channel) return channel;
  if (isConnecting) return null;

  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.warn('⚠️ [Payment-RabbitMQ] RABBITMQ_URL not configured. Messaging disabled.');
    return null;
  }

  isConnecting = true;
  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    connection.on('error', (err) => {
      console.error('❌ [Payment-RabbitMQ] Connection error:', err.message);
      channel = null;
      connection = null;
    });

    connection.on('close', () => {
      console.warn('⚠️ [Payment-RabbitMQ] Connection closed. Reconnecting in 5s...');
      channel = null;
      connection = null;
      setTimeout(connectRabbitMQ, 5000);
    });

    console.log('🐇 [Payment-RabbitMQ] Connected to CloudAMQP successfully');
    isConnecting = false;
    return channel;
  } catch (err) {
    console.error('❌ [Payment-RabbitMQ] Failed to connect:', err.message);
    isConnecting = false;
    setTimeout(connectRabbitMQ, 5000);
    return null;
  }
};

export const publishEvent = async (routingKey, data) => {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }

    if (!channel) {
      console.warn(`⚠️ [Payment-RabbitMQ] Channel not ready. Dropping event: ${routingKey}`);
      return false;
    }

    const payload = {
      event: routingKey,
      timestamp: new Date().toISOString(),
      service: 'payment-service',
      data,
    };

    const buffer = Buffer.from(JSON.stringify(payload));
    const published = channel.publish(EXCHANGE_NAME, routingKey, buffer, {
      persistent: true,
      contentType: 'application/json',
    });

    console.log(`📤 [Payment-RabbitMQ] Published event: ${routingKey}`);
    return published;
  } catch (error) {
    console.error(`❌ [Payment-RabbitMQ] Error publishing event ${routingKey}:`, error.message);
    return false;
  }
};

export default {
  connectRabbitMQ,
  publishEvent,
};


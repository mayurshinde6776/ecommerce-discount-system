import { createApp } from './app';
import { config } from './config';

const app = createApp();

const server = app.listen(config.port, () => {
  console.info(`🚀 [${config.app.name}] Server running on http://localhost:${config.port}`);
  console.info(`   Environment : ${config.env}`);
  console.info(`   Version     : ${config.app.version}`);
  console.info(`   Health check: http://localhost:${config.port}/health`);
});

/**
 * Graceful shutdown — allows in-flight requests to complete
 * before the process exits.
 */
const gracefulShutdown = (signal: string): void => {
  console.info(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  server.close((err) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }

    console.info('✅ Server closed successfully.');
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

export default server;

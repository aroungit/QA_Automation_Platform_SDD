import { createApp } from './app.js';
import { getConfig } from './config.js';

async function main() {
  const config = getConfig();
  const { app, store } = createApp({ config });

  // Initialize storage directories (§3.7)
  await store.init();

  const server = app.listen(config.server.port, config.server.host, () => {
    console.log(
      `[QA_Automation_Platform_Agent] Server listening on http://${config.server.host}:${config.server.port}`,
    );
    console.log(`[QA_Automation_Platform_Agent] Environment: ${config.env}`);
    console.log(
      `[QA_Automation_Platform_Agent] Default LLM Provider: ${config.llm.defaultProvider}`,
    );
    console.log(`[QA_Automation_Platform_Agent] Storage specs: ${config.storage.specsDir}`);
  });

  const shutdown = () => {
    console.log('[QA_Automation_Platform_Agent] Shutting down gracefully...');
    server.close(() => {
      console.log('[QA_Automation_Platform_Agent] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[QA_Automation_Platform_Agent] Startup failure:', err);
  process.exit(1);
});

import { FireproofBackend } from './fireproof-backend';

const PORT = parseInt(process.env.FIREPROOF_SERVER_PORT || process.env.PORT || '3001');

async function main() {
  const backend = new FireproofBackend();
  await backend.initialize();
  await backend.start(PORT);
}

main().catch((err) => {
  console.error('❌ Server startup error:', err);
  process.exit(1);
});

const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const seedAdmin = require('./scripts/seedAdmin');
const DailyRecord = require('./models/DailyRecord');
async function migrateDailyRecordIndex() {
  // Older builds enforced one record per worker/day. Remove that unique index so entries can accumulate.
  try {
    const indexes = await DailyRecord.collection.indexes();
    for (const index of indexes) {
      if (index.unique && index.key?.worker === 1 && index.key?.businessDate === 1) {
        await DailyRecord.collection.dropIndex(index.name);
        console.log('Removed legacy unique worker/date index; multiple daily entries are enabled.');
      }
    }
  } catch (error) {
    if (error.codeName !== 'NamespaceNotFound' && error.code !== 26) throw error;
  }
}
async function start() {
  await connectDB(env.MONGODB_URI);
  await migrateDailyRecordIndex();
  await seedAdmin();
  const server = app.listen(env.PORT, () => console.log(`BloomVoice server listening on port ${env.PORT}`));
  const shutdown = async () => { server.close(() => process.exit(0)); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
start().catch(err => { console.error('Startup failed:', err.message); process.exit(1); });

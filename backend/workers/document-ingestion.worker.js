require('dotenv').config();

const { Worker } = require('bullmq');
const connectDatabase = require('../config/db');
const { connection } = require('../config/redis');
const Document = require('../models/document.model');
const vectors = require('../services/qdrant.service');
const { ingestDocument } = require('../services/ingestion.service');
const { parseConcurrency } = require('../config/ingestion');

async function start() {
  const concurrency = parseConcurrency(process.env.INGESTION_CONCURRENCY);
  await connectDatabase();
  const worker = new Worker('document-ingestion', async (job) => {
    await ingestDocument(job.data.documentId);
  }, { connection, concurrency });

  worker.on('failed', async (job, error) => {
    console.error(`Ingestion job ${job?.id} failed (attempt ${job?.attemptsMade}):`, error.message);
    if (!job || (!error.nonRetryable && job.attemptsMade < (job.opts.attempts || 1))) return;
    const documentId = job.data.documentId;
    await Promise.allSettled([
      Document.updateOne({ _id: documentId }, {
        $set: {
          status: 'failed',
          processingError: error.statusCode && error.statusCode < 500
            ? error.message
            : 'Document processing failed after multiple attempts. Please retry by uploading the PDF again.',
        },
      }),
      vectors.deleteDocument(documentId),
    ]);
  });

  worker.on('error', (error) => console.error('Ingestion worker error:', error));
  console.log(`Document ingestion worker is running with concurrency ${concurrency}.`);

  const shutdown = async () => {
    await worker.close();
    await connection.quit();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Could not start document ingestion worker:', error);
  process.exit(1);
});

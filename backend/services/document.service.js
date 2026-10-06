const Document = require('../models/document.model');
const Chat = require('../models/chat.model');
const pdf = require('./pdf.service');
const cloudinary = require('./cloudinary.service');
const embedding = require('./embedding.service');
const vectors = require('./qdrant.service');

exports.create = async (file) => {
  if (!file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    const error = new Error('The uploaded file is not a valid PDF.');
    error.statusCode = 400;
    throw error;
  }
  const remote = await cloudinary.uploadPdf(file.buffer, file.originalname);
  let document;
  try {
    document = await Document.create({
      name: file.originalname, originalName: file.originalname, mimeType: file.mimetype,
      size: file.size, cloudinaryUrl: remote.secure_url, cloudinaryPublicId: remote.public_id,
      cloudinaryResourceType: remote.resource_type || 'raw', status: 'processing',
    });
    const { pageCount, chunks } = await pdf.extractAndChunk(file.buffer);
    const embeddings = [];
    for (const chunk of chunks) embeddings.push(await embedding.embed(chunk));
    await vectors.storeChunks(document.id, chunks, embeddings);
    document.pageCount = pageCount;
    document.chunkCount = chunks.length;
    document.status = 'ready';
    await document.save();
    return document;
  } catch (error) {
    if (document) {
      document.status = 'failed';
      document.processingError = error.statusCode && error.statusCode < 500
        ? error.message
        : 'Document processing failed. Please remove it and try uploading again.';
      await Promise.allSettled([vectors.deleteDocument(document.id), document.save()]);
    } else {
      await cloudinary.deletePdf(remote.public_id, remote.resource_type || 'raw').catch(() => {});
    }
    throw error;
  }
};

exports.remove = async (document) => {
  const results = await Promise.allSettled([
    cloudinary.deletePdf(document.cloudinaryPublicId, document.cloudinaryResourceType),
    vectors.deleteDocument(document.id),
    Chat.deleteMany({ documentId: document.id }),
  ]);
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length) throw new Error(`Cleanup failed for ${failures.length} associated resource(s). Retry deletion.`);
  await Document.findByIdAndDelete(document.id);
};

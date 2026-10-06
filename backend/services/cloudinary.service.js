const cloudinary = require('../config/cloudinary');

exports.uploadPdf = (buffer, originalName) => new Promise((resolve, reject) => {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.pdf$/i, '');
  const stream = cloudinary.uploader.upload_stream({
    resource_type: 'raw', folder: process.env.CLOUDINARY_FOLDER || 'papertrail',
    public_id: `${Date.now()}-${safeName}.pdf`, format: 'pdf',
  }, (error, result) => error ? reject(error) : resolve(result));
  stream.end(buffer);
});

exports.deletePdf = (publicId, resourceType = 'raw') => cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });

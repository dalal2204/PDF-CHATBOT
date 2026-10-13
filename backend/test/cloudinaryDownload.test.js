const test = require('node:test');
const assert = require('node:assert/strict');
const { UnrecoverableError } = require('bullmq');

process.env.CLOUDINARY_CLOUD_NAME = 'unit-test-cloud';
process.env.CLOUDINARY_API_KEY = 'unit-test-key';
process.env.CLOUDINARY_API_SECRET = 'unit-test-secret';

const cloudinary = require('../services/cloudinary.service');

test('resolves delivery type from saved metadata or the Cloudinary URL for old records', () => {
  assert.equal(cloudinary.resolveDeliveryType({ cloudinaryDeliveryType: 'authenticated' }), 'authenticated');
  assert.equal(cloudinary.resolveDeliveryType({ cloudinaryUrl: 'https://res.cloudinary.com/demo/raw/private/v123/file.pdf' }), 'private');
  assert.equal(cloudinary.resolveDeliveryType({ cloudinaryUrl: 'https://res.cloudinary.com/demo/raw/upload/v123/file.pdf' }), 'upload');
  assert.equal(cloudinary.resolveDeliveryType({ cloudinaryUrl: 'not-a-cloudinary-url' }), 'upload');
});

test('downloads raw PDFs using an expiring signed Cloudinary API URL', async () => {
  const originalFetch = global.fetch;
  let requestedUrl;
  let cancelled = false;
  global.fetch = async (url, options) => {
    requestedUrl = new URL(url);
    assert.ok(options.signal);
    return {
      ok: true,
      body: { cancel: async () => { cancelled = true; } },
      arrayBuffer: async () => Uint8Array.from([37, 80, 68, 70]).buffer,
    };
  };

  try {
    const buffer = await cloudinary.downloadPdf({
      cloudinaryPublicId: 'papertrail/document.pdf',
      cloudinaryResourceType: 'raw',
      cloudinaryDeliveryType: 'authenticated',
    });
    assert.deepEqual([...buffer], [37, 80, 68, 70]);
    assert.match(requestedUrl.pathname, /\/raw\/download$/);
    assert.equal(requestedUrl.searchParams.get('type'), 'authenticated');
    assert.equal(requestedUrl.searchParams.get('public_id'), 'papertrail/document.pdf');
    assert.ok(Number(requestedUrl.searchParams.get('expires_at')) > Math.floor(Date.now() / 1000));
    assert.ok(requestedUrl.searchParams.has('signature'));
    assert.ok(!requestedUrl.href.includes(process.env.CLOUDINARY_API_SECRET));
    assert.equal(cancelled, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('does not retry persistent Cloudinary authorization failures and releases the response body', async () => {
  const originalFetch = global.fetch;
  let cancelled = false;
  global.fetch = async () => ({
    ok: false,
    status: 401,
    body: { cancel: async () => { cancelled = true; } },
  });

  try {
    await assert.rejects(
      cloudinary.downloadPdf({ cloudinaryPublicId: 'papertrail/document.pdf', cloudinaryUrl: '/raw/upload/file.pdf' }),
      (error) => {
        assert.equal(error.statusCode, 401);
        assert.equal(error.nonRetryable, true);
        assert.ok(error instanceof UnrecoverableError);
        assert.match(error.message, /HTTP 401/);
        assert.ok(!error.message.includes(process.env.CLOUDINARY_API_SECRET));
        return true;
      },
    );
    assert.equal(cancelled, true);
  } finally {
    global.fetch = originalFetch;
  }
});

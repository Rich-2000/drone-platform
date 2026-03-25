// api/sign-upload.js
// POST /api/sign-upload
// Body JSON: { mission, region, droneId, type }
//
// Returns a signed upload URL so the browser can upload DIRECTLY to Cloudinary
// without the file going through the Vercel serverless function.
// This avoids Vercel's 4.5 MB body size limit for serverless functions on the hobby plan.
//
// The browser then POSTs directly to:
//   https://api.cloudinary.com/v1_1/<cloud>/image/upload
// with the signature and params returned here.

const { cloudinary, DRONE_FOLDER, setCorsHeaders } = require('./_cloudinary');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed — use POST' });

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (_) {}

  const {
    mission = '',
    region  = '',
    droneId = '',
    type    = 'rgb',
    lat     = '',
    lon     = '',
    alt     = '',
    notes   = '',
    captureTime = '',
  } = body;

  try {
    const safe      = s => (s || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const ts        = Date.now();
    const publicId  = `${DRONE_FOLDER}/${safe(mission) || 'unnamed'}_${safe(droneId) || 'unknown'}_${ts}`;
    const timestamp = Math.round(ts / 1000);

    const contextStr = [
      `mission=${mission}`,
      `region=${region}`,
      `droneId=${droneId}`,
      `type=${type}`,
      `lat=${lat}`,
      `lon=${lon}`,
      `alt=${alt}`,
      `notes=${(notes || '').slice(0, 200)}`,
      `captureTime=${captureTime}`,
    ].join('|');

    const paramsToSign = {
      folder:    DRONE_FOLDER,
      public_id: publicId,
      timestamp,
      context:   contextStr,
      tags:      ['naimos', 'drone', type, region.replace(/\s+/g, '-').toLowerCase()].filter(Boolean).join(','),
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return res.json({
      uploadUrl:  `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      apiKey:     process.env.CLOUDINARY_API_KEY,
      signature,
      timestamp,
      publicId,
      folder:     DRONE_FOLDER,
      context:    contextStr,
      tags:       paramsToSign.tags,
    });
  } catch (err) {
    console.error('[sign-upload] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
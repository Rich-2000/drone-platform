// api/upload.js
// POST /api/upload  — multipart/form-data image upload → Cloudinary
//
// Fields:
//   image       (file)   — required
//   mission     (string) — NAIMOS mission ID
//   region      (string) — Ghana region name
//   droneId     (string) — drone unit ID
//   type        (string) — rgb | thermal | multispectral | ndvi | night | sar
//   lat         (number)
//   lon         (number)
//   alt         (number) — altitude in metres AGL
//   notes       (string)
//   captureTime (string) — ISO datetime
//
// Vercel serverless functions do NOT support express multipart middleware,
// so we use busboy to parse the raw request stream directly.

const { Readable }   = require('stream');
const busboy         = require('busboy');
const { cloudinary, DRONE_FOLDER, buildImageObj, setCorsHeaders } = require('./_cloudinary');

// Vercel: disable default body parsing so we get the raw stream
module.exports.config = {
  api: { bodyParser: false },
};

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed — use POST' });

  try {
    const { fields, fileBuffer, mimeType, fileName } = await parseMultipart(req);

    if (!fileBuffer || !fileBuffer.length) {
      return res.status(400).json({ error: 'No image file provided. Send as form field named "image".' });
    }

    const {
      mission     = '',
      region      = '',
      droneId     = '',
      type        = 'rgb',
      lat         = '',
      lon         = '',
      alt         = '',
      notes       = '',
      captureTime = '',
    } = fields;

    // Build a unique, safe public_id
    const safe = s => (s || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const ts   = Date.now();
    const publicId = `${DRONE_FOLDER}/${safe(mission) || 'unnamed'}_${safe(droneId) || 'unknown'}_${ts}`;

    // Upload buffer to Cloudinary via upload_stream
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id:    publicId,
          resource_type:'image',
          overwrite:    false,
          quality:      'auto:best',
          fetch_format: 'auto',
          context: [
            `mission=${mission}`,
            `region=${region}`,
            `droneId=${droneId}`,
            `type=${type}`,
            `lat=${lat}`,
            `lon=${lon}`,
            `alt=${alt}`,
            `notes=${(notes || '').slice(0, 500)}`,
            `captureTime=${captureTime}`,
          ].join('|'),
          tags: [
            'naimos', 'drone', type,
            region.replace(/\s+/g, '-').toLowerCase(),
            mission.replace(/\s+/g, '-').toLowerCase(),
          ].filter(Boolean),
        },
        (err, result) => err ? reject(err) : resolve(result)
      );

      Readable.from(fileBuffer).pipe(stream);
    });

    const image = buildImageObj(result);
    // Patch metadata from form fields (Cloudinary context may lag by a moment)
    image.mission = mission;
    image.region  = region;
    image.droneId = droneId;
    image.type    = type;
    image.lat     = parseFloat(lat) || 0;
    image.lon     = parseFloat(lon) || 0;
    image.alt     = alt;
    image.notes   = notes;
    image.captureTime = captureTime;

    console.log(`[upload] ✓ ${publicId} · ${region} · ${type}`);
    return res.status(201).json({ success: true, image });

  } catch (err) {
    console.error('[upload] error:', err.message);
    return res.status(500).json({
      error:  err.message || 'Upload failed',
      detail: 'Check CLOUDINARY_* environment variables in Vercel project settings.',
    });
  }
};

// ── Parse multipart/form-data using busboy ───────────────────────────────────
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const fields    = {};
    let fileBuffer  = null;
    let mimeType    = 'image/jpeg';
    let fileName    = 'image.jpg';
    const chunks    = [];

    const bb = busboy({
      headers: req.headers,
      limits:  { fileSize: 25 * 1024 * 1024 }, // 25 MB
    });

    bb.on('file', (_name, stream, info) => {
      mimeType = info.mimeType;
      fileName = info.filename;
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('finish', () => resolve({ fields, fileBuffer, mimeType, fileName }));
    bb.on('error',  err => reject(err));

    // Pipe request stream into busboy
    if (req.pipe) {
      req.pipe(bb);
    } else {
      // Vercel may buffer the body — handle both cases
      const readable = new Readable();
      readable.push(req.body);
      readable.push(null);
      readable.pipe(bb);
    }
  });
}
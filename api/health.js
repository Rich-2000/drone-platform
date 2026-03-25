// api/health.js
// GET /api/health
// Returns Cloudinary connectivity status.
// Used by the drone platform config page "TEST CONNECTION" button
// AND by naimos.vercel.app to check drone platform health.

const { cloudinary, DRONE_FOLDER, setCorsHeaders } = require('./_cloudinary');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' });

  const checks = {
    server:     'ok',
    platform:   'naimos-drones',
    cloudinary: 'checking',
    folder:     DRONE_FOLDER,
    timestamp:  new Date().toISOString(),
  };

  // Quick Cloudinary ping — just check credentials work
  try {
    await cloudinary.api.ping();
    checks.cloudinary = 'connected';
  } catch (err) {
    checks.cloudinary = `error: ${err.message}`;
  }

  const ok = checks.cloudinary === 'connected';
  return res.status(ok ? 200 : 503).json(checks);
};
// api/latest.js
// GET /api/latest?limit=24
//
// Fast, cached endpoint used by:
//   - naimos-drones.vercel.app  Live Feed section
//   - naimos.vercel.app         UAVs/Drones tab (cross-origin fetch)
//
// Returns the most recent N drone images from Cloudinary.
// Cache-Control: 30s so the NAIMOS tab stays fresh without hammering Cloudinary.

const { cloudinary, DRONE_FOLDER, buildImageObj, setCorsHeaders } = require('./_cloudinary');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' });

  const limit = Math.min(parseInt(req.query.limit || '24', 10), 60);

  try {
    const result = await cloudinary.search
      .expression(`folder:${DRONE_FOLDER}/*`)
      .sort_by('created_at', 'desc')
      .max_results(limit)
      .with_field('context')
      .with_field('tags')
      .execute();

    const images = (result.resources || []).map(buildImageObj);

    // Stats
    const today     = new Date().toDateString();
    const todayImgs = images.filter(img => new Date(img.uploadedAt).toDateString() === today);
    const missions  = [...new Set(images.map(i => i.mission).filter(Boolean))];
    const regions   = [...new Set(images.map(i => i.region).filter(Boolean))];

    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.json({
      images,
      count:      images.length,
      total:      result.total_count || images.length,
      todayCount: todayImgs.length,
      missions:   missions.length,
      regions,
      latest:     images[0] || null,
      updatedAt:  new Date().toISOString(),
    });
  } catch (err) {
    console.error('[latest] error:', err.message);

    // Graceful fallback — return empty list, not 500, so the UI shows empty state
    return res.status(200).json({
      images:     [],
      count:      0,
      total:      0,
      todayCount: 0,
      missions:   0,
      regions:    [],
      latest:     null,
      updatedAt:  new Date().toISOString(),
      _error:     err.message,
    });
  }
};
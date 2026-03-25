// api/images.js
// GET  /api/images            — list drone images (with optional filters)
// GET  /api/images?region=... — filter by region
// GET  /api/images?mission=...
// GET  /api/images?limit=50
// DELETE /api/images?id=...   — delete one image by public_id
//
// This is a Vercel Serverless Function (Node.js runtime).

const { cloudinary, DRONE_FOLDER, buildImageObj, setCorsHeaders } = require('./_cloudinary');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── DELETE ──────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const publicId = req.query.id;
    if (!publicId) {
      return res.status(400).json({ error: 'Query param ?id= (public_id) is required for DELETE' });
    }
    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      return res.json({ success: true, deleted: publicId, result: result.result });
    } catch (err) {
      console.error('[images] DELETE error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { region, mission, droneId, type, limit = '50', next_cursor } = req.query;

  try {
    // Build Cloudinary Search expression
    const parts = [`folder:${DRONE_FOLDER}/*`];
    if (region)  parts.push(`context.region="${region.replace(/"/g, '\\"')}"`);
    if (mission) parts.push(`context.mission="${mission.replace(/"/g, '\\"')}"`);
    if (droneId) parts.push(`context.droneId="${droneId}"`);
    if (type)    parts.push(`context.type="${type}"`);
    const expression = parts.join(' AND ');

    const maxResults = Math.min(parseInt(limit, 10) || 50, 100);

    let searchQuery = cloudinary.search
      .expression(expression)
      .sort_by('created_at', 'desc')
      .max_results(maxResults)
      .with_field('context')
      .with_field('tags');

    if (next_cursor) {
      searchQuery = searchQuery.next_cursor(next_cursor);
    }

    const result = await searchQuery.execute();
    const images = (result.resources || []).map(buildImageObj);

    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.json({
      images,
      count:      images.length,
      total:      result.total_count || images.length,
      nextCursor: result.next_cursor || null,
      updatedAt:  new Date().toISOString(),
    });
  } catch (err) {
    console.error('[images] GET error:', err.message);

    // If Cloudinary Search API isn't enabled, fall back to listing resources
    try {
      const fallback = await cloudinary.api.resources({
        type:        'upload',
        prefix:      DRONE_FOLDER + '/',
        max_results: Math.min(parseInt(limit, 10) || 50, 100),
        context:     true,
        tags:        true,
      });
      const images = (fallback.resources || []).map(buildImageObj);
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      return res.json({
        images,
        count:      images.length,
        total:      images.length,
        nextCursor: fallback.next_cursor || null,
        updatedAt:  new Date().toISOString(),
        _fallback:  true,
      });
    } catch (fallbackErr) {
      console.error('[images] Fallback listing error:', fallbackErr.message);
      return res.status(500).json({ error: err.message, detail: 'Both Search API and resource listing failed.' });
    }
  }
};
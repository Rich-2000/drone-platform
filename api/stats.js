// api/stats.js
// GET /api/stats
// Returns fleet stats: total images, by region, by type, today count, etc.
// Used by the stats cards on the drone platform and NAIMOS UAVs tab.

const { cloudinary, DRONE_FOLDER, buildImageObj, setCorsHeaders } = require('./_cloudinary');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await cloudinary.search
      .expression(`folder:${DRONE_FOLDER}/*`)
      .sort_by('created_at', 'desc')
      .max_results(500)
      .with_field('context')
      .execute();

    const images = (result.resources || []).map(buildImageObj);

    const today       = new Date().toDateString();
    const todayCount  = images.filter(img => new Date(img.uploadedAt).toDateString() === today).length;

    const byRegion  = {};
    const byType    = {};
    const byMission = {};

    images.forEach(img => {
      const r = img.region  || 'Unknown';
      const t = img.type    || 'rgb';
      const m = img.mission;
      byRegion[r]  = (byRegion[r]  || 0) + 1;
      byType[t]    = (byType[t]    || 0) + 1;
      if (m) byMission[m] = (byMission[m] || 0) + 1;
    });

    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json({
      total:     images.length,
      today:     todayCount,
      byRegion,
      byType,
      byMission,
      latest:    images[0] || null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[stats] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
// api/_cloudinary.js
// Shared Cloudinary v2 SDK helper — imported by all /api/*.js serverless functions
// This file lives in api/ but is prefixed with _ so Vercel does NOT expose it as a route.

const cloudinary = require('cloudinary').v2;

// Configure once — reads from Vercel environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'di0j2onr5',
  api_key:    process.env.CLOUDINARY_API_KEY    || '115261449775834',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'alx5EjpOvou8hvS_fZlHPBZs2eI',
  secure:     true,
});

const DRONE_FOLDER = process.env.CLOUDINARY_DRONE_FOLDER || 'naimos/drones';

/**
 * Build a clean, normalised image object from a Cloudinary resource.
 * Works for both Search API results and Upload API results.
 */
function buildImageObj(resource) {
  const ctx = (resource.context && resource.context.custom) || {};
  const secureUrl = resource.secure_url || resource.url || '';

  return {
    id:          resource.public_id || resource.asset_id || '',
    url:         secureUrl,
    thumbnail:   secureUrl
      ? secureUrl.replace('/upload/', '/upload/w_480,h_320,c_fill,q_auto,f_auto/')
      : '',
    mission:     ctx.mission     || resource.mission     || '',
    region:      ctx.region      || resource.region      || '',
    droneId:     ctx.droneId     || resource.droneId     || '',
    type:        ctx.type        || resource.imgType     || 'rgb',
    lat:         parseFloat(ctx.lat   || resource.lat   || 0) || 0,
    lon:         parseFloat(ctx.lon   || resource.lon   || 0) || 0,
    alt:         ctx.alt         || resource.alt         || '',
    notes:       ctx.notes       || resource.notes       || '',
    captureTime: ctx.captureTime || resource.captureTime || '',
    uploadedAt:  resource.created_at || resource.uploadedAt || new Date().toISOString(),
    bytes:       resource.bytes  || 0,
    width:       resource.width  || 0,
    height:      resource.height || 0,
    format:      resource.format || 'jpg',
    assetId:     resource.asset_id || '',
  };
}

/**
 * CORS headers — allow both naimos.vercel.app and any other origin
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');
}

module.exports = { cloudinary, DRONE_FOLDER, buildImageObj, setCorsHeaders };
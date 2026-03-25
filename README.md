# NAIMOS Drone Platform — Full Setup Guide

## The Architecture (Why This Works)

```
naimos-drones.vercel.app          naimos.vercel.app
┌─────────────────────────┐       ┌─────────────────────────┐
│  index.html             │       │  index.html             │
│  /api/latest    ──────────────→ │  UAVs/Drones tab        │
│  /api/upload            │       │  (fetches cross-origin) │
│  /api/images            │       └─────────────────────────┘
│  /api/stats             │
│  /api/health            │
│  /api/sign-upload       │       Cloudinary CDN
│         │               │       ┌─────────────┐
│         └───────────────────→   │ naimos/     │
│                         │       │  drones/    │
└─────────────────────────┘       └─────────────┘
         ↑
  Vercel Serverless Functions
  (Node.js, no Express needed)
```

**Key insight:** `naimos-drones.vercel.app` hosts its OWN `/api/*` serverless functions.  
`naimos.vercel.app` fetches from `https://naimos-drones.vercel.app/api/latest` cross-origin (CORS `*`).  
No shared backend needed between the two projects.

---

## Project Structure

```
naimos-drones-project/
├── index.html              ← Drone platform frontend
├── vercel.json             ← Vercel routing + env var refs
├── package.json            ← cloudinary + busboy dependencies
├── .env.example            ← Copy to .env for local dev
├── api/
│   ├── _cloudinary.js      ← Shared Cloudinary config (NOT a route — prefixed _)
│   ├── health.js           ← GET  /api/health
│   ├── images.js           ← GET  /api/images   DELETE /api/images?id=...
│   ├── latest.js           ← GET  /api/latest?limit=24
│   ├── sign-upload.js      ← POST /api/sign-upload
│   ├── stats.js            ← GET  /api/stats
│   └── upload.js           ← POST /api/upload  (multipart, uses busboy)
└── naimos-hq-uav-tab-patch.js  ← Add to naimos.vercel.app index.html
```

---

## Step 1: Deploy naimos-drones.vercel.app

### Install dependencies locally (for testing):
```bash
cd naimos-drones-project
npm install
```

### Deploy to Vercel:
```bash
npx vercel --prod
```
Or connect your GitHub repo in the Vercel dashboard.

### Set environment variables in Vercel:
Go to: **Vercel Dashboard → naimos-drones project → Settings → Environment Variables**

Add these (all environments: Production, Preview, Development):

| Variable | Value |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | `di0j2onr5` |
| `CLOUDINARY_API_KEY` | `115261449775834` |
| `CLOUDINARY_API_SECRET` | `alx5EjpOvou8hvS_fZlHPBZs2eI` |
| `CLOUDINARY_DRONE_FOLDER` | `naimos/drones` |

**After adding env vars, redeploy:** Vercel → Deployments → Redeploy.

### Verify it works:
Open `https://naimos-drones.vercel.app/api/health` in your browser.  
You should see: `{"server":"ok","cloudinary":"connected",...}`

---

## Step 2: Enable Cloudinary Search API

The `/api/images` and `/api/latest` endpoints use Cloudinary's **Search API**.  
You need to enable it:

1. Log in to **cloudinary.com**
2. Go to **Settings → Security**
3. Enable **"Resource list"** and **"Search API"**

If Search API is not available on your plan, the code automatically falls back to the basic Resources API.

---

## Step 3: Create Cloudinary Upload Preset (optional but recommended)

For unsigned uploads from the browser (fallback):
1. Cloudinary Dashboard → **Settings → Upload**
2. Click **"Add upload preset"**
3. Name: `naimos_drones`
4. Signing mode: **Unsigned**
5. Folder: `naimos/drones`
6. Save

The platform uses signed uploads by default (more secure), but having this preset available helps if the sign-upload endpoint is slow.

---

## Step 4: Add UAVs/Drones tab to naimos.vercel.app

Open `naimos-hq-uav-tab-patch.js`. It contains:

### A) The JavaScript (add before `</script>` in naimos `index.html`):
Copy the entire IIFE block at the top of the file.

### B) The nav tab HTML (add inside `.nav-bar`):
```html
<div class="nav-tab" onclick="switchTab('drones')" id="tab-btn-drones">
  <span class="tab-icon">🚁</span> UAVs/DRONES
</div>
```

### C) The tab panel HTML (add inside `.app-body`):
Copy the HTML comment block from `naimos-hq-uav-tab-patch.js` (the big HTML block with `tab-drones`, `drone-img-grid`, stats cards, etc.)

### D) The lightbox HTML (add before `</body>`):
Copy the `drone-lightbox` div block from the patch file.

---

## Step 5: Test end-to-end

1. Open `https://naimos-drones.vercel.app` — upload a test image
2. Open `https://naimos.vercel.app` → click **UAVs/DRONES** tab
3. The image should appear within 30 seconds (auto-refresh interval)

---

## Local Development

```bash
cd naimos-drones-project
cp .env.example .env
# Fill in your values in .env
npm install
npx vercel dev
# → http://localhost:3000
```

The `vercel dev` command spins up all serverless functions locally.

---

## API Reference

All endpoints return JSON with `Access-Control-Allow-Origin: *`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Cloudinary connectivity ping |
| GET | `/api/latest?limit=24` | Latest N images (cached 30s) |
| GET | `/api/images?region=...&limit=50` | Filtered image list |
| GET | `/api/stats` | Fleet statistics |
| POST | `/api/sign-upload` | Get signed Cloudinary upload params |
| POST | `/api/upload` | Multipart upload via serverless |
| DELETE | `/api/images?id=public_id` | Delete one image |

---

## Troubleshooting

### "Cannot reach backend: Failed to fetch"
→ The `/api/latest` endpoint is returning an error or Cloudinary env vars are missing.  
→ Check `https://naimos-drones.vercel.app/api/health` — if cloudinary shows `error:`, your env vars aren't set.  
→ Go to Vercel → Project Settings → Environment Variables → add CLOUDINARY_* vars → Redeploy.

### "0 Total Images" after deploying
→ No images uploaded yet, OR Cloudinary Search API isn't enabled.  
→ Upload a test image via the drone platform, then refresh.

### Upload fails with "sign-upload failed"
→ `CLOUDINARY_API_SECRET` env var is missing or wrong in Vercel.

### CORS error in naimos.vercel.app console
→ Should not happen — all `/api/*` responses include `Access-Control-Allow-Origin: *`.  
→ If it does, check `vercel.json` headers config is deployed.

### Vercel function timeout
→ Default timeout is 10s on hobby plan. Cloudinary uploads can take longer.  
→ `vercel.json` sets `maxDuration: 30` for all api functions — upgrade to Pro for 60s if needed.
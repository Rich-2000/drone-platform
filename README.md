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
  
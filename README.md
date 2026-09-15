# HSL Admin Dashboard — Vite + GSAP

This is a standalone React, TypeScript, and Vite package for the HSL (Hebron Startup Lab) **General Admin** workspace. It is intentionally separate from the member portal and includes membership review, startup review, announcement CRUD, a seven-day calendar including Sunday, GSAP-powered overview animations, responsive charts, and a light/dark theme toggle with square-edged controls throughout.

## Run locally

```bash
npm install
npm run dev
```

For a production build and local preview:

```bash
npm run build
npm run preview
```

## Included admin workflows

The overview includes animated metric cards, review activity charts, approval-status bars, a responsive seven-day calendar, and review queues. Membership applications support search, status filters, and approval or rejection decisions. Startup submissions expose the name, stage, category, description, founder, current status, and a review-note textarea before approval or rejection. Announcements support draft creation, publishing, editing, and deletion.

All data in this portable export is local prototype state. Replace the initial arrays and status-update handlers in `src/AdminDashboard.tsx` with Supabase queries and mutations when connecting the package to a backend. The interaction structure and GSAP animation hooks can remain in place.

## Dependencies

The package uses React, TypeScript, Vite, GSAP, Lucide React, and Sonner. It contains no managed-storage URLs, proprietary platform dependencies, server scripts, or runtime secrets. The supplied HSL mark and dashboard background are included under `public/` and `public/assets/`.

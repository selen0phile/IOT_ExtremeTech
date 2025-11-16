# Rixa

A React + TypeScript + Vite app. This README shows exactly how to install, run, build, and preview the project on Windows, macOS, and Linux.

## Prerequisites

- Node.js LTS (v18 or newer recommended). Install from the official site: [Node.js](https://nodejs.org/en)
- npm comes with Node. If you prefer, you can use `pnpm` or `yarn`.

Check your versions:

```bash
node -v
npm -v
```

## Quick Start

```bash
# 1) Install dependencies
npm install

# 2) Start the dev server (with HMR)
npm run dev
```

By default Vite serves at `http://localhost:5173`. The terminal will show the exact URL.

## Common Scripts

- `npm run dev` – Start local dev server with hot reloading
- `npm run build` – Production build to the `dist/` folder
- `npm run preview` – Preview the production build locally

If you use `pnpm` or `yarn`, replace `npm run` with `pnpm` or `yarn` equivalents:

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

## Project Structure (typical Vite + React)

```
.
├─ public/                # Static assets copied as-is
├─ src/
│  ├─ assets/            # Images, fonts, etc.
│  ├─ components/        # React components
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ vite-env.d.ts
├─ index.html
├─ package.json
├─ tsconfig*.json
├─ vite.config.ts
└─ README.md
```

## Environment Variables (optional)

Vite uses the `import.meta.env` system. To add variables:

1. Create a file like `.env.local` in the project root.
2. Prefix variables with `VITE_` to expose them to the client.

Example:

```bash
# .env.local
VITE_API_BASE_URL=https://api.example.com
```

Access in code:

```ts
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
```

### Google Maps API key (required for maps)

The app uses Google Maps (e.g., in pickup/ride views and the admin dashboard). You must provide a Maps JavaScript API key:

1. Create `.env.local` and set:

```bash
# .env.local
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_JS_API_KEY
```

2. Alternatively, the code also checks `GOOGLE_MAPS_API_KEY` for compatibility:

```bash
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_JS_API_KEY
```

Notes:

- Enable “Maps JavaScript API” for your project in Google Cloud Console.
- Restrict the key to your domain(s) (HTTP referrer) for security.
- Components load the key via `useLoadScript` (see `src/components/PickupRideView.tsx`, `src/pages/Admin.tsx`).

## Building for Production

```bash
npm run build
```

Outputs a production bundle to `dist/`. You can deploy `dist/` to any static host (e.g., Netlify, Vercel, GitHub Pages, Nginx).

Preview the build locally:

```bash
npm run preview
```

## Troubleshooting

- Port already in use:
  - Use a different port: `npm run dev -- --port 5174`
  - Or stop the process using the port and retry.
- Node version issues:
  - Ensure Node 18+ with `node -v`. Use [nvm](https://github.com/coreybutler/nvm-windows) (Windows) or [nvm-sh](https://github.com/nvm-sh/nvm) (macOS/Linux) to switch versions.
- Corporate proxy/firewall:
  - Configure `HTTP_PROXY`/`HTTPS_PROXY` env vars before `npm install`.
- Blank screen or build errors:
  - Clear cache and reinstall: `rm -rf node_modules .vite` (PowerShell: `rd /s /q node_modules`) then `npm install`.

## Deploying

- Vercel: Import the repo; framework = Vite; build = `npm run build`; output = `dist`.
- Netlify: Build command `npm run build`; publish directory `dist`.
- Any static server: Serve the `dist/` directory after `npm run build`.

---

If you run into problems, please include your OS, Node version, and the exact command output when asking for help.

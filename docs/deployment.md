# Deployment checklist

## Before pushing

```bash
npm install
npm run typecheck
npm test
npm run build
git status --short        # .env.local must NOT be listed
```

All four commands must exit with code 0. npm deprecation warnings are not failures.

## GitHub

- Private repository.
- `package-lock.json` is committed.
- `node_modules/`, `dist/`, `.env` and `.env.local` are ignored.

## Vercel project settings

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Root directory | `./` |
| Node.js version | 22.x (pinned by `engines`) |

Environment variables (Production and Preview):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon or publishable key>
VITE_DEFAULT_REPORT_PREFIX=OC
```

Do not enable the optional Vercel Supabase integration — it provisions a second database.

## Supabase after the first deploy

Authentication → URL Configuration:

- **Site URL**: `https://<your-app>.vercel.app`
- **Redirect URLs**: `https://<your-app>.vercel.app/**` (this is what makes password reset work in
  production; the app redirects to `/reset-password`)

## Routing

`vercel.json` rewrites every path to `/index.html`, so refreshing `/today`, `/history`,
`/dashboard`, `/reports`, `/settings`, `/sign-in`, `/sign-up` or `/forgot-password` returns the app
rather than a 404.

## If a deployment fails

1. Find the **first** real error line in the build log; ignore npm warnings.
2. Confirm the pushed commit contains your latest local changes.
3. Confirm `package-lock.json` is committed and was generated with npm 10.
4. Confirm Node and npm are pinned via `engines`.
5. Confirm the three `VITE_…` variables exist in Vercel.
6. Confirm the build command and output directory.
7. Reproduce the exact production build locally with `npm run build`, fix, then redeploy.

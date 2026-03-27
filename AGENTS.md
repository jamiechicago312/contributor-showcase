# Repository Memory

- Project uses a minimal Next.js App Router setup with TypeScript on Next.js 16.
- Core commands: `npm install`, `npm run dev`, `npm run build`, `npm run typecheck`.
- `app/page.tsx` is a server wrapper with `Suspense`; interactive UI lives in `app/showcase-page.tsx`.
- Data routes live in `app/api/contributors/route.ts` and `app/api/svg/route.ts`.
- Shared parsing, GitHub fetch, filtering, and SVG helpers live under `lib/`.
- `GITHUB_TOKEN` is optional for public repos but recommended to avoid rate limits in local and Vercel environments.

# Contributor Showcase

Contributor Showcase is a lightweight Next.js app that turns a public GitHub repository into a transparent SVG collage of circular contributor avatars.

It is designed for two jobs:
- previewing and tweaking a contributor wall in the browser
- embedding the final SVG directly in a GitHub README

## Features

- Accepts `owner/repo` or full GitHub repository URLs
- Fetches contributors server-side so GitHub tokens stay private
- Filters bots automatically and supports manual exclude lists
- Generates a transparent, README-safe SVG endpoint
- Includes a small preview UI with copyable links, Markdown, and SVG download
- Runs locally and deploys cleanly to Vercel

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` if you want a GitHub token for higher API limits:

   ```bash
   GITHUB_TOKEN=your_github_token
   ```

   The app still works without a token for public repositories, but rate limits will be lower.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
```

## README embed

Once deployed, use the hosted SVG endpoint in Markdown:

```md
![OpenHands contributors](https://your-deployment.vercel.app/api/svg?repo=OpenHands/OpenHands)
```

Supported query parameters:

- `repo`: required; `owner/repo` or full GitHub URL
- `excludeBots`: optional; defaults to `true`
- `exclude`: optional comma-separated GitHub logins
- `limit`: optional avatar count limit; omit it or set `all` to show every contributor
- `width`: optional SVG width, default `720`
- `size`: optional avatar size, default `56`
- `gap`: optional gap between avatars, default `8`

Example:

```md
![Contributors](https://your-deployment.vercel.app/api/svg?repo=OpenHands/OpenHands&exclude=dependabot,renovate)
```

## API routes

- `/api/contributors` returns normalized contributor data as JSON
- `/api/svg` returns the transparent contributor collage as raw SVG

Example JSON request:

```text
/api/contributors?repo=OpenHands/OpenHands&excludeBots=false
```

## Vercel deployment

1. Import the repository into Vercel.
2. Add `GITHUB_TOKEN` as an environment variable if you want higher GitHub API limits.
3. Deploy.

The same codebase is used for local development and production.

## Notes on caching

GitHub and external CDNs may cache remote README images. If you need fully predictable updates, you can also download the generated SVG from the app and commit it into your repository instead of relying on the live hosted image URL.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome!

import { buildContributorSvg } from '@/lib/svg';
import { filterContributors, normalizeContributors } from '@/lib/contributors';
import { fetchGitHubContributors, GitHubApiError } from '@/lib/github';
import { parseShowcaseQuery } from '@/lib/query';
import { normalizeRepoInput } from '@/lib/repo';

export const runtime = 'nodejs';

function svgResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

function errorSvg(message: string): string {
  const safeMessage = message.replace(/[<&>]/g, '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="96" viewBox="0 0 720 96" role="img" aria-labelledby="title desc">
  <title id="title">Contributor Showcase error</title>
  <desc id="desc">${safeMessage}</desc>
  <rect width="100%" height="100%" fill="transparent"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" fill="#ef4444">
    ${safeMessage}
  </text>
</svg>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const query = parseShowcaseQuery(searchParams);
    const repo = normalizeRepoInput(query.repoInput);
    const rawContributors = await fetchGitHubContributors(repo.owner, repo.repo);
    const normalized = normalizeContributors(rawContributors);
    const filtered = filterContributors(normalized, {
      excludeBots: query.excludeBots,
      excludeLogins: query.excludeLogins,
    });
    const contributors = query.limit === null ? filtered : filtered.slice(0, query.limit);

    const svg = await buildContributorSvg(contributors, {
      repoSlug: repo.slug,
      width: query.width,
      size: query.size,
      gap: query.gap,
      animate: query.animate,
      speed: query.speed,
      rows: query.rows,
    });

    return svgResponse(svg);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return svgResponse(errorSvg(error.message), error.status);
    }

    if (error instanceof Error) {
      return svgResponse(errorSvg(error.message), 400);
    }

    return svgResponse(errorSvg('Unexpected error while generating the SVG.'), 500);
  }
}

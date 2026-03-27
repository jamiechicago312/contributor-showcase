import { filterContributors, normalizeContributors } from '@/lib/contributors';
import { fetchGitHubContributors, GitHubApiError } from '@/lib/github';
import { parseShowcaseQuery } from '@/lib/query';
import { normalizeRepoInput } from '@/lib/repo';

export const runtime = 'nodejs';

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
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

    return jsonResponse({
      repo,
      options: {
        excludeBots: query.excludeBots,
        excludeLogins: query.excludeLogins,
        limit: query.limit,
        width: query.width,
        size: query.size,
        gap: query.gap,
      },
      stats: {
        fetched: normalized.length,
        returned: contributors.length,
        filteredOut: Math.max(normalized.length - filtered.length, 0),
      },
      contributors,
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    if (error instanceof Error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ error: 'Unexpected error while loading contributors.' }, 500);
  }
}

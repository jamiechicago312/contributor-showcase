import type { RawGitHubContributor } from '@/lib/types';

const GITHUB_API_BASE_URL = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const MAX_PAGES = 10;

export class GitHubApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

function buildHeaders(): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'contributor-showcase',
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
  };
}

export async function fetchGitHubContributors(
  owner: string,
  repo: string,
  targetCount: number,
): Promise<RawGitHubContributor[]> {
  const contributors: RawGitHubContributor[] = [];
  const maxResults = Math.max(100, Math.min(targetCount * 3, 500));

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetch(
      `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contributors?per_page=100&page=${page}`,
      {
        headers: buildHeaders(),
        next: { revalidate: 3600 },
      },
    );

    if (!response.ok) {
      let message = `GitHub returned ${response.status}.`;

      try {
        const body = (await response.json()) as { message?: string };
        if (body.message) {
          message = body.message;
        }
      } catch {
        // Ignore JSON parsing failures for GitHub errors.
      }

      throw new GitHubApiError(message, response.status);
    }

    const pageContributors = (await response.json()) as RawGitHubContributor[];

    if (!Array.isArray(pageContributors) || pageContributors.length === 0) {
      break;
    }

    contributors.push(...pageContributors);

    if (pageContributors.length < 100 || contributors.length >= maxResults) {
      break;
    }
  }

  return contributors;
}

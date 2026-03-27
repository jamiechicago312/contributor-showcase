import type { NormalizedRepo } from '@/lib/types';

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

function cleanRepoSegment(value: string): string {
  return value.replace(/\.git$/i, '').trim();
}

export function normalizeRepoInput(input: string): NormalizedRepo {
  const value = input.trim();

  if (!value) {
    throw new Error('Provide a GitHub repository in owner/repo format or as a GitHub URL.');
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new Error('The repository URL is not valid.');
    }

    if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
      throw new Error('Only github.com repository URLs are supported.');
    }

    const segments = url.pathname.split('/').filter(Boolean);

    if (segments.length < 2) {
      throw new Error('GitHub repository URLs must include both an owner and a repository name.');
    }

    const owner = segments[0]?.trim();
    const repo = cleanRepoSegment(segments[1] ?? '');

    if (!owner || !repo) {
      throw new Error('The repository URL is missing an owner or repository name.');
    }

    return { owner, repo, slug: `${owner}/${repo}` };
  }

  const match = value.match(/^([^/\s]+)\/([^/\s]+)$/);

  if (!match) {
    throw new Error('Use owner/repo format or a full GitHub repository URL.');
  }

  const owner = match[1]?.trim();
  const repo = cleanRepoSegment(match[2] ?? '');

  if (!owner || !repo) {
    throw new Error('The repository input is missing an owner or repository name.');
  }

  return { owner, repo, slug: `${owner}/${repo}` };
}

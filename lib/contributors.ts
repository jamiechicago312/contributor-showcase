import type { Contributor, RawGitHubContributor } from '@/lib/types';

function isDependabotLike(login: string): boolean {
  return login.toLowerCase().startsWith('dependabot');
}

function isLikelyBot(login: string, type?: string): boolean {
  if (type === 'Bot') {
    return true;
  }

  const normalized = login.toLowerCase();

  return (
    normalized.endsWith('[bot]') ||
    isDependabotLike(login) ||
    normalized === 'renovate' ||
    normalized === 'github-actions' ||
    /(?:^|[-_])bot(?:$|[-_])/i.test(normalized)
  );
}

export function normalizeContributors(rawContributors: RawGitHubContributor[]): Contributor[] {
  return rawContributors
    .filter((contributor): contributor is Required<Pick<RawGitHubContributor, 'login' | 'avatar_url' | 'html_url'>> & RawGitHubContributor => {
      return Boolean(contributor.login && contributor.avatar_url && contributor.html_url);
    })
    .map((contributor) => ({
      login: contributor.login,
      avatarUrl: contributor.avatar_url,
      profileUrl: contributor.html_url,
      contributions: contributor.contributions ?? 0,
      isBot: isLikelyBot(contributor.login, contributor.type),
    }));
}

export function filterContributors(
  contributors: Contributor[],
  options: {
    excludeBots: boolean;
    excludeLogins: string[];
  },
): Contributor[] {
  const excluded = new Set(options.excludeLogins.map((login) => login.toLowerCase()));

  return contributors.filter((contributor) => {
    if (isDependabotLike(contributor.login) || excluded.has(contributor.login.toLowerCase())) {
      return false;
    }

    if (options.excludeBots && contributor.isBot) {
      return false;
    }

    return true;
  });
}

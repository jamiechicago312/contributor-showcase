import type { Contributor, RawGitHubContributor } from '@/lib/types';

function isDependabotLike(login: string): boolean {
  return login.toLowerCase().startsWith('dependabot');
}

function buildAnonymousAvatar(label: string): string {
  const initials = label
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

  const safeLabel = label.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const hue = Array.from(label).reduce((total, char) => total + char.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${safeLabel}"><rect width="64" height="64" rx="32" fill="hsl(${hue} 45% 24%)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="white">${initials}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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

function normalizeLogin(contributor: RawGitHubContributor, index: number): string {
  const name = contributor.name?.trim();
  const emailPrefix = contributor.email?.split('@')[0]?.trim();
  return contributor.login?.trim() || name || emailPrefix || `anonymous-${index + 1}`;
}

export function normalizeContributors(rawContributors: RawGitHubContributor[]): Contributor[] {
  const seenLogins = new Map<string, number>();

  return rawContributors.map((contributor, index) => {
    const baseLogin = normalizeLogin(contributor, index);
    const normalizedLogin = baseLogin.toLowerCase();
    const duplicateCount = seenLogins.get(normalizedLogin) ?? 0;
    seenLogins.set(normalizedLogin, duplicateCount + 1);

    const login = duplicateCount === 0 ? baseLogin : `${baseLogin} (${duplicateCount + 1})`;

    return {
      login,
      avatarUrl: contributor.avatar_url?.trim() || buildAnonymousAvatar(login),
      profileUrl: contributor.html_url?.trim() || null,
      contributions: contributor.contributions ?? 0,
      isBot: isLikelyBot(login, contributor.type),
    };
  });
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

import type { ShowcaseQuery } from '@/lib/types';

const DEFAULT_REPO = 'OpenHands/OpenHands';
const DEFAULT_LIMIT = 60;
const DEFAULT_WIDTH = 720;
const DEFAULT_SIZE = 56;
const DEFAULT_GAP = 8;

type SearchParamReader = {
  get(name: string): string | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) {
    return fallback;
  }

  if (/^(1|true|yes|on)$/i.test(value)) {
    return true;
  }

  if (/^(0|false|no|off)$/i.test(value)) {
    return false;
  }

  return fallback;
}

function parseInteger(value: string | null, fallback: number, min: number, max: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return clamp(parsed, min, max);
}

export function parseExcludeList(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function parseShowcaseQuery(searchParams: SearchParamReader): ShowcaseQuery {
  return {
    repoInput: searchParams.get('repo')?.trim() || DEFAULT_REPO,
    excludeBots: parseBoolean(searchParams.get('excludeBots'), true),
    excludeLogins: parseExcludeList(searchParams.get('exclude')),
    limit: parseInteger(searchParams.get('limit'), DEFAULT_LIMIT, 1, 200),
    width: parseInteger(searchParams.get('width'), DEFAULT_WIDTH, 160, 1600),
    size: parseInteger(searchParams.get('size'), DEFAULT_SIZE, 24, 128),
    gap: parseInteger(searchParams.get('gap'), DEFAULT_GAP, 0, 48),
  };
}

export function buildQueryString(query: Pick<ShowcaseQuery, 'repoInput' | 'excludeBots' | 'excludeLogins'>): string {
  const params = new URLSearchParams();
  params.set('repo', query.repoInput.trim() || DEFAULT_REPO);

  if (!query.excludeBots) {
    params.set('excludeBots', 'false');
  }

  if (query.excludeLogins.length > 0) {
    params.set('exclude', query.excludeLogins.join(','));
  }

  return params.toString();
}

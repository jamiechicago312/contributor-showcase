import type { ShowcaseQuery } from '@/lib/types';

const DEFAULT_REPO = 'OpenHands/OpenHands';
const DEFAULT_WIDTH = 830;
const DEFAULT_SIZE = 56;
const DEFAULT_GAP = 8;
const MAX_LIMIT = 100000;
const MIN_SIZE = 16;
const MAX_HEIGHT = 4000;

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

function parseLimit(value: string | null): number | null {
  if (!value || /^(all|max)$/i.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return clamp(parsed, 1, MAX_LIMIT);
}

function parseHeight(value: string | null): number | null {
  if (!value || /^(auto|none)$/i.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < MIN_SIZE) {
    return null;
  }

  return Math.min(parsed, MAX_HEIGHT);
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
    limit: parseLimit(searchParams.get('limit')),
    width: parseInteger(searchParams.get('width'), DEFAULT_WIDTH, 160, 1600),
    height: parseHeight(searchParams.get('height')),
    size: parseInteger(searchParams.get('size'), DEFAULT_SIZE, MIN_SIZE, 128),
    gap: parseInteger(searchParams.get('gap'), DEFAULT_GAP, 0, 48),
  };
}

export type BuildQueryOptions = Pick<ShowcaseQuery, 'repoInput' | 'excludeBots' | 'excludeLogins'> & {
  width?: number | null;
  height?: number | null;
  size?: number | null;
  gap?: number | null;
};

export function buildQueryString(query: BuildQueryOptions): string {
  const params = new URLSearchParams();
  params.set('repo', query.repoInput.trim() || DEFAULT_REPO);

  if (!query.excludeBots) {
    params.set('excludeBots', 'false');
  }

  if (query.excludeLogins.length > 0) {
    params.set('exclude', query.excludeLogins.join(','));
  }

  if (query.width != null && query.width !== DEFAULT_WIDTH) {
    params.set('width', String(query.width));
  }

  if (query.height != null) {
    params.set('height', String(query.height));
  }

  if (query.size != null && query.size !== DEFAULT_SIZE) {
    params.set('size', String(query.size));
  }

  if (query.gap != null && query.gap !== DEFAULT_GAP) {
    params.set('gap', String(query.gap));
  }

  return params.toString();
}

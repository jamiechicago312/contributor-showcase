import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GET as getContributors } from '@/app/api/contributors/route';
import { GET as getSvg } from '@/app/api/svg/route';
import { calculateLayout } from '@/lib/svg';

type RawContributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: 'User' | 'Bot';
};

const originalFetch = globalThis.fetch;

function createContributor(index: number): RawContributor {
  return {
    login: `user-${index}`,
    avatar_url: `https://avatars.example.com/${index}.png`,
    html_url: `https://github.com/user-${index}`,
    contributions: index,
    type: 'User',
  };
}

function createBotContributor(login = 'renovate[bot]', contributions = 99): RawContributor {
  return {
    login,
    avatar_url: `https://avatars.example.com/${login}.png`,
    html_url: `https://github.com/apps/${login}`,
    contributions,
    type: 'Bot',
  };
}

function createDependabotContributor(login = 'dependabot[bot]', contributions = 99): RawContributor {
  return createBotContributor(login, contributions);
}

function installFetchMock(contributors: RawContributor[]) {
  const pages = [contributors.slice(0, 100), contributors.slice(100, 200), contributors.slice(200)];
  let githubRequests = 0;
  let avatarRequests = 0;

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = input instanceof Request ? new URL(input.url) : new URL(input.toString());

    if (url.origin === 'https://api.github.com') {
      githubRequests += 1;
      const page = Number(url.searchParams.get('page') ?? '1');
      return Response.json(pages[page - 1] ?? []);
    }

    if (url.origin === 'https://avatars.example.com') {
      avatarRequests += 1;
      return new Response(Uint8Array.from([137, 80, 78, 71]), {
        headers: {
          'content-type': 'image/png',
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${url.toString()}`);
  }) as typeof fetch;

  return {
    getGithubRequests: () => githubRequests,
    getAvatarRequests: () => avatarRequests,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('showcase routes', () => {
  it('returns every contributor by default across multiple GitHub pages', async () => {
    const contributors = Array.from({ length: 205 }, (_, index) => createContributor(index + 1));
    const requests = installFetchMock(contributors);

    const response = await getContributors(new Request('http://localhost/api/contributors?repo=owner/repo'));
    const payload = (await response.json()) as {
      stats: { fetched: number; returned: number };
      contributors: Array<{ login: string }>;
      options: { limit: number | null };
    };

    assert.equal(response.status, 200);
    assert.equal(payload.options.limit, null);
    assert.equal(payload.stats.fetched, 205);
    assert.equal(payload.stats.returned, 205);
    assert.equal(payload.contributors.length, 205);
    assert.equal(payload.contributors.at(-1)?.login, 'user-205');
    assert.equal(requests.getGithubRequests(), 3);
  });

  it('auto-excludes dependabot accounts by default', async () => {
    const contributors = [createContributor(1), createDependabotContributor(), createContributor(2)];
    installFetchMock(contributors);

    const response = await getContributors(new Request('http://localhost/api/contributors?repo=owner/repo'));
    const payload = (await response.json()) as {
      stats: { fetched: number; returned: number; filteredOut: number };
      contributors: Array<{ login: string }>;
      options: { excludeBots: boolean };
    };

    assert.equal(response.status, 200);
    assert.equal(payload.options.excludeBots, false);
    assert.equal(payload.stats.fetched, 3);
    assert.equal(payload.stats.returned, 2);
    assert.equal(payload.stats.filteredOut, 1);
    assert.deepEqual(
      payload.contributors.map((contributor) => contributor.login),
      ['user-1', 'user-2'],
    );
  });

  it('does not exclude other bot accounts by default', async () => {
    const contributors = [createContributor(1), createBotContributor(), createContributor(2)];
    installFetchMock(contributors);

    const response = await getContributors(new Request('http://localhost/api/contributors?repo=owner/repo'));
    const payload = (await response.json()) as {
      stats: { fetched: number; returned: number; filteredOut: number };
      contributors: Array<{ login: string }>;
      options: { excludeBots: boolean };
    };

    assert.equal(response.status, 200);
    assert.equal(payload.options.excludeBots, false);
    assert.equal(payload.stats.fetched, 3);
    assert.equal(payload.stats.returned, 3);
    assert.equal(payload.stats.filteredOut, 0);
    assert.deepEqual(
      payload.contributors.map((contributor) => contributor.login),
      ['user-1', 'renovate[bot]', 'user-2'],
    );
  });

  it('honors manual excludes from the query string', async () => {
    const contributors = [createContributor(1), createBotContributor(), createContributor(2)];
    installFetchMock(contributors);

    const response = await getContributors(
      new Request('http://localhost/api/contributors?repo=owner/repo&exclude=renovate%5Bbot%5D,user-2'),
    );
    const payload = (await response.json()) as {
      stats: { returned: number; filteredOut: number };
      contributors: Array<{ login: string }>;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.stats.returned, 1);
    assert.equal(payload.stats.filteredOut, 2);
    assert.deepEqual(
      payload.contributors.map((contributor) => contributor.login),
      ['user-1'],
    );
  });

  it('still honors an explicit numeric limit', async () => {
    const contributors = Array.from({ length: 205 }, (_, index) => createContributor(index + 1));
    installFetchMock(contributors);

    const response = await getContributors(new Request('http://localhost/api/contributors?repo=owner/repo&limit=10'));
    const payload = (await response.json()) as {
      stats: { returned: number };
      contributors: Array<{ login: string }>;
      options: { limit: number | null };
    };

    assert.equal(response.status, 200);
    assert.equal(payload.options.limit, 10);
    assert.equal(payload.stats.returned, 10);
    assert.equal(payload.contributors.length, 10);
    assert.equal(payload.contributors.at(-1)?.login, 'user-10');
  });

  it('renders every contributor in the SVG when no limit is provided', async () => {
    const contributors = Array.from({ length: 205 }, (_, index) => createContributor(index + 1));
    const requests = installFetchMock(contributors);

    const response = await getSvg(new Request('http://localhost/api/svg?repo=owner/repo'));
    const svg = await response.text();

    assert.equal(response.status, 200);
    assert.equal((svg.match(/<image /g) ?? []).length, 205);
    assert.match(svg, /user-205 · 205 contributions/);
    assert.equal(requests.getGithubRequests(), 3);
    assert.equal(requests.getAvatarRequests(), 205);
  });

  it('shrinks avatar size when height constraint is set', async () => {
    const contributors = Array.from({ length: 100 }, (_, index) => createContributor(index + 1));
    installFetchMock(contributors);

    const response = await getSvg(new Request('http://localhost/api/svg?repo=owner/repo&height=100'));
    const svg = await response.text();

    assert.equal(response.status, 200);
    const widthMatch = svg.match(/width="(\d+)"/);
    const heightMatch = svg.match(/height="(\d+)"/);
    assert.ok(widthMatch, 'SVG should have width attribute');
    assert.ok(heightMatch, 'SVG should have height attribute');
    const svgHeight = Number.parseInt(heightMatch[1], 10);
    assert.ok(svgHeight <= 100, `SVG height ${svgHeight} should be <= 100`);
    assert.equal((svg.match(/<image /g) ?? []).length, 100);
  });

  it('uses default width of 830 when width is not specified', async () => {
    const contributors = Array.from({ length: 10 }, (_, index) => createContributor(index + 1));
    installFetchMock(contributors);

    const response = await getSvg(new Request('http://localhost/api/svg?repo=owner/repo'));
    const svg = await response.text();

    assert.equal(response.status, 200);
    assert.match(svg, /width="830"/);
  });
});

describe('calculateLayout', () => {
  it('returns preferred size when no height constraint', () => {
    const result = calculateLayout(10, 830, null, 56, 8);
    assert.equal(result.size, 56);
  });

  it('returns preferred size when all contributors fit within height', () => {
    const result = calculateLayout(10, 830, 500, 56, 8);
    assert.equal(result.size, 56);
  });

  it('shrinks avatar size when contributors do not fit within height', () => {
    const result = calculateLayout(100, 830, 100, 56, 8);
    assert.ok(result.size < 56, `Size ${result.size} should be less than preferred size 56`);
    assert.ok(result.size >= 16, `Size ${result.size} should be at least minimum size 16`);
    assert.ok(result.finalHeight <= 100, `Height ${result.finalHeight} should be <= 100`);
  });

  it('returns minimum size when height is very small', () => {
    const result = calculateLayout(100, 830, 50, 56, 8);
    assert.equal(result.size, 16);
  });

  it('handles empty contributor list', () => {
    const result = calculateLayout(0, 830, null, 56, 8);
    assert.equal(result.size, 56);
    assert.equal(result.finalHeight, 88);
  });

  it('calculates correct number of columns', () => {
    const result = calculateLayout(20, 830, null, 56, 8);
    const expectedColumns = Math.floor((830 + 8) / (56 + 8));
    assert.equal(result.columns, expectedColumns);
  });
});

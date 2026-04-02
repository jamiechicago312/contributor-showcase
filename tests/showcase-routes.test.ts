import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GET as getContributors } from '@/app/api/contributors/route';
import { GET as getSvg } from '@/app/api/svg/route';
import { parseShowcaseQuery } from '@/lib/query';

type RawContributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: 'User';
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

  it('renders animated SVG with CSS keyframes when animate=true', async () => {
    const contributors = Array.from({ length: 30 }, (_, index) => createContributor(index + 1));
    installFetchMock(contributors);

    const response = await getSvg(new Request('http://localhost/api/svg?repo=owner/repo&animate=true&rows=3'));
    const svg = await response.text();

    assert.equal(response.status, 200);
    assert.match(svg, /animated ticker/);
    assert.match(svg, /@keyframes scroll-row-0/);
    assert.match(svg, /@keyframes scroll-row-1/);
    assert.match(svg, /@keyframes scroll-row-2/);
    assert.match(svg, /animation:.*linear infinite/);
    assert.match(svg, /translateX/);
  });

  it('parses animate query parameter correctly', () => {
    const params = new URLSearchParams('repo=owner/repo&animate=true&speed=50&rows=5');
    const query = parseShowcaseQuery(params);

    assert.equal(query.animate, true);
    assert.equal(query.speed, 50);
    assert.equal(query.rows, 5);
  });

  it('defaults animate to false when not specified', () => {
    const params = new URLSearchParams('repo=owner/repo');
    const query = parseShowcaseQuery(params);

    assert.equal(query.animate, false);
    assert.equal(query.speed, 30);
    assert.equal(query.rows, 3);
  });

  it('renders static SVG without animation keyframes when animate is not set', async () => {
    const contributors = Array.from({ length: 10 }, (_, index) => createContributor(index + 1));
    installFetchMock(contributors);

    const response = await getSvg(new Request('http://localhost/api/svg?repo=owner/repo'));
    const svg = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(svg, /@keyframes/);
    assert.doesNotMatch(svg, /animation:/);
    assert.doesNotMatch(svg, /animated ticker/);
  });
});

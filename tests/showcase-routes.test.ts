import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GET as getContributors } from '@/app/api/contributors/route';
import { GET as getSvg } from '@/app/api/svg/route';

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
});

'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildQueryString, parseExcludeList } from '@/lib/query';

type ContributorResponse = {
  repo: {
    owner: string;
    repo: string;
    slug: string;
  };
  stats: {
    fetched: number;
    returned: number;
    filteredOut: number;
  };
  contributors: Array<{
    login: string;
    avatarUrl: string;
    profileUrl: string;
    contributions: number;
  }>;
  error?: string;
};

type FormState = {
  repoInput: string;
  excludeBots: boolean;
  exclude: string;
};

const DEFAULT_STATE: FormState = {
  repoInput: 'OpenHands/OpenHands',
  excludeBots: true,
  exclude: '',
};

function readFormState(searchParams: URLSearchParams): FormState {
  return {
    repoInput: searchParams.get('repo')?.trim() || DEFAULT_STATE.repoInput,
    excludeBots: searchParams.get('excludeBots') !== 'false',
    exclude: searchParams.get('exclude') || '',
  };
}

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [origin, setOrigin] = useState('');
  const [formState, setFormState] = useState<FormState>(DEFAULT_STATE);
  const [appliedState, setAppliedState] = useState<FormState>(DEFAULT_STATE);
  const [data, setData] = useState<ContributorResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const searchParamString = searchParams.toString();
  const currentState = useMemo(() => readFormState(new URLSearchParams(searchParamString)), [searchParamString]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setFormState(currentState);
    setAppliedState(currentState);
  }, [currentState]);

  useEffect(() => {
    const params = buildQueryString({
      repoInput: appliedState.repoInput,
      excludeBots: appliedState.excludeBots,
      excludeLogins: parseExcludeList(appliedState.exclude),
    });

    const controller = new AbortController();
    const requestPath = `/api/contributors?${params}`;

    async function loadContributors() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(requestPath, { signal: controller.signal });
        const payload = (await response.json()) as ContributorResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load contributors.');
        }

        setData(payload);
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setData(null);
        setError(requestError instanceof Error ? requestError.message : 'Unable to load contributors.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadContributors();

    return () => controller.abort();
  }, [appliedState]);

  useEffect(() => {
    if (!copyMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopyMessage(''), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyMessage]);

  const queryString = useMemo(
    () =>
      buildQueryString({
        repoInput: appliedState.repoInput,
        excludeBots: appliedState.excludeBots,
        excludeLogins: parseExcludeList(appliedState.exclude),
      }),
    [appliedState],
  );

  const svgPath = `/api/svg?${queryString}`;
  const previewUrl = origin ? `${origin}${svgPath}` : svgPath;
  const pageUrl = origin ? `${origin}${pathname}?${queryString}` : `${pathname}?${queryString}`;
  const markdownSnippet = `![${appliedState.repoInput} contributors](${previewUrl})`;
  const downloadName = `${appliedState.repoInput.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}-contributors.svg`;

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextState = {
      repoInput: formState.repoInput.trim() || DEFAULT_STATE.repoInput,
      excludeBots: formState.excludeBots,
      exclude: formState.exclude,
    };

    const params = buildQueryString({
      repoInput: nextState.repoInput,
      excludeBots: nextState.excludeBots,
      excludeLogins: parseExcludeList(nextState.exclude),
    });

    router.replace(`${pathname}?${params}`);
    setAppliedState(nextState);
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">README-safe contributor collage</span>
          <h1>Turn any public GitHub repository into a transparent avatar wall.</h1>
          <p>
            Paste a repository, filter bots, preview the SVG, and copy a Markdown-ready image URL for your GitHub README.
          </p>
        </div>

        <form className="controls-grid" onSubmit={handleSubmit}>
          <label className="field-group field-span-2">
            <span>Repository</span>
            <input
              name="repo"
              placeholder="OpenHands/OpenHands or https://github.com/OpenHands/OpenHands"
              value={formState.repoInput}
              onChange={(event) => setFormState((current) => ({ ...current, repoInput: event.target.value }))}
            />
          </label>

          <label className="field-group checkbox-row">
            <input
              type="checkbox"
              checked={formState.excludeBots}
              onChange={(event) => setFormState((current) => ({ ...current, excludeBots: event.target.checked }))}
            />
            <span>Exclude bots automatically</span>
          </label>

          <label className="field-group">
            <span>Manual excludes</span>
            <input
              name="exclude"
              placeholder="dependabot, renovate"
              value={formState.exclude}
              onChange={(event) => setFormState((current) => ({ ...current, exclude: event.target.value }))}
            />
          </label>

          <div className="action-row field-span-2">
            <button type="submit">Update preview</button>
            <a className="secondary-button" href={svgPath} target="_blank" rel="noreferrer">
              Open raw SVG
            </a>
            <a className="secondary-button" href={svgPath} download={downloadName}>
              Download SVG
            </a>
          </div>
        </form>
      </section>

      <section className="info-grid">
        <article className="info-card">
          <div className="section-heading">
            <h2>Share</h2>
            {copyMessage ? <span className="copy-message">{copyMessage}</span> : null}
          </div>
          <div className="snippet-block">
            <span>Preview link</span>
            <code>{pageUrl}</code>
            <button type="button" className="ghost-button" onClick={() => void copyText(pageUrl, 'Preview link')}>
              Copy link
            </button>
          </div>
          <div className="snippet-block">
            <span>Image endpoint</span>
            <code>{previewUrl}</code>
            <button type="button" className="ghost-button" onClick={() => void copyText(previewUrl, 'Image URL')}>
              Copy image URL
            </button>
          </div>
          <div className="snippet-block">
            <span>README snippet</span>
            <code>{markdownSnippet}</code>
            <button type="button" className="ghost-button" onClick={() => void copyText(markdownSnippet, 'Markdown snippet')}>
              Copy Markdown
            </button>
          </div>
        </article>

        <article className="info-card">
          <div className="section-heading">
            <h2>Dataset</h2>
            {loading ? <span className="muted">Loading…</span> : null}
          </div>
          {error ? (
            <p className="error-text">{error}</p>
          ) : data ? (
            <>
              <div className="stats-grid">
                <div>
                  <strong>{data.stats.returned}</strong>
                  <span>displayed</span>
                </div>
                <div>
                  <strong>{data.stats.fetched}</strong>
                  <span>fetched</span>
                </div>
                <div>
                  <strong>{data.stats.filteredOut}</strong>
                  <span>filtered out</span>
                </div>
              </div>
              <p className="muted">
                Showing contributors for <strong>{data.repo.slug}</strong>.
              </p>
              <div className="avatar-list" aria-label="Contributor list">
                {data.contributors.slice(0, 18).map((contributor) => (
                  <a key={contributor.login} href={contributor.profileUrl} target="_blank" rel="noreferrer" title={contributor.login}>
                    <img src={contributor.avatarUrl} alt={contributor.login} width={36} height={36} />
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Contributor data will appear here.</p>
          )}
        </article>
      </section>

      <section className="preview-grid">
        <article className="preview-card light-surface">
          <div className="section-heading">
            <h2>Light preview</h2>
            <span className="muted">Transparent SVG</span>
          </div>
          <img className="preview-image" src={svgPath} alt="Contributor collage preview on a light surface" />
        </article>

        <article className="preview-card dark-surface">
          <div className="section-heading">
            <h2>Dark preview</h2>
            <span className="muted">Same image endpoint</span>
          </div>
          <img className="preview-image" src={svgPath} alt="Contributor collage preview on a dark surface" />
        </article>
      </section>
    </main>
  );
}

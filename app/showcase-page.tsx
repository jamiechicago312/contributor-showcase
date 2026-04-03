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
    profileUrl: string | null;
    contributions: number;
  }>;
  error?: string;
};

type FormState = {
  repoInput: string;
  exclude: string;
  width: string;
  height: string;
  size: string;
  gap: string;
};

const DEFAULT_STATE: FormState = {
  repoInput: 'OpenHands/OpenHands',
  exclude: '',
  width: '830',
  height: '',
  size: '56',
  gap: '8',
};

function parseOptionalInt(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? String(num) : fallback;
}

function readFormState(searchParams: URLSearchParams): FormState {
  return {
    repoInput: searchParams.get('repo')?.trim() || DEFAULT_STATE.repoInput,
    exclude: searchParams.get('exclude') || '',
    width: parseOptionalInt(searchParams.get('width'), DEFAULT_STATE.width),
    height: searchParams.get('height') || '',
    size: parseOptionalInt(searchParams.get('size'), DEFAULT_STATE.size),
    gap: parseOptionalInt(searchParams.get('gap'), DEFAULT_STATE.gap),
  };
}

function getActiveExcludeToken(value: string): string {
  return value.split(',').at(-1)?.trim().toLowerCase() ?? '';
}

function replaceActiveExcludeToken(value: string, login: string): string {
  const existing = parseExcludeList(value.split(',').slice(0, -1).join(','));
  return `${[...existing, login.toLowerCase()].join(', ')}, `;
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
  const [excludeInputFocused, setExcludeInputFocused] = useState(false);

  const searchParamString = searchParams.toString();
  const currentState = useMemo(() => readFormState(new URLSearchParams(searchParamString)), [searchParamString]);
  const excludedLogins = useMemo(() => parseExcludeList(formState.exclude), [formState.exclude]);
  const activeExcludeToken = useMemo(() => getActiveExcludeToken(formState.exclude), [formState.exclude]);
  const contributorSuggestions = useMemo(() => {
    if (!data || !activeExcludeToken) {
      return [];
    }

    const excluded = new Set(excludedLogins);

    return data.contributors
      .filter((contributor) => {
        const login = contributor.login.toLowerCase();
        return !excluded.has(login) && login.includes(activeExcludeToken);
      })
      .slice(0, 8);
  }, [activeExcludeToken, data, excludedLogins]);

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
      excludeBots: false,
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
        excludeBots: false,
        excludeLogins: parseExcludeList(appliedState.exclude),
        width: appliedState.width ? Number.parseInt(appliedState.width, 10) : null,
        height: appliedState.height ? Number.parseInt(appliedState.height, 10) : null,
        size: appliedState.size ? Number.parseInt(appliedState.size, 10) : null,
        gap: appliedState.gap ? Number.parseInt(appliedState.gap, 10) : null,
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

  function applyExcludeSuggestion(login: string) {
    setFormState((current) => ({
      ...current,
      exclude: replaceActiveExcludeToken(current.exclude, login),
    }));
  }

  function removeExcludedLogin(login: string) {
    setFormState((current) => ({
      ...current,
      exclude: parseExcludeList(current.exclude)
        .filter((item) => item !== login.toLowerCase())
        .join(', '),
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextState: FormState = {
      repoInput: formState.repoInput.trim() || DEFAULT_STATE.repoInput,
      exclude: excludedLogins.join(', '),
      width: formState.width || DEFAULT_STATE.width,
      height: formState.height,
      size: formState.size || DEFAULT_STATE.size,
      gap: formState.gap || DEFAULT_STATE.gap,
    };

    const params = buildQueryString({
      repoInput: nextState.repoInput,
      excludeBots: false,
      excludeLogins: parseExcludeList(nextState.exclude),
      width: nextState.width ? Number.parseInt(nextState.width, 10) : null,
      height: nextState.height ? Number.parseInt(nextState.height, 10) : null,
      size: nextState.size ? Number.parseInt(nextState.size, 10) : null,
      gap: nextState.gap ? Number.parseInt(nextState.gap, 10) : null,
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
            Paste a repository, optionally hide specific logins, preview the SVG, and copy a Markdown-ready image URL for your GitHub README.
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

          <label className="field-group field-span-2">
            <span>Exclude contributors</span>
            <input
              name="exclude"
              placeholder="dependabot[bot], renovate[bot]"
              autoComplete="off"
              spellCheck={false}
              value={formState.exclude}
              onFocus={() => setExcludeInputFocused(true)}
              onBlur={() => window.setTimeout(() => setExcludeInputFocused(false), 120)}
              onChange={(event) => setFormState((current) => ({ ...current, exclude: event.target.value }))}
            />
            <p className="field-hint">Dependabot is hidden automatically. Start typing another login to get lightweight suggestions from the loaded contributor list.</p>
            {excludeInputFocused && contributorSuggestions.length > 0 ? (
              <div className="suggestion-list" role="listbox" aria-label="Contributor suggestions">
                {contributorSuggestions.map((contributor) => (
                  <button
                    key={contributor.login}
                    type="button"
                    className="suggestion-button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyExcludeSuggestion(contributor.login)}
                  >
                    <span>{contributor.login}</span>
                    <small className="suggestion-meta">{contributor.contributions} contributions</small>
                  </button>
                ))}
              </div>
            ) : null}
            {excludedLogins.length > 0 ? (
              <div className="tag-list" aria-label="Excluded contributors">
                {excludedLogins.map((login) => (
                  <button key={login} type="button" className="tag-button" onClick={() => removeExcludedLogin(login)}>
                    {login} ×
                  </button>
                ))}
              </div>
            ) : null}
          </label>

          <fieldset className="field-group field-span-2 layout-fieldset">
            <legend>Layout options</legend>
            <div className="layout-grid">
              <label className="field-group">
                <span>Width (px)</span>
                <input
                  type="number"
                  name="width"
                  min="160"
                  max="1600"
                  placeholder="830"
                  value={formState.width}
                  onChange={(event) => setFormState((current) => ({ ...current, width: event.target.value }))}
                />
              </label>

              <label className="field-group">
                <span>Max height (px)</span>
                <input
                  type="number"
                  name="height"
                  min="16"
                  max="4000"
                  placeholder="Auto"
                  value={formState.height}
                  onChange={(event) => setFormState((current) => ({ ...current, height: event.target.value }))}
                />
              </label>

              <label className="field-group">
                <span>Avatar size (px)</span>
                <input
                  type="number"
                  name="size"
                  min="16"
                  max="128"
                  placeholder="56"
                  value={formState.size}
                  onChange={(event) => setFormState((current) => ({ ...current, size: event.target.value }))}
                />
              </label>

              <label className="field-group">
                <span>Gap (px)</span>
                <input
                  type="number"
                  name="gap"
                  min="0"
                  max="48"
                  placeholder="8"
                  value={formState.gap}
                  onChange={(event) => setFormState((current) => ({ ...current, gap: event.target.value }))}
                />
              </label>
            </div>
            <p className="layout-hint">Set max height to constrain the SVG. Avatars shrink automatically to fit.</p>
          </fieldset>

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
                  <span>excluded</span>
                </div>
              </div>
              <p className="muted">
                Showing contributors for <strong>{data.repo.slug}</strong>.
              </p>
              <div className="avatar-list" aria-label="Contributor list">
                {data.contributors.slice(0, 18).map((contributor) => {
                  const avatar = <img src={contributor.avatarUrl} alt={contributor.login} width={36} height={36} />;

                  if (!contributor.profileUrl) {
                    return (
                      <span key={contributor.login} title={`${contributor.login} (anonymous contributor)`}>
                        {avatar}
                      </span>
                    );
                  }

                  return (
                    <a key={contributor.login} href={contributor.profileUrl} target="_blank" rel="noreferrer" title={contributor.login}>
                      {avatar}
                    </a>
                  );
                })}
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

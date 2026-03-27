import type { Contributor, SvgLayoutOptions } from '@/lib/types';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function toDataUri(contentType: string, bytes: ArrayBuffer): string {
  return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`;
}

async function inlineAvatar(avatarUrl: string, size: number): Promise<string> {
  const sizedUrl = `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}s=${Math.max(size * 2, 64)}`;

  try {
    const response = await fetch(sizedUrl, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return sizedUrl;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const bytes = await response.arrayBuffer();
    return toDataUri(contentType, bytes);
  } catch {
    return sizedUrl;
  }
}

export async function buildContributorSvg(
  contributors: Contributor[],
  options: SvgLayoutOptions,
): Promise<string> {
  if (contributors.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="88" viewBox="0 0 ${options.width} 88" role="img" aria-labelledby="title desc">
  <title id="title">No contributors available for ${escapeXml(options.repoSlug)}</title>
  <desc id="desc">No contributors were returned after applying the selected filters.</desc>
  <rect width="100%" height="100%" fill="transparent"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" fill="#6b7280">
    No contributors matched the current filters.
  </text>
</svg>`;
  }

  const columns = Math.max(1, Math.floor((options.width + options.gap) / (options.size + options.gap)));
  const rows = Math.ceil(contributors.length / columns);
  const height = rows * options.size + Math.max(0, rows - 1) * options.gap;
  const avatars = await Promise.all(contributors.map((contributor) => inlineAvatar(contributor.avatarUrl, options.size)));

  const content = contributors
    .map((contributor, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = column * (options.size + options.gap);
      const y = row * (options.size + options.gap);
      const clipId = `clip-${index}`;
      const label = `${contributor.login} · ${contributor.contributions} contribution${contributor.contributions === 1 ? '' : 's'}`;

      return `
  <g>
    <title>${escapeXml(label)}</title>
    <clipPath id="${clipId}">
      <circle cx="${x + options.size / 2}" cy="${y + options.size / 2}" r="${options.size / 2}" />
    </clipPath>
    <image href="${avatars[index]}" x="${x}" y="${y}" width="${options.size}" height="${options.size}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice" />
  </g>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${height}" viewBox="0 0 ${options.width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Contributors for ${escapeXml(options.repoSlug)}</title>
  <desc id="desc">A transparent wall of circular contributor avatars.</desc>
  <rect width="100%" height="100%" fill="transparent"/>
${content}
</svg>`;
}

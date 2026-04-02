import type { Contributor, SvgLayoutOptions } from '@/lib/types';

const MIN_AVATAR_SIZE = 16;

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

type LayoutResult = {
  size: number;
  columns: number;
  rows: number;
  finalHeight: number;
};

export function calculateLayout(
  contributorCount: number,
  width: number,
  height: number | null,
  preferredSize: number,
  gap: number,
): LayoutResult {
  if (contributorCount === 0) {
    return { size: preferredSize, columns: 1, rows: 0, finalHeight: 88 };
  }

  const calcGrid = (size: number) => {
    const columns = Math.max(1, Math.floor((width + gap) / (size + gap)));
    const rows = Math.ceil(contributorCount / columns);
    const gridHeight = rows * size + Math.max(0, rows - 1) * gap;
    return { columns, rows, gridHeight };
  };

  if (height === null) {
    const { columns, rows, gridHeight } = calcGrid(preferredSize);
    return { size: preferredSize, columns, rows, finalHeight: gridHeight };
  }

  let { columns, rows, gridHeight } = calcGrid(preferredSize);

  if (gridHeight <= height) {
    return { size: preferredSize, columns, rows, finalHeight: gridHeight };
  }

  let low = MIN_AVATAR_SIZE;
  let high = preferredSize;
  let bestSize = MIN_AVATAR_SIZE;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const { gridHeight: testHeight } = calcGrid(mid);

    if (testHeight <= height) {
      bestSize = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const result = calcGrid(bestSize);
  return { size: bestSize, columns: result.columns, rows: result.rows, finalHeight: Math.min(result.gridHeight, height) };
}

export async function buildContributorSvg(
  contributors: Contributor[],
  options: SvgLayoutOptions,
): Promise<string> {
  const layout = calculateLayout(
    contributors.length,
    options.width,
    options.height,
    options.size,
    options.gap,
  );

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

  const { size, columns, finalHeight: height } = layout;
  const avatars = await Promise.all(contributors.map((contributor) => inlineAvatar(contributor.avatarUrl, size)));

  const content = contributors
    .map((contributor, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = column * (size + options.gap);
      const y = row * (size + options.gap);
      const clipId = `clip-${index}`;
      const label = `${contributor.login} · ${contributor.contributions} contribution${contributor.contributions === 1 ? '' : 's'}`;

      return `
  <g>
    <title>${escapeXml(label)}</title>
    <clipPath id="${clipId}">
      <circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" />
    </clipPath>
    <image href="${avatars[index]}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice" />
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

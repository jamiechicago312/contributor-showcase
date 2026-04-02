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

function buildStaticSvg(
  contributors: Contributor[],
  avatars: string[],
  options: SvgLayoutOptions,
): string {
  const columns = Math.max(1, Math.floor((options.width + options.gap) / (options.size + options.gap)));
  const rows = Math.ceil(contributors.length / columns);
  const height = rows * options.size + Math.max(0, rows - 1) * options.gap;

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

function buildAnimatedSvg(
  contributors: Contributor[],
  avatars: string[],
  options: SvgLayoutOptions,
): string {
  const numRows = options.rows ?? 3;
  const speed = options.speed ?? 30;
  const rowHeight = options.size + options.gap;
  const height = numRows * options.size + Math.max(0, numRows - 1) * options.gap;

  // Distribute contributors across rows
  const rowContributors: Contributor[][] = Array.from({ length: numRows }, () => []);
  const rowAvatars: string[][] = Array.from({ length: numRows }, () => []);

  contributors.forEach((contributor, index) => {
    const rowIndex = index % numRows;
    rowContributors[rowIndex].push(contributor);
    rowAvatars[rowIndex].push(avatars[index]);
  });

  // Calculate animation duration based on content width and speed
  const calculateRowWidth = (count: number) => count * (options.size + options.gap);

  let rowsContent = '';
  let defs = '';

  for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
    const rowItems = rowContributors[rowIndex];
    const rowItemAvatars = rowAvatars[rowIndex];

    if (rowItems.length === 0) continue;

    const rowWidth = calculateRowWidth(rowItems.length);
    const y = rowIndex * rowHeight;
    const direction = rowIndex % 2 === 0 ? 1 : -1; // Alternate directions
    const duration = rowWidth / speed; // Duration based on content width and speed

    // Build clip paths for this row
    rowItems.forEach((_, itemIndex) => {
      const globalIndex = rowIndex * 10000 + itemIndex;
      const clipId = `clip-${globalIndex}`;
      const x = itemIndex * (options.size + options.gap);

      defs += `
    <clipPath id="${clipId}">
      <circle cx="${x + options.size / 2}" cy="${options.size / 2}" r="${options.size / 2}" />
    </clipPath>`;
    });

    // Build avatars for this row (duplicated for seamless loop)
    let rowAvatarContent = '';
    for (let copy = 0; copy < 2; copy++) {
      rowItems.forEach((contributor, itemIndex) => {
        const globalIndex = rowIndex * 10000 + copy * 1000 + itemIndex;
        const clipId = `clip-${rowIndex * 10000 + itemIndex}`;
        const x = (copy * rowItems.length + itemIndex) * (options.size + options.gap);
        const label = `${contributor.login} · ${contributor.contributions} contribution${contributor.contributions === 1 ? '' : 's'}`;

        rowAvatarContent += `
      <g>
        <title>${escapeXml(label)}</title>
        <clipPath id="clip-copy-${globalIndex}">
          <circle cx="${x + options.size / 2}" cy="${options.size / 2}" r="${options.size / 2}" />
        </clipPath>
        <image href="${rowItemAvatars[itemIndex]}" x="${x}" y="0" width="${options.size}" height="${options.size}" clip-path="url(#clip-copy-${globalIndex})" preserveAspectRatio="xMidYMid slice" />
      </g>`;
      });
    }

    const animationName = `scroll-row-${rowIndex}`;
    const totalWidth = rowWidth * 2;
    const translateStart = direction === 1 ? 0 : -rowWidth;
    const translateEnd = direction === 1 ? -rowWidth : 0;

    rowsContent += `
  <g transform="translate(0, ${y})">
    <g class="${animationName}">
      ${rowAvatarContent}
    </g>
  </g>`;

    defs += `
  <style>
    .${animationName} {
      animation: ${animationName} ${duration}s linear infinite;
    }
    @keyframes ${animationName} {
      from { transform: translateX(${translateStart}px); }
      to { transform: translateX(${translateEnd}px); }
    }
  </style>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${height}" viewBox="0 0 ${options.width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Contributors for ${escapeXml(options.repoSlug)} (animated ticker)</title>
  <desc id="desc">An animated ticker showing contributor avatars scrolling horizontally in multiple rows.</desc>
  <defs>${defs}
  </defs>
  <rect width="100%" height="100%" fill="transparent"/>
${rowsContent}
</svg>`;
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

  const avatars = await Promise.all(contributors.map((contributor) => inlineAvatar(contributor.avatarUrl, options.size)));

  if (options.animate) {
    return buildAnimatedSvg(contributors, avatars, options);
  }

  return buildStaticSvg(contributors, avatars, options);
}

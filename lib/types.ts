export type RawGitHubContributor = {
  login?: string;
  avatar_url?: string;
  html_url?: string;
  contributions?: number;
  type?: string;
  name?: string;
  email?: string;
};

export type Contributor = {
  login: string;
  avatarUrl: string;
  profileUrl: string | null;
  contributions: number;
  isBot: boolean;
};

export type NormalizedRepo = {
  owner: string;
  repo: string;
  slug: string;
};

export type ShowcaseQuery = {
  repoInput: string;
  excludeBots: boolean;
  excludeLogins: string[];
  limit: number | null;
  width: number;
  height: number | null;
  size: number;
  gap: number;
};

export type SvgLayoutOptions = {
  repoSlug: string;
  width: number;
  height: number | null;
  size: number;
  gap: number;
};

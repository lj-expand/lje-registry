import { cached } from "./cache.ts";

export const GITHUB_API = "https://api.github.com";

export interface RepoInfo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  pushedAt: string | null;
  updatedAt: string | null;
  stargazersCount: number;
  language: string | null;
  archived: boolean;
  fork: boolean;
}

export interface SearchReposResult {
  totalCount: number;
  incompleteResults: boolean;
  items: RepoInfo[];
}

interface RawSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: RawRepo[];
}

interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  default_branch: string;
  pushed_at: string | null;
  updated_at: string | null;
  stargazers_count: number;
  language: string | null;
  archived: boolean;
  fork: boolean;
}

function toRepoInfo(raw: RawRepo): RepoInfo {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name,
    owner: raw.owner.login,
    htmlUrl: raw.html_url,
    description: raw.description,
    defaultBranch: raw.default_branch,
    pushedAt: raw.pushed_at,
    updatedAt: raw.updated_at,
    stargazersCount: raw.stargazers_count,
    language: raw.language,
    archived: raw.archived,
    fork: raw.fork,
  };
}

export function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "lje-registry",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status < 500 || attempt === 5) return res;
    await Bun.sleep(1000 * 2 ** (attempt - 1));
  }
}

export async function searchReposByTopic(
  topic: string,
  perPage = 100,
): Promise<SearchReposResult> {
  return cached(`search:${topic}:${perPage}`, async () => {
    const url = `${GITHUB_API}/search/repositories?q=topic:${encodeURIComponent(topic)}&per_page=${perPage}`;
    const res = await fetchWithRetry(url, githubHeaders());
    if (!res.ok) {
      throw new Error(
        `GitHub API error: ${res.status} ${res.statusText} for ${url}`,
      );
    }

    const data = (await res.json()) as RawSearchResponse;
    return {
      totalCount: data.total_count,
      incompleteResults: data.incomplete_results,
      items: data.items.map(toRepoInfo),
    };
  });
}

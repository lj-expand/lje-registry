import { cached } from "./cache.ts";
import {
  fetchWithRetry,
  GITHUB_API,
  githubHeaders,
  type RepoInfo,
} from "./github.ts";
import { parse } from "smol-toml";

export interface ScriptMetadata {
  name: string;
  version: string;
  author: string;
  dependencies: string[];
  binaries: string[];
}

interface RawInfoToml {
  script?: Record<string, unknown>;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/** Fetch and parse a repo's info.toml. Returns null if the repo has none. */
export async function fetchInfoToml(
  repo: RepoInfo,
): Promise<ScriptMetadata | null> {
  return cached(`info:${repo.fullName}`, async () => {
    const url = `https://raw.githubusercontent.com/${repo.fullName}/${repo.defaultBranch}/info.toml`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${res.status} ${res.statusText}`,
      );
    }

    const data = parse(await res.text()) as unknown as RawInfoToml;
    const script = data.script;
    const name = script ? stringField(script.name) : null;
    if (!name) {
      throw new Error(
        `Invalid info.toml in ${repo.fullName}: missing [script] name`,
      );
    }

    return {
      name,
      version: script ? (stringField(script.version) ?? "") : "",
      author: script ? (stringField(script.author) ?? "") : "",
      dependencies: script ? stringArray(script.dependencies) : [],
      binaries: script ? stringArray(script.binaries) : [],
    };
  });
}

interface ReadmeResponse {
  content: string;
  encoding: string;
}

/**
 * Fetch a repo's README text via the contents API (resolves any root-level
 * README name/casing). Returns null if the repo has none.
 */
export async function fetchReadme(repo: RepoInfo): Promise<string | null> {
  return cached(`readme:${repo.fullName}`, async () => {
    const url = `${GITHUB_API}/repos/${repo.fullName}/readme`;
    const res = await fetchWithRetry(url, githubHeaders());
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${res.status} ${res.statusText}`,
      );
    }

    const data = (await res.json()) as ReadmeResponse;
    return Buffer.from(data.content, "base64").toString("utf8");
  });
}

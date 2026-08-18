import { searchReposByTopic, type RepoInfo } from "./github.ts";
import { fetchInfoToml, fetchReadme } from "./script.ts";

export interface RegistryScript {
  name: string;
  version: string;
  authors: string[];
  dependencies: string[];
  binaries: string[];
  repo: string;
  url: string;
  pushedAt: string | null;
  description: string;
}

export interface Registry {
  generatedAt: string;
  scripts: RegistryScript[];
}

const MAX_DESCRIPTION_LENGTH = 500;

function splitAuthors(author: string): string[] {
  return author
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** First meaningful paragraph of a README, stripped of markdown formatting. */
function readmeDescription(readme: string): string | null {
  let inCodeBlock = false;
  for (const raw of readme.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock || !line || line.startsWith("#")) continue;
    if (/^!\[/.test(line)) continue; // image
    if (/^[-*_]\s*$/.test(line)) continue; // horizontal rule

    const cleaned = line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → label
      .replace(/`([^`]*)`/g, "$1") // inline code
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/^[-*+]\s+/, "") // bullet
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length > 1) return truncate(cleaned, MAX_DESCRIPTION_LENGTH);
  }
  return null;
}

async function describe(repo: RepoInfo): Promise<string> {
  const readme = await fetchReadme(repo);
  const fromReadme = readme ? readmeDescription(readme) : null;
  return fromReadme ?? repo.description ?? "";
}

export async function buildRegistry(topic = "lj-expand"): Promise<Registry> {
  const { items } = await searchReposByTopic(topic);

  const scripts: RegistryScript[] = [];
  for (const repo of items) {
    try {
      const info = await fetchInfoToml(repo);
      if (!info) continue; // not an LJE script without info.toml

      scripts.push({
        name: info.name,
        version: info.version,
        authors: splitAuthors(info.author),
        dependencies: info.dependencies,
        binaries: info.binaries,
        repo: repo.fullName,
        url: repo.htmlUrl,
        pushedAt: repo.pushedAt,
        description: await describe(repo),
      });
    } catch (err) {
      console.error(`[registry] skipping ${repo.fullName}: ${String(err)}`);
    }
  }

  scripts.sort((a, b) => a.name.localeCompare(b.name));
  return { generatedAt: new Date().toISOString(), scripts };
}

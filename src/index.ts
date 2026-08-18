import { writeFile } from "node:fs/promises";
import { buildRegistry } from "./registry.ts";

const registry = await buildRegistry();
await writeFile("registry.json", `${JSON.stringify(registry, null, 2)}\n`);
console.log(
  `Wrote registry.json — ${registry.scripts.length} scripts, generated ${registry.generatedAt}`,
);

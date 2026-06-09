// tools/generate-dep-changeset.ts
//
// Generates a RICH changeset describing the real SwapKit SDK changes pulled in by
// an @swapkit/* dependency bump. It diffs the external @swapkit/* dep versions in
// this branch against a base ref, fetches the (already-enriched) SDK CHANGELOGs
// for each bumped range, and writes one changeset listing the actual changes —
// instead of a generic "deps got bumped".
//
// Bump-path-agnostic: works for the dispatch auto-update, the scheduled update,
// and a human manually editing package.json. Deterministic output (no timestamps)
// so a CI check can regenerate-and-compare to enforce it.
//
// Env:
//   BASE_REF        git ref to diff dep versions against        (default: origin/develop)
//   SDK_REPO        owner/name of the SDK repo on GitHub        (default: swapkit/sdk)
//   SDK_REF         ref to read SDK CHANGELOGs from             (default: develop)
//   SDK_READ_TOKEN  token with read access to the private SDK   (or GITHUB_TOKEN)
//   SDK_REPO_PATH   local SDK checkout — read files from disk instead of GitHub (testing)

import { $, Glob } from "bun";

const DRY_RUN = process.argv.includes("--dry-run");
const BASE_REF = process.env.BASE_REF || "origin/develop";
const SDK_REPO = process.env.SDK_REPO || "swapkit/sdk";
const SDK_REF = process.env.SDK_REF || "develop";
const SDK_REPO_PATH = process.env.SDK_REPO_PATH;
const SDK_TOKEN = process.env.SDK_READ_TOKEN || process.env.GITHUB_TOKEN;

const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies"] as const;
type Json = { name?: string } & Partial<Record<(typeof DEP_FIELDS)[number], Record<string, string>>>;

const stripRange = (v: string) => v.replace(/^[^\d]*/, ""); // ^4.4.35 -> 4.4.35

function semverCmp(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((n) => Number.parseInt(n, 10));
  const pb = b.split(/[.-]/).map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (!Number.isNaN(d) && d !== 0) return Math.sign(d);
  }
  return 0;
}

// External @swapkit/* deps in a package.json (excludes this repo's own workspace packages).
function externalSwapkitDeps(json: Json, workspace: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of DEP_FIELDS) {
    for (const [k, v] of Object.entries(json[field] ?? {})) {
      if (k.startsWith("@swapkit/") && !workspace.has(k) && /\d/.test(v)) out[k] = stripRange(v);
    }
  }
  return out;
}

async function gitShow(ref: string, path: string): Promise<string | null> {
  try {
    return await $`git show ${ref}:${path}`.quiet().text();
  } catch {
    return null;
  }
}

async function sdkChangelog(name: string): Promise<string | null> {
  const dir = name.replace("@swapkit/", "");
  if (SDK_REPO_PATH) {
    const file = Bun.file(`${SDK_REPO_PATH}/packages/${dir}/CHANGELOG.md`);
    return (await file.exists()) ? file.text() : null;
  }
  const url = `https://raw.githubusercontent.com/${SDK_REPO}/${SDK_REF}/packages/${dir}/CHANGELOG.md`;
  const res = await fetch(url, SDK_TOKEN ? { headers: { Authorization: `token ${SDK_TOKEN}` } } : undefined);
  return res.ok ? res.text() : null;
}

// Real (non-"Updated dependencies") bullets of every changelog section whose
// version is in (oldVersion, newVersion]. If oldVersion is empty, take only newVersion.
function bulletsInRange(changelog: string, oldVersion: string, newVersion: string): string[] {
  const bullets: string[] = [];
  let take = false;
  let inDepBlock = false;
  for (const line of changelog.split("\n")) {
    const heading = line.match(/^## (.+)$/)?.[1]?.trim();
    if (heading) {
      if (semverCmp(heading, newVersion) > 0) {
        take = false; // newer than what we bumped to
      } else if (oldVersion ? semverCmp(heading, oldVersion) <= 0 : semverCmp(heading, newVersion) < 0) {
        break; // reached the old boundary (exclusive)
      } else {
        take = true;
      }
      inDepBlock = false;
      continue;
    }
    if (!take) continue;
    if (/^- Updated dependencies/.test(line)) {
      inDepBlock = true;
      continue;
    }
    if (inDepBlock && /^\s+- /.test(line)) continue; // nested dep ref
    if (/^- /.test(line)) {
      inDepBlock = false;
      bullets.push(line.trim());
    }
  }
  return bullets;
}

// --- Main ---------------------------------------------------------------------
const pkgFiles: string[] = [];
const workspace = new Set<string>();
for await (const f of new Glob("packages/*/package.json").scan(".")) {
  pkgFiles.push(f);
  const { name } = (await Bun.file(f).json()) as Json;
  if (name) workspace.add(name);
}

// 1. Which external @swapkit/* deps changed vs BASE_REF?  name -> { old, new }
const changed = new Map<string, { old: string; new: string }>();
for (const f of pkgFiles) {
  const current = externalSwapkitDeps((await Bun.file(f).json()) as Json, workspace);
  const baseText = await gitShow(BASE_REF, f);
  const base = baseText ? externalSwapkitDeps(JSON.parse(baseText) as Json, workspace) : {};
  for (const [name, newV] of Object.entries(current)) {
    const oldV = base[name] ?? "";
    if (oldV !== newV) changed.set(name, { new: newV, old: oldV });
  }
}

if (changed.size === 0) {
  console.info(`No @swapkit/* dependency version changes vs ${BASE_REF} — nothing to generate.`);
  process.exit(0);
}

// 2. Slice the SDK changelogs for each bumped range, aggregate + dedupe bullets.
const seen = new Set<string>();
const bullets: string[] = [];
for (const [name, { old, new: newV }] of [...changed].sort(([a], [b]) => a.localeCompare(b))) {
  const changelog = await sdkChangelog(name);
  if (!changelog) {
    console.warn(`⚠ could not read SDK CHANGELOG for ${name} — skipping`);
    continue;
  }
  for (const bullet of bulletsInRange(changelog, old, newV)) {
    const key = bullet.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    bullets.push(bullet);
  }
}

// 3. Which of THIS repo's packages depend on a changed dep → patch bump.
const bumps = new Set<string>();
for (const f of pkgFiles) {
  const json = (await Bun.file(f).json()) as Json;
  if (!json.name) continue;
  const deps = DEP_FIELDS.flatMap((field) => Object.keys(json[field] ?? {}));
  if (deps.some((d) => changed.has(d))) bumps.add(json.name);
}

if (bumps.size === 0) {
  console.info("No workspace packages depend on the changed deps — nothing to generate.");
  process.exit(0);
}

// 4. Build the changeset (deterministic filename from the bumped versions).
const summary = [...changed].sort(([a], [b]) => a.localeCompare(b)).map(([n, v]) => `${n}@${v.new}`);
const id = `swapkit-sdk-${Bun.hash(summary.join(",")).toString(36)}`;
const frontmatter = [...bumps]
  .sort()
  .map((n) => `"${n}": patch`)
  .join("\n");
const body =
  bullets.length > 0
    ? ["Update SwapKit SDK dependencies. Underlying changes:", "", ...bullets].join("\n")
    : `Update SwapKit SDK dependencies: ${summary.join(", ")}.`;
const content = `---\n${frontmatter}\n---\n\n${body}\n`;

if (DRY_RUN) {
  console.info(`# .changeset/${id}.md\n\n${content}`);
} else {
  await Bun.write(`.changeset/${id}.md`, content);
  console.info(`📝 wrote .changeset/${id}.md (${bumps.size} packages, ${bullets.length} change notes)`);
}

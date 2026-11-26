#!/usr/bin/env bun
/**
 * Host patch series tooling.
 *
 * Source of truth: packages/host/series.json plus one diff per feature and
 * package (features/<feature>/patches/<package>.diff), applied in series
 * order on the pristine upstream package. The Bun patches referenced by the
 * root package.json (patches/*.patch) are build output.
 *
 *   build                 regenerate patches/*.patch from the series
 *   check                 fail if patches/*.patch differ from a fresh build
 *   workspace <dir>       create one git repo per package with a commit per feature
 *   export <dir>          write feature diffs back from such a workspace, then build
 *
 * Pristine sources come from Bun's install cache (or --pristine-root DIR, a
 * directory containing <package>@<version>/ trees).
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export const hostRoot = new URL('..', import.meta.url).pathname;
export const repoRoot = new URL('../../..', import.meta.url).pathname;

export interface Series { version: string; scope: string; packages: string[]; features: string[] }

export async function readSeries(root = hostRoot): Promise<Series> {
  const series = JSON.parse(await readFile(join(root, 'series.json'), 'utf8')) as Series;
  if (!series.version || !series.scope || !Array.isArray(series.packages) || !Array.isArray(series.features)) {
    throw new Error('series.json must define version, scope, packages and features');
  }
  return series;
}

export function featureDiff(feature: string, pkg: string, root = hostRoot): string {
  return join(root, 'features', feature, 'patches', `${pkg}.diff`);
}

export function bunPatchFile(series: Series, pkg: string, root = repoRoot): string {
  return join(root, 'patches', `${series.scope}%2F${pkg}@${series.version}.patch`);
}

/** Bun keeps the unpatched tarball contents at <cache>/<scope>/<name>@<version>@@@1. */
export function pristineDir(series: Series, pkg: string, pristineRoot?: string): string {
  const candidates = pristineRoot
    ? [join(pristineRoot, `${pkg}@${series.version}`), join(pristineRoot, pkg)]
    : [join(process.env.BUN_INSTALL_CACHE_DIR ?? join(process.env.BUN_INSTALL ?? join(homedir(), '.bun'), 'install', 'cache'),
        series.scope, `${pkg}@${series.version}@@@1`)];
  const found = candidates.find(dir => existsSync(join(dir, 'package.json')));
  if (!found) {
    throw new Error(`pristine ${series.scope}/${pkg}@${series.version} not found (looked in ${candidates.join(', ')}). ` +
      'Run a dependency install once to populate the Bun cache, or pass --pristine-root.');
  }
  return found;
}

async function git(cwd: string, args: string[], input?: string): Promise<string> {
  const proc = Bun.spawn(['git', '-c', 'user.email=host-patches@lcp', '-c', 'user.name=host-patches', '-c', 'core.autocrlf=false', ...args], {
    cwd, stdin: input === undefined ? 'ignore' : new Blob([input]), stdout: 'pipe', stderr: 'pipe',
  });
  const [code, out, err] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  if (code !== 0) throw new Error(`git ${args.join(' ')} (in ${cwd}) failed:\n${err}`);
  return out;
}

/** A git repo holding the pristine package as its first commit. */
async function pristineRepo(series: Series, pkg: string, dir: string, pristineRoot?: string): Promise<void> {
  await cp(pristineDir(series, pkg, pristineRoot), dir, { recursive: true });
  await git(dir, ['init', '-q']);
  await git(dir, ['add', '-A']);
  await git(dir, ['commit', '-q', '-m', 'upstream']);
}

/** Apply every feature diff for `pkg` in series order; commit each when `commit` is set. */
async function applySeries(series: Series, pkg: string, dir: string, commit: boolean): Promise<string[]> {
  const applied: string[] = [];
  for (const feature of series.features) {
    const diff = featureDiff(feature, pkg);
    if (!existsSync(diff)) continue;
    try { await git(dir, ['apply', '--index', '--whitespace=nowarn', diff]); }
    catch (error) { throw new Error(`feature "${feature}" does not apply to ${pkg}: ${(error as Error).message}`); }
    if (commit) await git(dir, ['commit', '-q', '-m', feature]);
    applied.push(feature);
  }
  return applied;
}

/** Combined Bun patch text for one package, or undefined when no feature touches it. */
export async function buildPackagePatch(series: Series, pkg: string, pristineRoot?: string): Promise<string | undefined> {
  if (!series.features.some(feature => existsSync(featureDiff(feature, pkg)))) return undefined;
  const dir = await mkdtemp(join(tmpdir(), `host-patches-${pkg}-`));
  try {
    await pristineRepo(series, pkg, join(dir, pkg), pristineRoot);
    await applySeries(series, pkg, join(dir, pkg), false);
    // The exact format Bun's patchedDependencies uses.
    return await git(join(dir, pkg), ['diff', '--cached', '--full-index']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function build(options: { pristineRoot?: string; check?: boolean } = {}): Promise<{ changed: string[] }> {
  const series = await readSeries();
  const changed: string[] = [];
  for (const pkg of series.packages) {
    const text = await buildPackagePatch(series, pkg, options.pristineRoot);
    const target = bunPatchFile(series, pkg);
    const current = existsSync(target) ? await readFile(target, 'utf8') : undefined;
    if (text === current) continue;
    changed.push(target);
    if (options.check) continue;
    if (text === undefined) await rm(target, { force: true });
    else { await mkdir(join(repoRoot, 'patches'), { recursive: true }); await writeFile(target, text); }
  }
  // A version cutover must not leave obsolete generated aggregates behind.
  const patchRoot = join(repoRoot, 'patches');
  for (const name of existsSync(patchRoot) ? await readdir(patchRoot) : []) {
    if (!series.packages.some(pkg => name.startsWith(`${series.scope}%2F${pkg}@`)) ||
        name.endsWith(`@${series.version}.patch`) || !name.endsWith('.patch')) continue;
    const target = join(patchRoot, name);
    changed.push(target);
    if (!options.check) await rm(target);
  }
  return { changed };
}

export async function workspace(target: string, pristineRoot?: string): Promise<void> {
  if (existsSync(target)) throw new Error(`${target} already exists`);
  const series = await readSeries();
  await mkdir(target, { recursive: true });
  for (const pkg of series.packages) {
    const dir = join(target, pkg);
    await pristineRepo(series, pkg, dir, pristineRoot);
    const applied = await applySeries(series, pkg, dir, true);
    process.stdout.write(`${pkg}: upstream + ${applied.length ? applied.join(', ') : '(no features)'}\n`);
  }
  process.stdout.write(`\nEdit or rebase the per-feature commits (subject = feature name), then:\n  bun packages/host/scripts/host-patches.ts export ${target}\n`);
}

export async function exportWorkspace(source: string, pristineRoot?: string): Promise<void> {
  const series = await readSeries();
  for (const pkg of series.packages) {
    const dir = join(source, pkg);
    if (!existsSync(join(dir, '.git'))) continue;
    const commits = (await git(dir, ['rev-list', '--reverse', 'HEAD'])).trim().split('\n');
    const seen = new Set<string>();
    for (let index = 1; index < commits.length; index++) {
      const feature = (await git(dir, ['log', '-1', '--format=%s', commits[index]!])).trim();
      if (!series.features.includes(feature)) throw new Error(`${pkg}: commit "${feature}" is not a feature listed in series.json`);
      if (seen.has(feature)) throw new Error(`${pkg}: feature "${feature}" has more than one commit; squash it first`);
      seen.add(feature);
      const text = await git(dir, ['diff', '--full-index', commits[index - 1]!, commits[index]!]);
      await mkdir(join(hostRoot, 'features', feature, 'patches'), { recursive: true });
      await writeFile(featureDiff(feature, pkg), text);
    }
    for (const feature of series.features) {
      if (!seen.has(feature) && existsSync(featureDiff(feature, pkg))) await rm(featureDiff(feature, pkg));
    }
  }
  const { changed } = await build({ pristineRoot });
  process.stdout.write(changed.length ? `rebuilt:\n${changed.map(file => `  ${file}`).join('\n')}\n` : 'patches unchanged\n');
}

if (import.meta.main) {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: { 'pristine-root': { type: 'string' } } });
  const [command, path] = positionals;
  const pristineRoot = values['pristine-root'];
  try {
    if (command === 'build') {
      const { changed } = await build({ pristineRoot });
      process.stdout.write(changed.length ? `wrote:\n${changed.map(file => `  ${file}`).join('\n')}\n` : 'patches up to date\n');
    } else if (command === 'check') {
      const { changed } = await build({ pristineRoot, check: true });
      if (changed.length) {
        process.stderr.write(`out of date (run host:build):\n${changed.map(file => `  ${file}`).join('\n')}\n`);
        process.exitCode = 1;
      } else process.stdout.write('patches match the feature series\n');
    } else if (command === 'workspace' && path) await workspace(path, pristineRoot);
    else if (command === 'export' && path) await exportWorkspace(path, pristineRoot);
    else {
      process.stderr.write('usage: host-patches.ts build | check | workspace <dir> | export <dir> [--pristine-root DIR]\n');
      process.exitCode = 2;
    }
  } catch (error) {
    process.stderr.write(`host-patches: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

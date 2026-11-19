// Git for the admin: status, publishing and keeping this copy in step with GitHub (as Fotogalerie D25).
//
// GitHub is the central copy. Publishing = commit, fetch, rebase onto GitHub, push. Never a force-push.
//   - Nothing happens without an `origin` remote: until Martin adds one (D7) every function here is
//     inert and publishing says so.
//   - Conflicts in the generated docs/ are settled by rebuilding the site from the merged data;
//     a conflict in data/cabinet.json (or code) aborts the rebase, nothing is sent, the local
//     commit stays. (One file, one author: no field-level merge like Fotogalerie's.)
//   - Before a commit exists, the release audit (lib/release-check.mjs) must have no errors:
//     originals tracked by git, EXIF/GPS in published images, secrets, personal data.

import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_ROOT } from '../lib/config.mjs';
import { UserError } from '../lib/cabinet.mjs';
import { auditFindings, contentFindings } from '../lib/release-check.mjs';

let hooks = { buildNow: async () => {}, reload: async () => {} };
/** buildNow: regenerate docs/ now; reload: re-read data/cabinet.json into memory after git changed it. */
export function configureGit(h) { hooks = { ...hooks, ...h }; }

export function git(args, { allowFail = false, timeout = 0, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    // Do not set GIT_TERMINAL_PROMPT=0 (it would suppress the GitHub sign-in on the first push).
    // GIT_EDITOR=true lets `rebase --continue` finish without opening an editor.
    const p = spawn('git', args, { cwd: DATA_ROOT, windowsHide: true, env: { ...process.env, GIT_EDITOR: 'true', ...env } });
    let out = '', err = '', timer;
    if (timeout) timer = setTimeout(() => { err += `\n(přerušeno po ${timeout / 1000} s)`; p.kill(); }, timeout);
    p.stdout.on('data', d => (out += d));
    p.stderr.on('data', d => (err += d));
    p.on('error', e => (allowFail ? resolve({ code: -1, out, err: e.message }) : reject(new UserError(
      'Git není nainstalovaný nebo není v PATH. Na Macu spusť v Terminálu „xcode-select --install“. Pak spusť admin znovu.'))));
    p.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 && !allowFail) reject(new UserError(`git ${args.join(' ')} selhal:\n${(err || out).trim()}`));
      else resolve({ code, out: out.trim(), err: err.trim() });
    });
  });
}

// Originals must never reach git (D6). .gitignore keeps them out of `git add -A`, but publishing does
// not rely on it alone: whatever of them got staged anyway is unstaged again, and a last check stops
// the publish before a commit exists if one is still there. Do NOT name these paths in the `git add`
// pathspec, not even as `:(exclude)`: with .gitignore present git then refuses the whole add.
const PRIVATE_PATHS = ['assets-inbox', 'Inport_foto', '.media-tmp'];
export const isPrivate = f => PRIVATE_PATHS.some(p => f === p || f.startsWith(p + '/'));

const sync = { fetchedAt: null, fetchError: '', restartNeeded: false };

// ---------- status ----------

export async function gitStatus() {
  const repo = await git(['rev-parse', '--is-inside-work-tree'], { allowFail: true });
  if (repo.code !== 0 || repo.out !== 'true') return { repo: false, changes: 0, error: repo.code === -1 ? repo.err : '' };
  const [st, remote, upstream] = await Promise.all([
    git(['status', '--porcelain=v1', '--untracked-files=all'], { allowFail: true }),
    git(['remote', 'get-url', 'origin'], { allowFail: true }),
    git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { allowFail: true }),
  ]);
  let ahead = 0, behind = 0;
  if (upstream.code === 0) {
    const c = await git(['rev-list', '--left-right', '--count', 'HEAD...@{u}'], { allowFail: true });
    [ahead, behind] = c.out.split(/\s+/).map(Number).map(n => n || 0);
  }
  return {
    repo: true,
    changes: st.out ? st.out.split('\n').filter(l => !isPrivate(l.slice(3).replace(/^"|"$/g, ''))).length : 0,
    remote: remote.code === 0 ? remote.out : '',
    upstream: upstream.code === 0 ? upstream.out : '',
    ahead,
    behind, // commits on GitHub this copy does not have yet (as of the last fetch)
    ...sync,
  };
}

/**
 * data/cabinet.json as it was when this copy and GitHub last agreed: the merge base with the upstream.
 * null = nothing has been published from here yet (no upstream), so everything counts as new.
 */
export async function publishedBaseline() {
  const base = await git(['merge-base', 'HEAD', '@{u}'], { allowFail: true });
  if (base.code !== 0 || !base.out) return null;
  const r = await git(['show', `${base.out}:data/cabinet.json`], { allowFail: true });
  if (r.code !== 0) return null;
  try { return JSON.parse(r.out); } catch { return null; }
}

/** What stands between this copy and a release: audit errors always block, content errors need an OK. */
export async function preflight() {
  const [audit, content] = await Promise.all([auditFindings(), contentFindings()]);
  const keep = list => list.filter(f => f.level !== 'info');
  return { audit: keep(audit), content: keep(content) };
}

// ---------- one git operation at a time ----------

let busy = null;
export const gitBusy = () => !!busy;

async function exclusive(fn) {
  if (busy) throw new UserError('Právě probíhá synchronizace nebo publikování, zkus to za chvíli.');
  busy = fn();
  try { return await busy; } finally { busy = null; }
}

// ---------- fetching and pulling ----------

/** Ask GitHub what is new. Offline or without a remote this only records the error. */
export async function fetchRemote() {
  const remote = await git(['remote', 'get-url', 'origin'], { allowFail: true });
  if (remote.code !== 0) return false;
  const r = await git(['fetch', '--quiet', 'origin'], { allowFail: true, timeout: 30000 });
  sync.fetchedAt = new Date().toISOString();
  sync.fetchError = r.code === 0 ? '' : (r.err || 'GitHub není dostupný').split('\n')[0];
  return r.code === 0;
}

// Code arriving from GitHub needs a restart of the admin to take effect; site/ is read on every build.
const needsRestart = files => files.some(f => /^(admin\/|lib\/|package(-lock)?\.json$)/.test(f));

async function incomingFiles(fromRef, toRef) {
  const r = await git(['diff', '--name-only', fromRef, toRef], { allowFail: true });
  return r.out ? r.out.split('\n') : [];
}

/** Bring this copy up to GitHub. Only when it has nothing unpublished (a plain fast-forward). */
export function syncPull() {
  return exclusive(async () => {
    await hooks.buildNow();
    await fetchRemote();
    if (sync.fetchError) throw new UserError(`GitHub teď není dostupný: ${sync.fetchError}`);
    const st = await gitStatus();
    if (!st.upstream || !st.behind) return { pulled: 0, status: st };
    if (st.changes || st.ahead) {
      throw new UserError(`Na GitHubu je ${st.behind === 1 ? '1 novější změna' : `${st.behind} novějších změn`} a ty máš nepublikované úpravy. `
        + 'Klikni na Publikovat: nejdřív stáhne změny z GitHubu, spojí je s tvými a teprve pak odešle.');
    }
    const files = await incomingFiles('HEAD', '@{u}');
    await git(['merge', '--ff-only', '--quiet', '@{u}']);
    if (needsRestart(files)) sync.restartNeeded = true;
    await hooks.reload();
    await hooks.buildNow();
    return { pulled: st.behind, status: await gitStatus() };
  });
}

/** On admin start: fetch and fast-forward when safe. Never throws, the admin must start offline too. */
export async function startupSync() {
  try {
    if (!(await fetchRemote())) return { pulled: 0 };
    const st = await gitStatus();
    if (!st.upstream || !st.behind || st.changes || st.ahead) return { pulled: 0, behind: st.behind || 0 };
    const files = await incomingFiles('HEAD', '@{u}');
    await git(['merge', '--ff-only', '--quiet', '@{u}']);
    if (needsRestart(files)) sync.restartNeeded = true;
    return { pulled: st.behind };
  } catch (e) {
    return { pulled: 0, error: e.message };
  }
}

// ---------- publishing ----------

async function stageAndCommit(message, run) {
  await run(['add', '-A']);
  await git(['rm', '-r', '--cached', '--ignore-unmatch', '--quiet', '--', ...PRIVATE_PATHS], { allowFail: true });
  const leaked = (await git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])).out.split('\n').filter(isPrivate);
  if (leaked.length) {
    await git(['reset', '--quiet'], { allowFail: true });
    throw new UserError(`Publikování zastaveno: do commitu by se dostal soukromý soubor (${leaked.slice(0, 3).join(', ')}). Nic se neodeslalo.`);
  }
  const staged = await git(['diff', '--cached', '--quiet'], { allowFail: true });
  if (staged.code !== 1) return false;
  try {
    await run(['commit', '-m', message]);
  } catch (e) {
    if (/user\.email|Please tell me who you are/i.test(e.message)) {
      throw new UserError('Git nezná tvé jméno a e-mail. Ve složce Kabinetu spusť jednou:\n  git config user.name "Martin Porter"\n  git config user.email "<noreply adresa z GitHubu>"');
    }
    throw e;
  }
  return true;
}

const DATA_FILE = 'data/cabinet.json';

// Replay this copy's commits on top of GitHub's. Conflicts in generated docs/ are taken from GitHub's
// side for the moment (the site is rebuilt from the merged data right after); anything else aborts the
// rebase with the local commits untouched.
async function rebaseOntoUpstream(run) {
  let r = await git(['rebase', '@{u}'], { allowFail: true });
  for (let guard = 0; r.code !== 0 && guard < 50; guard++) {
    const conflicted = (await git(['diff', '--name-only', '--diff-filter=U'], { allowFail: true })).out.split('\n').filter(Boolean);
    const other = conflicted.filter(f => !f.startsWith('docs/'));
    if (!conflicted.length || other.length) {
      await git(['rebase', '--abort'], { allowFail: true });
      if (!conflicted.length) throw new UserError(`Spojení se změnami z GitHubu selhalo:\n${r.err || r.out}`);
      throw new UserError(`Na GitHubu se mezitím změnilo totéž co u tebe (${other.slice(0, 3).join(', ')}${other.includes(DATA_FILE) ? ' – data exponátů' : ''}). `
        + 'Nic se neodeslalo a tvoje změny zůstaly jen tady (uložené v lokálním commitu). Vyřešíme to v Claude Code.');
    }
    for (const f of conflicted) {
      const took = await git(['checkout', '--ours', '--', f], { allowFail: true }); // "ours" = GitHub during a rebase
      if (took.code === 0) await git(['add', '--', f]);
      else await git(['rm', '--quiet', '--', f], { allowFail: true }); // deleted on one side
    }
    run.log.push(`Konflikt ve vygenerovaném webu (${conflicted.length} souborů), web se přestaví z výsledných dat.`);
    r = await git(['rebase', '--continue'], { allowFail: true });
  }
  if (r.code !== 0) { await git(['rebase', '--abort'], { allowFail: true }); throw new UserError('Spojení se změnami z GitHubu se nepodařilo dokončit. Nic se neodeslalo.'); }
}

/**
 * Commit everything, take what GitHub has, push. `acknowledge` = the owner has seen the content
 * warnings (errors in titles, descriptions…) and publishes anyway. Audit errors cannot be overridden.
 */
export function publish(message, { acknowledge = false } = {}) {
  return exclusive(async () => {
    await hooks.buildNow();
    const log = [];
    const run = async args => { const r = await git(args); log.push(`$ git ${args.join(' ')}`, r.out, r.err); return r; };
    run.log = log;
    const status = await gitStatus();
    if (!status.repo) throw new UserError('Složka není git repozitář.');
    if (!status.remote) throw new UserError('Repozitář nemá nastavený remote „origin“, takže není kam publikovat. Zatím je všechno jen u tebe na Macu (D7).');

    const pf = await preflight();
    const blockers = pf.audit.filter(f => f.level === 'error');
    if (blockers.length) throw new UserError(`Publikování zastaveno, nic se neodeslalo:\n${blockers.map(f => `• ${f.msg}`).join('\n')}`);
    const contentErrors = pf.content.filter(f => f.level === 'error');
    if (contentErrors.length && !acknowledge) throw new UserError(`V obsahu jsou chyby (${contentErrors.length}). Oprav je, nebo potvrď, že chceš publikovat i tak:\n${contentErrors.map(f => `• ${f.msg}`).join('\n')}`);

    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    if (!(await stageAndCommit(message?.trim() || `Update cabinet ${stamp}`, run))) log.push('Žádné nové změny k uložení.');

    // Someone (another admin instance) may have published in the meantime: take that first.
    if (status.upstream && (await fetchRemote())) {
      const st = await gitStatus();
      if (st.behind) {
        const files = await incomingFiles('HEAD', '@{u}');
        log.push(`Na GitHubu ${st.behind === 1 ? 'je 1 novější změna' : `je ${st.behind} novějších změn`}, spojuji je s tvými.`);
        await rebaseOntoUpstream(run);
        if (needsRestart(files)) sync.restartNeeded = true;
        await hooks.reload();
        await hooks.buildNow();
        if (await stageAndCommit('Rebuild site after merging with GitHub', run)) log.push('Web přestavěn z výsledných dat.');
      }
    }

    const st = await gitStatus();
    if (st.upstream && !st.ahead) { log.push('Na GitHubu už všechno je, není co odeslat.'); return { log: log.filter(Boolean).join('\n'), status: st }; }
    try {
      if (status.upstream) await run(['push']);
      else await run(['push', '-u', 'origin', 'HEAD']);
    } catch (e) {
      if (/rejected|fetch first|non-fast-forward/i.test(e.message)) {
        throw new UserError('GitHub mezitím dostal další změny. Klikni na Publikovat ještě jednou, stáhne je a spojí s tvými.');
      }
      throw e;
    }
    return { log: log.filter(Boolean).join('\n'), status: await gitStatus() };
  });
}

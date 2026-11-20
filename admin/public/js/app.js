// The admin shell (phase 3b): one page, four sections switched by the top bar. The URL hash keeps the
// section and what is open in it (#stena/<item>, #exponaty/<slug>, #knihovna/<media>, #mistnost/<part>),
// so reload and back/forward work.

import { $, $$, load, bindStatus, status, on, doUndo, doRedo, canUndo, canRedo, unsaved, flush } from './core.js';
import * as stena from './stena.js';
import * as exponaty from './exponaty.js';
import * as aktuality from './aktuality.js';
import * as knihovna from './knihovna.js';
import * as mistnost from './mistnost.js';
import { openPublish } from './publish.js';

const SECTIONS = { stena, exponaty, aktuality, knihovna, mistnost };
let current = null;

function parseHash() {
  const [sec, ...rest] = decodeURIComponent(location.hash.replace(/^#/, '')).split('/');
  return { sec: SECTIONS[sec] ? sec : 'stena', arg: rest.join('/') || null };
}

async function route() {
  const { sec, arg } = parseHash();
  if (current !== sec) {
    if (current) { SECTIONS[current].hide?.(); $(`#sec-${current}`).hidden = true; }
    current = sec;
    $(`#sec-${sec}`).hidden = false;
    $$('.top nav a').forEach(a => { if (a.dataset.sec === sec) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  await SECTIONS[sec].show(arg);
  syncUndo();
}

/** Undo/redo are about the wall; elsewhere they stay disabled. */
function syncUndo() {
  const onWall = current === 'stena';
  $('#undo').disabled = !onWall || !canUndo();
  $('#redo').disabled = !onWall || !canRedo();
}
on('layout', syncUndo);
$('#undo').addEventListener('click', doUndo);
$('#redo').addEventListener('click', doRedo);

// ---------- files dropped anywhere open the import (Knihovna) ----------
let dragDepth = 0;
const isFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
addEventListener('dragenter', e => { if (!isFiles(e)) return; dragDepth++; document.body.classList.add('dropping'); });
addEventListener('dragleave', e => { if (!isFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dropping'); } });
addEventListener('dragover', e => { if (isFiles(e)) e.preventDefault(); });
addEventListener('drop', e => {
  if (!isFiles(e)) return;
  e.preventDefault(); dragDepth = 0; document.body.classList.remove('dropping');
  // a section may take the files itself (Exponáty: straight into the open exhibit's gallery)
  const files = [...e.dataTransfer.files];
  if (!files.length) return;
  if (SECTIONS[current].takeFiles?.(files)) return;
  knihovna.openImport(files);
});

addEventListener('beforeunload', e => { if (unsaved()) { flush(); e.preventDefault(); e.returnValue = ''; } });
addEventListener('hashchange', route);
// the site in a phone-sized window: narrow enough for the phone version (site/js/mobile.js)
$('#phone-preview')?.addEventListener('click', e => { e.preventDefault(); open('/preview/', 'kabinet-phone', 'popup,width=390,height=844'); });

// ---------- start ----------
bindStatus($('#save'));
status('saving', 'Načítám…');
try {
  await load();
  status('ok');
} catch (err) {
  status('err', 'Nepodařilo se načíst data: ' + err.message);
  throw err;
}
for (const s of Object.values(SECTIONS)) s.init?.();
await route();
$('#publish')?.addEventListener('click', openPublish);

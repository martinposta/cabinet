// What publishing would change on the web, in the owner's terms (the preview before publishing).
//
// docs/ is regenerated as a whole and data/cabinet.json is one long file, so a file diff only says
// "something changed". This compares the data itself: exhibits by slug and field by field, the wall
// by item, the library by media id, the settings by key.
//   before = data/cabinet.json as GitHub has it (null = nothing published yet), after = what the
//   next publish sends. Items stored off the wall never go public, so they are not counted.

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const text = v => (v === undefined || v === null || v === '' ? '' : String(v));

const EXHIBIT_FIELDS = [
  ['title', 'Název'],
  ['medium', 'Technika'],
  ['description', 'Popis'],
  ['inv', 'Inventární číslo'],
  ['slug', 'Adresa'],
  ['plaque', 'Cedulka', v => (v ? 'ano' : 'ne')],
];
// show: false = say that it changed, not to what
const SETTINGS_FIELDS = [
  ['siteUrl', 'Veřejná adresa'],
  ['description', 'Popis webu'],
  ['customDomain', 'Vlastní doména'],
  ['plateTitle', 'Titulek jmenovky'],
  ['plateSubtitle', 'Podtitulek jmenovky'],
  ['analyticsToken', 'Statistika návštěv', null, false],
  ['fx', 'Efekty', v => Object.entries(v || {}).filter(([, on]) => on !== false).map(([k]) => k).join(', ') || 'žádné'],
];

function fieldChanges(b, a, fields) {
  const out = [];
  for (const [key, label, fmt = text, show = true] of fields) {
    if (same(b[key], a[key])) continue;
    out.push(show ? { label, from: (fmt || text)(b[key]), to: (fmt || text)(a[key]) } : { label });
  }
  return out;
}

const live = data => (data?.items || []).filter(i => !i.off);
const nameOf = i => i.exhibit?.title || i.id;

export function diffCabinet(before, after) {
  const first = !before; // nothing published yet: the whole site is new
  before = before || { settings: {}, items: [], media: {} };
  const bi = new Map(live(before).map(i => [i.id, i])), ai = new Map(live(after).map(i => [i.id, i]));

  const exhibits = { added: [], removed: [], edited: [] };
  for (const i of ai.values()) if (i.exhibit && !bi.get(i.id)?.exhibit) exhibits.added.push({ id: i.id, label: nameOf(i) });
  for (const i of bi.values()) if (i.exhibit && !ai.get(i.id)?.exhibit) exhibits.removed.push({ id: i.id, label: nameOf(i) });
  for (const a of ai.values()) {
    const b = bi.get(a.id);
    if (!a.exhibit || !b?.exhibit) continue;
    const fields = fieldChanges(b.exhibit, a.exhibit, EXHIBIT_FIELDS);
    const gb = b.exhibit.gallery || [], ga = a.exhibit.gallery || [];
    if (!same(gb, ga)) fields.push({ label: 'Galerie', from: `${gb.length} fotek`, to: `${ga.length} fotek` });
    if (!same(b.exhibit.tags, a.exhibit.tags)) fields.push({ label: 'Štítky', from: text((b.exhibit.tags || []).join(', ')), to: text((a.exhibit.tags || []).join(', ')) });
    if (fields.length) exhibits.edited.push({ id: a.id, label: nameOf(a), fields });
  }

  // the rest of the wall: things that are not exhibits, and where everything hangs
  const things = { added: 0, removed: 0, moved: 0 };
  for (const i of ai.values()) if (!i.exhibit && !bi.has(i.id)) things.added++;
  for (const i of bi.values()) if (!i.exhibit && !ai.has(i.id)) things.removed++;
  for (const a of ai.values()) {
    const b = bi.get(a.id);
    if (!b) continue;
    const pos = i => [i.x, i.y, i.w, i.rotation, i.on, i.drawer, i.dx, i.dy, i.sits, i.plaqueAt, i.media];
    if (!same(pos(a), pos(b))) things.moved++;
  }

  const bm = before.media || {}, am = after.media || {};
  const media = {
    added: Object.keys(am).filter(id => !bm[id]).length,
    removed: Object.keys(bm).filter(id => !am[id]).length,
    replaced: Object.keys(am).filter(id => bm[id] && (bm[id].v || 1) !== (am[id].v || 1)).length,
  };

  const settings = fieldChanges(before.settings || {}, after.settings || {}, SETTINGS_FIELDS);
  const rooms = [];
  for (const [k, label] of [['room', 'Místnost'], ['surround', 'Obložení'], ['plates', 'Jmenovka a cedulky'], ['doors', 'Dveře'], ['wall', 'Tapeta'], ['cabinet', 'Skříň'], ['handCandle', 'Svíčka v ruce'], ['view', 'Výchozí pohled'], ['nameplate', 'Poloha jmenovky']]) {
    if (!same(before[k], after[k])) rooms.push(label);
  }

  const count = exhibits.added.length + exhibits.removed.length + exhibits.edited.length
    + things.added + things.removed + things.moved + media.added + media.removed + media.replaced + settings.length + rooms.length;
  return { first, exhibits, things, media, settings, rooms, count };
}

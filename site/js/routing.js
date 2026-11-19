// Every exhibit has its own page, e/<slug>/ (PLAN phase 4): opening one pushes its URL, closing goes back
// to cabinet/, and the browser's back/forward buttons open and close the viewer. Both URLs exist as real
// files, so a reload or a shared link lands on the same view. Shared by the wall and the phone list.

import { createViewer } from './viewer.js';

/**
 * exhibits: runtime items with .slug; onClose(it): after the viewer closed, with the exhibit it showed;
 * query: carried onto every pushed URL (`?mobile` keeps the phone list when checked on a computer).
 */
export function exhibitRouter({ data, ui, exhibits, onClose, query = '' }) {
  const siteTitle = data.settings.plateTitle || "Cabinet of Curiosities";
  const bySlug = new Map(exhibits.map(it => [it.slug, it]));
  const keep = new URLSearchParams(query).has("mobile") ? "?mobile" : "";
  const pageUrl = path => new URL(path + keep, document.baseURI).href;
  let popping = false, current = null;
  const viewer = createViewer({ ui, media: data.media || {}, onClose: () => {
    document.body.classList.remove("viewer-open");
    document.title = siteTitle;
    if (!popping) history.pushState(null, "", pageUrl("cabinet/"));
    const it = current; current = null; onClose?.(it);
  } });
  function open(it, push) {
    current = it;
    viewer.open(it);
    document.body.classList.add("viewer-open");
    document.title = `${it.title} · ${siteTitle}`;
    if (push) history.pushState({ slug: it.slug }, "", pageUrl(`e/${it.slug}/`));
  }
  addEventListener("popstate", () => {
    const slug = location.pathname.match(/\/e\/([^/]+)\/?$/)?.[1];
    const it = slug && bySlug.get(decodeURIComponent(slug));
    popping = true;
    if (it) { if (ui.viewerOpen) viewer.close(); open(it, false); }
    else if (ui.viewerOpen) viewer.close();
    popping = false;
  });
  // the exhibit this page was opened on (e/<slug>/), if any
  const start = bySlug.get(document.documentElement.dataset.exhibit) || null;
  return { open, prefetch: it => viewer.prefetch(it), start };
}

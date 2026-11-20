# Cabinet of Curiosities – build plan (brief for Claude Code)

Martin's personal projects portfolio as a night visit to a cabinet of
curiosities: green wallpaper, framed pictures, shelves with objects, a chest
of drawers, candlelight in hand. Target **cabinet.martinposta.com** on
**GitHub Pages** – no server, no database. Content is edited in a **local
admin** that writes into the repo; publishing = `git push`.

**Built exactly like Martin's photo gallery** (`~/Desktop/Martin/Fotogalerie`,
live at foto.martinposta.com). Read its `CLAUDE.md` and `PLAN.md` first and
**reuse its code and conventions** wherever they fit (admin server, image
pipeline, git publish/sync, build, tests, launchers). Differences are listed
in section 2.

> Brief from the planning chat (Claude.ai, project "Homelab projects").
> Once the repo exists, move the facts into `CLAUDE.md`, keep decisions and a
> log in this file (like Fotogalerie's `PLAN.md`). The plan is in English
> because the website and the code are English; talk to Martin in Czech.

---

## 0. Revision log
- **The opened board gets its own picture (2026-11-20, Martin: „nemůžu najít detailní texturu“)** – the brief allowed a surface image and I had built only the CSS board. Now: media kind `board` („Tabule s aktualitami – detail“, up to 2400 px) and `data.noticesBoard = { media, area }` (`setNoticesBoard`, `PATCH /api/notices-board`; a new picture drops the old area; the area validated in 4 decimals). With a picture the panel is that picture at its own proportions, as large as the window allows (≤ 1100 px tall), and the chalk text fills only the area drawn on it (`rectDialog`, single) – without one, the CSS board as before. The wall reads it from data.json, the doors page gets it written in (`noticesLook`). Admin: Aktuality → „Tabule zblízka“ (pick from the library, „Plocha pro text…“, clear); Knihovna knows the kind (chip „Tabule“, import card „Tabule – detail“). Stand-in close-up generated (walnut frame, dusty wiped slate, chalk on the ledge, no writing) and set in Martin's data with its area. Verified on his wall: picture loaded (1640 px), board 791 × 868, the text area at 0.116 / 0.106 / 0.768 as drawn – with Martin's first notice (19 November) on it.
- **Aktuality: „+ Nový zápis“ did nothing until a reload (2026-11-20, Martin)** – the section re-renders on `data` only while focus is outside it (so typing never loses the caret), and a real click leaves focus on the button – inside the section – so after creating an entry nothing was drawn (my own check had clicked from a script, which does not focus the button). Create, delete and a date change now render themselves. Verified with real mouse clicks on a copy: the entry appears focused, typed text saves, delete updates at once.
- **8c done – plaques show only the number (2026-11-20)** – every plaque reads „Inv. no. NNN“ (`plaqueText()` in wall.js, the number still in the plaque's number colour): on the wall, above things standing on something, on the cabinet, the paper tags in the drawers, the phone list and the admin's plate preview; plaques are `aria-hidden` (the title stays in the item's own label, the viewer, `list/`, page titles and OG tags). Sizes and offsets (`plates.plaque`, `plaqueAt`) unchanged – plaques are just shorter. Verified on Martin's wall: 13 of 13 plaques read „Inv. no. NNN“, exhibit labels keep their titles. **Phase 8 done.**
- **8b done – wallpaper around the doors (2026-11-20)** – the doors page's body carries the room's wallpaper tile as a static background at its size on the wall at zoom 1 (`tileWorld` CSS px; the page neither pans nor zooms, so no per-frame cost), plus the room's grime as a fixed layer under the doors (its smallest derivative) when one is set; built by `doorsWall()` in build.mjs into `{{BODY_STYLE}}` / `{{GRIME}}`. The darkness and candle stay on top (no z-index on the scene – that would lift the doors above the darkness). Measured: one more request, 6 kB (the tile), load 37 ms locally.
- **8a done – notices board (2026-11-20)** – `data.notices` (`addNotice`/`updateNotice`/`deleteNotice`, `POST/PATCH/DELETE /api/notices`; valid date, text up to 6000 chars, an empty text allowed while writing but a content error in `check-release` and left out of the site), `publicNotices()` newest first (same date: the later written first). The board is an ordinary hung item with `item.opens = "notices"` (validated: one at most, never an exhibit, hangs on the wall); Stěna inspector → Exponát „Otevírá aktuality“ (switching it on elsewhere moves it), taken off the wall like an exhibit (stored `off`, hung back where it was). On the wall it lifts and opens `site/js/notices.js` (veil, walnut frame, slate in CSS, Caveat text / Caveat Brush dates in en-GB, paragraphs per line, chalk squiggle between entries, scrolls inside with a fade, × / Esc / veil close, the camera frozen meanwhile). On the doors page a copy (`#nbDoors`) hangs only while the wall board is on the wall, placed by `doors.noticesAt` {x,y,h} in fractions of the entry box (default right of the casing, around handle height, ¼ of its height; drag/resize in Místnost → Úvodní dveře), opens the same panel there with notices written into the page (no data.json), hidden on a phone or when it does not fit. Admin tab Aktuality: board state card (on the wall: Ukázat / Sundat; off: Pověsit zpět), „+ Nový zápis“ (today, focused), date + auto-growing text, autosave, in-page delete confirmation, re-sorted on a date change. Publish preview counts added/edited/removed notices. Fonts downloaded with Martin's OK (4 woff2, 166 kB, OFL, CREDITS.md). Stand-in board generated (slate, walnut, chalk scribbles) and hung left of the nameplate in Martin's data with `opens` on. Verified: wall board opens („Nothing new yet.“ in Caveat), a copy with two notices shows dates and paragraphs, Esc closes, the doors copy sits right of the casing at ¼ height and opens there, Aktuality creates/saves/takes off/hangs back, the doors board drags and saves. 38 tests.
- **Brief: notices board, wallpaper around the doors, number-only plaques (planning chat, 2026-11-20)** – new **phase 8** below. Approved mockup: canvas „Kabinet – aktuality“ https://claude.ai/artifact/2c8yxjWZNGmPw51gFwkYmK (if the link does not open from the Code session, ask Martin for screenshots – the text below is complete on its own).
- **Author and other sites for search engines (2026-11-20, Martin)** – a sitemap may only list the site's own URLs, so martinposta.com and foto.martinposta.com go where search engines read identity: every page now carries `<link rel="me">` to each and schema.org JSON-LD (a `WebSite` whose `author` is a `Person` with `name` and `sameAs`). Settings `authorName` / `authorLinks` (full https addresses, at most 8), in Místnost → Adresa a popis; set to Martin Porter (the name in LICENSE) + both sites. Nothing visible – visible links are a later task. Exhibit slugs were renamed by Martin to readable ones (worldmap, skulloflarsmoller…) before Google indexed them.
- **No more „missing photos / missing medium“ warnings (2026-11-20, Martin)** – „ne u všech to budu psát“: gallery photos and the medium are optional. Removed from the release audit (`release-check.mjs`; a gallery pointing at a photo that is gone is still an error, a missing description too) and from the admin (`missing()` now only knows a missing description or title, the „Bez fotek“ chip stays as a plain filter, no longer amber). Audit on the real data: 0 errors, 0 warnings.
- **Release check lets GitHub's own commits through (2026-11-19, Martin)** – publishing stopped on „V historii je osobní e-mail autora: noreply@github.com“: the two commits GitHub made itself while the custom domain was set in the Pages settings („Create CNAME“, „Delete CNAME“) carry `GitHub <noreply@github.com>` as committer. That is GitHub's address, not a personal one; `release-check.mjs` now accepts it next to `…@users.noreply.github.com`. Audit: 0 errors.
- **Live at https://cabinet.martinposta.com/ (2026-11-19, Martin: „pokračuj“)** – Cloudflare record created with the write token (checked first that none existed): `CNAME cabinet → martinposta.github.io`, **DNS only**, comment „The Cabinet of Curiosities, GitHub Pages“. **GitHub never started the certificate** (35 min, `https_certificate: null`, health report `{}`): the custom domain had been set before the record existed and the first domain check stayed stuck. Fix: removed and re-added the domain through the Pages API (`PUT pages {cname:null}` then `{cname:"cabinet.martinposta.com"}`) – state went to `authorized` at once, `approved` within a minute, Let's Encrypt (YR1) for `cabinet.martinposta.com`; **`https_enforced: true`** switched on afterwards. Side effect: GitHub made two commits on `main` (`Delete CNAME`, `Create CNAME`), pulled with `git pull --rebase` – so **`docs/CNAME` now has no trailing newline** and the next rebuild (which writes one) will show it as a one-byte change, harmless. Lesson for next time: **create the DNS record first, then set the domain in Pages** (or re-add it if the certificate does not appear within ~15 min). Checked from outside (curl with `--resolve` – the Mac's own resolver had cached the earlier NXDOMAIN, which made every plain test fail until the cache expired): `/`, `/cabinet/`, `/list/`, `/e/…`, `data.json`, media, favicon 200; `sitemap.xml` and unknown paths 404 (noindex ⇒ no sitemap); `noindex, nofollow` on all four page types; `robots.txt` without `Sitemap:`; in the in-app browser the doors load, the exhibit link `/e/dscf2756/` opens the viewer, 69 requests, none failed. Still on: **noindex**. Open: Cloudflare Web Analytics token (D13), real-device tests, content (12 exhibits without gallery photos), then switch noindex off and submit the sitemap.
- **First publish (2026-11-19, Martin said „publikuj“)** – `git push -u origin main` to `https://github.com/martinposta/cabinet` (one clean history, 4 commits, noindex on); Pages enabled through `gh api` (source `main` `/docs`, `build_type: legacy`); first build `built`, `docs/CNAME` = `cabinet.martinposta.com` picked up (domain state verified, HTTPS not enforced yet). `https://martinposta.github.io/cabinet/` answers 301 → `http://cabinet.martinposta.com/`, which has **no DNS record yet**, so the site is not reachable until the Cloudflare CNAME `cabinet` → `martinposta.github.io` (DNS only) exists. Next: that record (Martin confirms first), wait for the certificate, Enforce HTTPS, check from outside.
- **License, fan-art notice and `origin` (2026-11-19, Martin)** – `LICENSE`: © Martin Porter, all rights reserved, personal non-commercial project; a FAN WORKS paragraph (unofficial fan art and fan fiction, unaffiliated, no income of any kind, characters/names/trademarks belong to their owners, takedown on request via GitHub issues; no e-mail address given on purpose); font licenses point to `CREDITS.md`. `README.md` starts with an English public notice (personal projects and fan art only, nothing commercial), the Czech guide follows. Same shape as Fotogalerie's LICENSE (all rights reserved), plus the fan paragraph. The site itself carries no such note (Martin asked for GitHub only; a footer on the doors/list page is easy to add). `origin` = `https://github.com/martinposta/cabinet.git` added locally; the repository exists, is public and empty (read-only check via the GitHub API). **Not pushed** – waiting for Martin's „publikuj“ (D7).
- **Clean first snapshot and soft-launch switch (2026-11-19, Martin – phase D, local part; still nothing pushed, D7)** – (1) **`settings.noindex`** (admin: Místnost → Adresa a popis, „Skrýt před vyhledávači“): every page gets `<meta name="robots" content="noindex, nofollow">` (the 404 already had it), `sitemap.xml` is not written and `robots.txt` drops its `Sitemap:` line; crawling stays allowed on purpose, or a crawler could never read the noindex. `check-release` reports it as a warning until it is switched off for the real launch. Switched **on** in Martin's data. (2) **New repository.** The old one was moved to `~/Desktop/Martin/Kabinet-stara-historie.git` (outside the project, kept as a backup – 46 commits, 140 MB, `Inport_foto` in them) and `git init -b main` made a fresh one with **one commit** („Cabinet of Curiosities“, 278 files, `.git` 12 MB) under the noreply identity; `Inport_foto/` is now in `.gitignore` (the originals stay on the Mac, never tracked). `check-release`: 0 errors (4 warnings: noindex, 12 exhibits without gallery photos, 11 without medium, pasted Wikipedia text in „Certificat of forgery“). The commit carries all of Martin's pending work (data, docs, plaque work, publish flow). No remote, no push. To go back to the old history: delete `.git`, move the backup back as `.git`. 36 tests (new: noindex on/off).
- **Publish flow (2026-11-19, Martin – phase C of the publish plan; inert until an `origin` exists, D7)** – the top bar's **Publikovat** is live. `admin/git.mjs` (ported from Fotogalerie, simplified): `gitStatus`, `publishedBaseline` (data/cabinet.json at the merge base with the upstream), `fetchRemote`, `syncPull`/`startupSync` (fast-forward only when nothing is unpublished; the admin starts offline and without origin), `publish` = **release audit → `add -A` → commit → fetch → rebase onto GitHub → rebuild → push (`-u origin HEAD` the first time), never a force-push**. Rules: no origin ⇒ „není kam publikovat“, nothing is attempted; **audit errors (`lib/release-check.mjs`) always stop it before a commit exists** (tracked originals, EXIF/GPS, secrets, personal data, non-noreply e-mail); **content errors** (file-name titles, missing descriptions…) stop it unless the owner ticks „publikovat i tak“ (`acknowledge`); `assets-inbox`, `Inport_foto`, `.media-tmp` are unstaged again even if staged and a last check aborts if one is still in the index (never name them in the `git add` pathspec – Fotogalerie lesson); a rebase conflict in `docs/` takes GitHub's side and the site is rebuilt from the merged data, **a conflict in `data/cabinet.json` or code aborts the rebase** (nothing is sent, the local commit stays; there is no field-level merge, one file and one author). One git operation at a time (`exclusive`), edits get 409 meanwhile. `lib/changes.mjs` `diffCabinet(before, after)` is the preview: exhibits by slug and field, things on the wall (added/removed/moved), library (new/removed/replaced), settings, room parts; `first: true` when nothing is published yet (then the dialog only says „first publish: the whole site, 13 exhibits, 63 images“). API: `GET /api/git`, `/api/changes`, `/api/preflight`, `POST /api/sync/check`, `/api/sync`, `/api/publish {message, acknowledge}`. UI: `admin/public/js/publish.js` (dialog: changes, blockers, content errors + checkbox, warnings folded, message, log). `store.mjs` got `reloadData()` (git rewrites the data file under the cache). Commits made by the flow are in English (`Update cabinet <time>`), the repo identity stays the noreply one. **Verified:** 35 tests (new: publish end to end against a bare repo as a fake origin – inert without origin, refused while an original is in the index and nothing reaches the origin, then first publish, preview against GitHub, publish after another clone pushed meanwhile = rebase + push; `diffCabinet`); in the real admin UI on a copy of the real repository (own admin on 4334, 4322 untouched, fake origin in the scratchpad): with `Inport_foto` still tracked the dialog listed it as blocking and the button was disabled, after `git rm --cached` + ignore the first publish went through (95 files, origin has `main`, no `Inport_foto` in its tree). **That same run showed why a clean first commit is still needed:** the old commits that contain `Inport_foto` went to the origin as well (history is not rewritten by untracking) – so the real first publish must start from a fresh repository, not from these 46 commits. A real `check-ignore` probe fix came out of it: `assets-inbox/x` instead of `assets-inbox` (a pattern with a trailing slash does not match a path that does not exist).
- **Release check and repository audit (2026-11-19, Martin – phase B of the publish plan)** – `npm run check-release` (`lib/release-check.mjs`, CLI `lib/cli-check-release.mjs`, read-only, exit 1 on errors). **Content:** exhibits on the wall (stored `off` ones are skipped, they never go public) – title missing or a camera file name (`Dscf2810`), missing description, citation marks `[10]` (pasted Wikipedia text), missing medium (grouped, one line), no gallery photos (grouped), gallery/wall media missing from the library, duplicate slugs/inv; settings (siteUrl must be https and end with `/`, description, customDomain matches siteUrl, analytics token = info only); doors (closed/ajar/frame, sound = info); every media has its `docs/media` files; `og.jpg` for covers and doors; the built `docs/` has every page. **Audit of what goes public:** originals tracked by git outside `docs/ site/ admin/`, `assets-inbox` ignored, author/committer e-mails must be GitHub noreply (history and local config), EXIF/XMP/GPS in every published image (`exifHasGps` walks IFD0 for tag 0x8825 – no dependency), secrets (GitHub/Cloudflare tokens, private keys, API keys), personal paths (`/Users/…`), home-network IPs and e-mail addresses in every tracked text file, and what `docs/data.json` reveals (original file names, upload dates – info). **First run found one real blocker: `Inport_foto/` (33 originals, 118 MB, iPhone EXIF) is tracked in git** – a public repo would have carried it and every earlier version; the clean first commit (fresh repository, no history) is the fix, with `Inport_foto/` ignored. Everything else in the audit is clean: no EXIF/GPS in any of the 149 published images, no secrets, no personal paths or e-mails, all 46 commits by the noreply identity. Content status: 13 exhibits, 12 without gallery photos, 11 without medium, „Certificat of forgery“ has pasted Wikipedia text (CC BY-SA – rewrite or credit). **Measured on `docs/` served statically:** doors page 367 KB / 8 requests / load 181 ms; wall 3.5 MB / 65 requests (51 images 3.2 MB, JS 108 KB). Frame rate while panning could not be measured from here (the pane is hidden, `requestAnimationFrame` does not run) – to be checked on the Mac. 33 tests (new: the three helpers, and content findings on a made-up data set).
- **Plaque half the size, and movable (2026-11-19, Martin)** – (1) Martin's plaque is a plate image (9-slice), so „half“ is the existing setting: `plates.plaque.size` 20 → **10** (the height is 2.2 × the size, 44 → 22 px, and the ends scale with it); set through his own admin's `PATCH /api/plates`, so it can be changed back in Místnost → Jmenovka a štítky. Measured on a copy: 22 px high, 10 px type, still 14 px from the exhibit's right edge. (2) **`item.plaqueAt = {dx, dy}`** – the plaque's offset in world px from its default place (the lower right corner), validated in `applyItemPatch` (±1500, one decimal; 0 / 0 or null deletes the field), so single PATCH and layout save share it. It is **relative to the exhibit**, so the plaque travels with it when the exhibit is moved or resized. `wall.js` now builds every plaque through `makePlaque` (sets `data-pq=<item id>` and the two custom properties `--pq-dx/--pq-dy`), and the CSS adds them to the transform: `.hang > .plaque` and the plaques of things standing on the cabinet (`.cabinet .plaque.above`, which keeps its centring); the tray tags and the phone list ignore it. Editor (Stěna): the plaque is hit-testable in the admin only (`body.adm #world .plaque[data-pq]`), pressing it starts its own drag (`startPlaqueDrag`, stops propagation so the camera does not pan, a 3 px threshold keeps a click a click), one `commit('plaque')` per drag (undo, save with `rev`), **double click resets**, and the inspector's Umístění tab has a „Cedulka“ block with „Vrátit cedulku na místo“ while it is moved. Verified in the real editor on a copy of the data: dragged by mouse (−140.2 / 61.2 saved, the exhibit unmoved), exhibit dragged afterwards (hang moved 131 px, plaque stayed at the same distance from it, `plaqueAt` unchanged), double click removed the field and the plaque was back 14 px from the edge. 31 tests (new: `plaqueAt` – rounded, limited, 0/0 = not moved, kept by a layout save; its first version reused image seed 81 and made the door-casing test fail, because imports are deduplicated by content). `docs/` rebuilt, media 63 → 63. His editor tab needs one reload (⌘R) to get the new editor script.
- **Plaques at the lower right corner, close to the frame (2026-11-19, Martin)** – the brass plaque hung centred 16 px below the frame and read as a separate object. `.hang > .plaque` (wall exhibits only) is now `right:14px; top:calc(100% + 2px)`, no transform: the hang box already carries 6 px of margin around the frame, so ~8 px of wall remain between frame and plaque, and its right end sits ~8 px inside the frame's outer edge. The „above“ variant (an exhibit standing on something) is right-aligned the same way, 6 px above the object instead of 12. **Scoped on purpose:** the plaques on the cabinet (inline `left`, centred on the object), the tray tags and the phone list (in the flow) place themselves, and a `right` next to their `left` would stretch the box – so they are untouched. Verified on a copy of the data (own admin on 4334, 4322 left running): all 10 wall plaques 14 px from the hang's right edge and 1–2 px below the image (a plaque forced into `above` measured 14 px / 5 px above), the 3 cabinet plaques still centred, the phone list at 375 px unchanged (plaques `position:relative`, centred, no sideways scroll). 30 tests; `docs/` rebuilt, no media pruned (63 → 63). No exhibit currently uses the „above“ variant on the wall, so that one was checked by adding the class in the DOM.
- **Inventory number editable in Exponáty (2026-11-19, Martin)** – the number was only a badge. Now it is a field in the badge (1–9999, saved on Enter/blur, not while typing – „1“ on the way to „17“ would hit 001); a number another exhibit has asks to swap and swaps both in one commit, so the layout is never saved with two exhibits on one number (the server refuses that). Verified on a copy: 019 → 005 (free), → 017 (swap: Lost map of America got 005), a declined swap changes nothing, „abc“ is refused.
- **Phone wallpaper scrolls with the exhibits (2026-11-19, Martin)** – a wallpaper standing still behind a scrolling list made the exhibits look as if they floated above it. The tile is now the background of the list itself (`.m-list`, at least a screen tall), `#wall` is hidden on the phone. Measured: scrolled 600 px, the list and its wallpaper moved 600 px.
- **Phone version (2026-11-19, Martin)** – the whole site is designed for big screens; on a phone it is now a list. `main.js` only loads data and decides: a window ≤ 760 px wide, or ≤ 500 px tall under a finger (a phone held sideways), or `?mobile`, gets `mobile.js`; everything else (tablets included, Martin's choice) gets the wall, now `wallpage.js` (the old main.js body, unchanged). The phone builds no wall, camera, darkness, candle or shadows – only: the wallpaper tile on the fixed `#wall` (not a fixed body background, which iOS Safari ignores), the nameplate (the wall's own `makeNameplate`, scaled to the screen) and the exhibits one under another **by inventory number**, each its wall picture at a size **proportional to the wall** (one world→screen scale, the largest at 90 % of the screen, none under 45 %; the wallpaper tile uses the same scale), lazy-loaded, with its plaque (the wall's `.plaque` and `plateLook`, in the flow). Decorations, cabinet, drawers, shelves and surround are not shown; nothing between exhibits but the wallpaper. A tap opens the same detail: the URL routing moved out of the wall page into `routing.js` (`exhibitRouter`), shared by both – × (fixed, always on top) and the system back close it, the list keeps its scroll, an `e/<slug>/` link opens the list with that exhibit open and returns to it. Photos turn with a swipe: the viewer already had one (since the prototype); a second one I added made every swipe turn twice and land where it started – found with a stack trace, the duplicate removed, the original now ignores mostly-vertical moves. Admin: „Telefon ↗“ opens the site in a 390 × 844 window. Verified at 375 × 812: 7 exhibits by number, widths 169–338 px, no sideways scroll; detail opens, × closes, back closes, scroll kept (997 → 997), swipe left/right turns, a vertical move does not; at 1024 px the wall is built as before.
- **Gallery arrows inside the photo (2026-11-19, Martin)** – the ‹ › buttons sat 6 px outside the photo, on the gilt frame that is gone; `.stage` clips (overflow:hidden), so half of each was cut off. Now 12 px inside the photo's edges, whole and clickable (measured).
- **Paragraphs in exhibit descriptions (2026-11-19, Martin)** – the description was put into one `<p>` with `textContent`, so the lines Martin wrote ran together. Every line break now starts a paragraph (`paragraphs()` in viewer.js, the same split in the list page's build; blank lines do not add a second gap), `#vDesc` is a `div` of `<p>`s with 0.7 em between them. Checked on Lars Møller's skull: two paragraphs, 11 px apart.
- **Performance pass: editor lag, trailing cursor, Windows (2026-10-25, Martin)** – (1) Stěna editor: measured the main thread first – moving the wall and re-reading all 31 hung boxes costs 0.07 ms a frame, so JS was not it. The overlay was: the start view's frame (always on) dimmed the screen with a `box-shadow: 0 0 0 9999px`, as did the room frame, and every overlay element was placed with left/top – so every frame of a pan or zoom repainted the whole screen. Now every overlay element is placed by `transform` (`place()`, will-change), the start view has no dimming, the room's outside is four solid bands moved by transform, the overlay is skipped on frames where the view did not move and nothing was touched, and „věcí mimo místnost“ is counted once per layout instead of every frame. (2) Zoom (site and editor): every zoom frame set a new `background-size` on the wallpaper, repainting all of it; now the tile is rastered at one zoom and the element is scaled meanwhile, re-rastered once the zoom settles (or drifts > 30 %). Verified: selection box on its item before and after zoom (0 px off), room bands on the frame's edges, wallpaper `scale(0.83333)` during a zoom and a new tile size, scale 1, after settling. (3) Site: the hand candle was an image moved on pointermove – always a frame or two behind the OS cursor, which is the „mouse drags behind“ Martin felt. The build now makes the candle a real system cursor (`cursorFiles`: PNG 1× and 2×, ≤ 128 px as browsers require; Martin's is 43 × 118) and `cursor.js` uses it with `image-set`; the moved image stays as the fallback for a bigger candle. Verified: computed cursor is the image-set, hotspot on the flame (22, 18), no moved image. (4) Windows: `Kabinet.cmd` (CRLF; checks Node, opens an already running admin, reinstalls dependencies when `sharp` does not load – i.e. a node_modules copied from the Mac), the server opens the browser with `start` on win32. Not run on Windows from here. 30 tests.
- **Door casing on the entrance page (2026-10-25, Martin)** – a casing („futra“) around the doors: one picture (kind `doors`, role `doorsFrame`) with a see-through opening, and `doors.frameOpening` (fractions, `PATCH /api/doors`, 4 decimals) drawn in Místnost → Úvodní dveře → „Nakreslit otvor…“. The page wraps the doors button in `.portal` (the casing's own aspect, fits the window height); the doors fill the opening (`object-fit:cover`, so the ajar swap fills it the same way) and the casing is laid over their edges, `pointer-events:none`. Without a picture or without the opening nothing changes. The shelves dialog became the generic `rectDialog` (multi or single rectangle, move / corner resize / arrows) and serves both. Stand-in generated (dark stained wood, fluted pilasters on plinths, frieze panel, dentil cornice, crest; opening in the doors' own 751:1400, transparent margin trimmed) and set on Martin's data through his running admin; verified on the page: doors exactly in the opening (0.599 of the casing's width, top at 0.231), the whole casing fits 768 px of height, no scroll; the opening dialog checked on a copy. 30 tests.
- **Shelves can be edited after drawing (2026-10-25, Martin)** – in the shelves dialog a drawn shelf is dragged to move, resized from its four corners (the opposite corner stays put) and nudged with the arrows (1 px of the picture, 10 with Shift); everything stays inside the image. On the way: the server rounded every number to 0.01, which for a fraction of a picture is up to 15 px of a 1500 px bookcase – shelves and the frame opening now keep 4 decimals (`num(…, { dp: 4 })`). Verified on a copy of the data: moved one row down, narrowed from the corner, nudged 3 × 10 px, saved; 0.2381 comes back as 0.2381.
- **Bookcase shelves (2026-10-25, Martin)** – bookcases are ordinary hung items that move and multiply, so the shelves belong to the **image**: `media.shelves = [{x,y,w,h}]` (fractions; `PATCH /api/media/:id`), drawn in a dialog like the opening (`admin/public/js/shelves.js`, opened from the Stěna inspector → Vzhled → „Nakreslit police…“ and from Knihovna → „Police…“): drag = a new shelf, click = select, ⌫ = delete. Every copy of the image – and every bookcase made from it – has them. A shelf's bottom edge is one more snap target when dragging (shown as brass marks while dragging and on the selected bookcase); a thing dropped there gets `item.sits = <bookcase id>` and from then on goes along with the bookcase – dragged, nudged with the arrows, and on resize it keeps the same spot of the same shelf; moved away on its own, or its bookcase removed/stored, it stands on nothing (the server drops a `sits` pointing at nothing, at itself, or into a drawer/cabinet/storage). On the site a thing standing on a bookcase is laid after it and at least at its layer, so it is always in front, and its plaque goes above it. Verified on a copy of the data with Martin's cubby bookcase: two shelves drawn and saved, books dropped on shelf 1 (bottom 534.05 against the shelf's 533.99, `sits` saved), bookcase nudged (both −30), dragged (both +533/+267) and resized (books still exactly on the shelf, at 30 % of its width), books drawn after the bookcase. 29 tests.
- **Rotating things in drawers (and on the cabinet) (2026-10-25, Martin)** – things in drawers could not be rotated at all (knob, `[` `]` and the ∠ field were all switched off for them), and objects on the cabinet top could be rotated in the editor but the site never drew it. Both now carry `--tilt` like the wall pieces (`.tray .item` / `.cab-obj` rotate, hover lift keeps the tilt), their shadows rotate with them, and the editor shows the knob alone for a drawer item (its size is fitted to the drawer, so corners would mean nothing). Lying in a drawer a thing may point any way (±180°); on the wall and the cabinet the limit stays ±45°, now checked by the server after the patch. Verified on a copy of the data: letters-1 in its drawer turned to 60° with `]`, saved, drawn as rotate(60deg); knob only in the drawer, four corners + knob on the wall. 28 tests.
- **Room surround (2026-10-25, Martin)** – a built-in frame around the whole room instead of side pieces placed by hand: new media kind `surround`, `data.surround` (`setSurround`, `PATCH /api/surround`): side panel = an optional cap + a middle that repeats downwards (the right one is the left one mirrored, Martin: „ano“), a cornice repeating across the top, a wainscot repeating along the bottom of the wall behind the cabinet (Martin's photos: dark stained raised panels with a rail; no floor – the page stays cut at the bottom). Laid along the room's edges, so changing the room size carries it along; sides and cornice above everything hung (z 300/301), the wainscot behind the hung things and the cabinet, all `pointer-events:none` so the admin can still select what is underneath. Backgrounds take the smallest derivative that is sharp at zoom 1.25 on a 2× display. A room that grows with its content now makes space for the surround outside the content (sideW+40 / corniceH+40), so nothing at the edges is covered. Admin: Místnost → „Obložení místnosti“ (on/off, four images, side width, cornice and wainscot height). Stand-ins generated (SVG → PNG, stained wood with raised panels and a dentil cornice) and imported as ordinary media into Martin's library; the surround is switched on with them and the room fixed at the grown size (3509 × 2514, -1299…2210, top -989) – Martin replaces the images and drags the edges. Bookcase shelves as places for exhibits: the next task. Requirements in PODKLADY.md 5.12. 27 tests.
- **Room size (2026-10-25, Martin)** – „velikost místnosti = maximální velikost stránky; bez toho se místnost vykresluje do nekonečna podle obsahu a nedá se udělat pěkný okraj“. New `data.room = {x0,x1,y0}` (null = grows with its content as before), saved with the layout like `view` (same PUT, rev, undo; at least 600 px wide). Its bottom is always the page end (`cutY`), so there is one bottom, not two. With a room the wall bounds are the room (`WALL.hard`): the camera keeps no margin outside it, and the farthest zoom is the one that still covers the window (`coverZoom`), so a visitor never sees past the edge. Admin: Stěna → toolbar „Velikost místnosti“ shows the frame (dashed while it still follows the content), left/right/top edges drag (Shift = symmetric about the cabinet axis), the label gives the size and how many hung things reach outside, „Podle obsahu“ returns to the old behaviour. On the way: the editor could not zoom out below 70 % (the visitor's limit), so „Celá stěna“ never showed the whole wall – the editor now has its own floor (15 %) and „Celá stěna“/0 fits the room between the side panels. Verified on a copy of the data: right edge dragged → saved, „1 věc je mimo“ (the bookcase); public page at 1440 × 900 never showed outside the room and stopped zooming out at 0.644. 26 tests.
- **Library tiles in the Stěna panel no longer overlap (2026-10-21, Martin)** – the panel's grid is a flex child with a fixed height, and its tiles (`aspect-ratio:1`, `overflow:hidden`) contribute no minimum height, so the auto rows were squeezed to fit the panel: 22 px rows under 120 px tiles, every picture drawn over the next. `grid-auto-rows:max-content` sizes the rows by the tiles (measured 120 px, 0 overlaps); the media picker's grid (`.pick-grid`, inside a max-height modal) had the same pattern and got the same rule (35 tiles, 0 overlaps).
- **Plaques above things that stand on something (2026-10-21, Martin)** – a plaque under an object standing on a shelf or the cabinet landed on the shelf board / the cabinet edge and could not be read. `buildWall` now marks a wall exhibit whose bottom touches the top of another hung item (within 6 px, centre over it – the same contact the editor's snapping makes) as `plaqueAbove`; its plaque goes 12 px above the object (`.plaque.above`), and objects on the cabinet top always get it above. A shelf drawn inside the exhibit's own image (Travel Plans) has nothing under it, so its plaque stays below the shelf, on the wall. Measured on the real wall: Film and Animation above (on the wooden shelf item), the four framed ones below.
- **No painted rim around an uploaded velvet (2026-10-21, Martin)** – an open drawer showed a 7 px brown frame that came from no texture: `.tray` paints `inset 0 0 0 7px #3b2412` for the painted stand-in, and the velvet photo was inset by the same 7 px. With a `tray` image (`.tray.photo`) the rim is gone and the photo fills the drawer (measured 173 × 69 of 173 × 69, offset 0). The painted tray keeps its rim.
- **Admin restarts itself (2026-10-14, Martin)** – „po každé změně ho restartuj, vždycky ho musím znovu spouštět“: the cause was on my side – every test ended with `pkill -f admin/server.mjs`, which also killed the admin Martin had running. Now `npm run admin` is `node --watch admin/server.mjs` (restarts after any change to the server or `lib/`), the browser opens only on the first start of a watch session (marker file keyed by the watcher's pid), and tests run on a separate port with temp data and are stopped by PID. Verified: two code changes → two restarts, one browser open.
- **Closing drawer stays on top until it is shut (2026-10-14, Martin)** – an open drawer is raised (`z-index:2`) and the class came off at the start of closing while the front still slid back for .45 s, so for a moment it passed behind the drawer below. The drawer now drops its layer only after the front's transition (`transition:z-index 0s .45s`, base `z-index:0` so there is a number to hold – 0 paints in the same order as auto). Measured: 2 right after closing, 0 after the slide. Applies to the admin's wall too (same stylesheet).
- **Frame lips after their pictures too (2026-10-14, Martin)** – the lips are painted into the darkness canvas every frame and had no wait at all. Now every caster (cast shadows and lips alike) waits on the same `arrived()` as the static shadows – the item's own entrance animation finishing – instead of a time computed from the CSS delay (that clock drifted from the animation's own); a lip also needs its image loaded and fades in over 0.45 s. The timer fallback in `arrived()` is end + 1.5 s, so in a real browser the animation always wins. Measured in 35 samples during load: lips drawn ≤ their pictures that had arrived, every time.
- **Shadows after pictures; library keeps its scroll (2026-10-14, Martin)** – the pictures arrive one after another (hangIn, 75 ms apart, up to ~3 s for the last), but a static shadow was inserted as soon as its image had decoded, so the wall showed shadows first and pictures after. Now each shadow waits for its item's own entrance animation (`getAnimations().finished`, with a timer as a fallback where the animation clock does not run) and comes in with a 0.45 s opacity transition that is removed afterwards (a finished fill-mode animation would keep a layer); the cast shadows' `showAt` now means the end of the item's animation too, not its start + 350 ms. Measured: 30 of 30 shadows inserted after their item had finished. Knihovna: every click re-renders the section and `.lib-main` is the scroller, so a selection jumped to the top – render keeps its scrollTop (450 → 450 after a select).
- **Exhibits off the wall are stored, not deleted (2026-10-14, Martin)** – an exhibit is not its own record but the `exhibit` block on a wall item, so „Sundat ze stěny“ used to delete its title, description, tags, gallery order, inventory number and slug, recoverable only with ⌘Z until the next reload. Now taking an exhibit off sets `item.off = true` (validated in `applyItemPatch`, part of the layout and its undo): `publicData` and the build leave it out (no wall, no `e/<slug>/`, no list/sitemap entry), the admin wall builds from the hung items only, and Exponáty shows it under the new filter „Mimo stěnu“ with „Pověsit zpět na stěnu“ (back to the exact spot; a drawer that no longer exists → the cabinet top) and „Smazat natrvalo“ (confirm, pictures stay in the library). Its inventory number and slug stay reserved; its pictures count as used, so the library will not delete them. Decorations (no exhibit) are still simply removed – nothing of theirs is lost. 25 tests; verified on a copy of the data: off → gone from wall + data.json + 404 on its page, texts intact, rehang → same place, page back.
- **Plate graphics + paper description (2026-10-14, Martin)** – new media kind `plate` („Cedulka“) and `data.plates` (`setPlates`, `PATCH /api/plates`, field-wise merge, `reset`): the nameplate and the plaques under exhibits can each have their own image, font (the site's four faces by role), size and colours, and "engraved" on/off; defaults (`PLATE_DEFAULTS` in build.mjs) are exactly the old painted brass, so nothing changes until Martin picks something. Nameplate with an image takes its proportions (h from the image, width settable) and its cast/static shadow follows the image's alpha; plaques with an image are a CSS 9-slice (`border-image`, the outer `ends` % keep their shape, the middle stretches with the title), height 2.2 × font size. Admin: Místnost → „Jmenovka a štítky“ with a live half-size preview built by the site's own `makeNameplate`/`plateLook` (exported from wall.js), no copy. The exhibit description in the viewer is now The Book's three-texture paper (top/mid/bot, downscaled to 40 %, 23 kB total; same percentages of width, `.viewer .card` + new `.card-body`, scoped so the admin's own `.card` is untouched). Verified on a copy of the data with a test plate: preview, wall plaques (9-slice ends measured 18.5 px = 30.8 × 12 % × 5), nameplate image, paper at 340 px and at 375 px phone width (no sideways scroll). 24 tests.
- **Frame lips half as deep (2026-10-14, Martin)** – the dark band inside a frame's opening made the pictures look set far deeper than a real frame; its depth is now `min(w,h)·0.175 + 3` instead of `·0.35 + 6` ; then, on Martin's second look, its strength halved too (alpha .55 → .275).
- **Doors page: nothing under the doors (2026-10-14, Martin)** – the brass name plate, "Click the doors to enter" and the "list of exhibits" link are gone; the doors take the freed height (max-height 100vh − 32 px). The list page still exists and is reached from the sitemap and the wall's noscript fallback.
- **Speed re-measured with the new test graphics (2026-10-13)** – cabinet page 52 requests / 1086 kB (media 870, JS 80 → was 112: `placeholders.js` and the decor SVGs now load only when a stand-in needs painting, which with real assets is never), DOMContentLoaded 150 ms, last wall image 276 ms (local server). Decoding all wall images ~210 ms in total, the biggest single ones 24–25 ms (cabinet body 2520 px, mapa-sveta 1318 px). Shadow sprites are now shared per item/plate/cabinet (`spriteFor`) instead of being built twice. Fixed on the way: a window that starts at 0×0 (background tab, hidden pane) made `openingView` return z = 0, every candle position became NaN, `createRadialGradient` threw inside `tick()` and the camera loop stopped for good – the view is now floored at 320 px and `cutLight` skips a non-finite light rather than throwing. FPS still cannot be measured from here (hidden pane runs no rAF); a DevTools Performance trace from Martin is the measurement.
- **Knihovna: multi-select + bulk delete (2026-10-13, Martin)** – ⌘/Ctrl-click toggles, Shift-click selects a range in the order shown, „Vybrat vše zobrazené“ takes everything the current filter shows (e.g. Nepoužité). With more than one selected the detail strip becomes a bulk bar: count, size, how many are in use; „Smazat nepoužité (N)“ deletes only files used nowhere (the same rule as for one file), used ones stay and the status says so.
- **Viewer without the gold frame (2026-10-13, Martin)** – „obrazy mají buď vlastní rám, nebo nebudou mít žádný“: the gilt `m-gold frame` with rosettes and the inner shadow around the detail's photo are gone, the photo stands on the dark veil as it is. An exhibit without gallery photos now shows its own wall image as the one slide (no arrows, no counter, no placeholder note) instead of four painted slides drawn from the wall image – on a deep link that image was not loaded yet and the slides came out as empty dark rectangles.
- **Import per file, page start (2026-10-13, Martin)** – the import sheet now keeps a kind, look and target exhibit **per file** (click a file to set it, badges on the thumbnails show what each becomes, „Použít na všechny“ copies the current one). **Page start:** the opening view used to centre on the first hung item (x 0) while the cabinet's middle is at x −72 – a leftover of the prototype's spiral – so it never sat above the cabinet. Now `data.view` (part of the layout, undoable, validated, public) holds where the page opens; `null` = above the middle of the cabinet, at the old height. `openingView()` in `camera.js` is the one pure function the site's camera and the admin both use: Stěna draws the frame a 1440×900 visitor sees on load, a draggable „střed stránky“ cross (snaps onto the cabinet's axis, drawn as a dashed line) and, with nothing selected, the inspector card „Střed stránky“ (X/Y, „Nad střed skříně“, „Výchozí“); toolbar toggle „Výchozí pohled“. 23 tests.
- **Phase 3b done (2026-10-13)** – one admin instead of „Správa“ + „Editor stěny“, built step by step as the brief orders, each step committed with tests green: (1–2) shell with top bar, hash routing, own dark theme + IBM Plex (self-hosted, OFL), Stěna with layers (grouped Stěna / Na skříni / Šuplíky, search, ☀, click = select + pan, opens drawers), library tab, floating tools (select/pan, snapping, dark preview, zoom, whole wall), blue selection with label, four corner handles + rotation knob, brass snap guide, page-end line, status bar, tabbed inspector + exhibit summary card; (3) Exponáty – list with filters (Vše / Bez fotek / Bez popisu / V šuplících), „Udělat exponát z věci…“, document editor (IM Fell title, medium, slug, description with count, tag chips, plaque), gallery with drag & drop reorder (arrows as keyboard fallback), drop zone, „Vybrat z knihovny“, share preview; (4) Knihovna – grid on a checkerboard, kind chips + „Nepoužité“, search, usage count, detail strip (where used, look, light, replace file – new `POST /api/media/:id/replace` that keeps the id – delete when unused), global drop → import sheet (kind cards, look tiles previewed on a small in-browser copy, before/after split slider, „Po importu dát na stěnu“); (5) Místnost – sub-nav, drawers drawn/moved/resized on the body photo, page end as a draggable line (`cutY`), drawer cards (front, contents, „chybí fotka čela“, delete moves contents onto the cabinet and renumbers later drawers), wallpaper/grime, doors + creak, **nameplate texts editable**, site settings, effects + hand candle, analytics. Old „Správa“ tabs, the numeric „Položky“ table and `/editor` are gone (`/editor` → `/#stena`). 22 tests.
  Verified in the browser on a copy of the real data: every section rendered, move / NW resize / rotate / undo on the wall, exhibit texts autosaved and untouched by wall undo, tags, gallery reorder by arrow and by drag, invalid slug refused, library light, import via a dropped file (look applied, hung on the wall, selected), drawer move/resize/draw/delete, page-end drag, nameplate text on the wall, effect switch. Found on the way: the site's `.btn`/`.card` leaked into the admin, an element reset outranked the title font, a drawer drag edited a copy re-read mid-drag.
- **Admin redesign brief (planning, 2026-10-13)** – the admin works but is hard to find one's way in (two apps: tabbed „Správa“ + separate „Editor stěny“, the same things doable in two places). New brief: **phase 3b** below – one app, four sections (Stěna / Exponáty / Knihovna / Místnost). Design: canvas „Kabinet – administrace“ (Claude.ai artifact, link in phase 3b).
- **Panning: „mnohem lepší“ (Martin, 2026-10-13)** after the wallpaper/layers fix. **Opening a detail stuttered** – three causes in the viewer: a full-screen `backdrop-filter: blur` under the fade-in (now a plain darker veil), all four 2048 px photos inserted at once and decoded mid-animation (now each slide is fetched and decoded with `img.decode()` before it fades in, cover first, then its neighbours; hovering or focusing an exhibit starts decoding its cover), and the darkness canvas being redrawn under the open viewer (now it keeps its last frame).
- **Pan trace analysed (2026-10-13, Martin's trace with `?fx=none`)** – the main thread was idle (own work < 1 ms/frame) but blocked ~20 ms per frame waiting for the GPU side: frames every ~22 ms instead of 16.7, 167 dropped, swap→presentation ~27 ms, 28 composited layers per frame. Two causes fixed: the wallpaper canvas was refilled with its pattern on every panned frame → now a background element moved by transform only; the new shadow images and the nameplate kept finished `fill-mode: both` animations, which keeps each a layer of its own → no animation on shadows, the plate's is `backwards`. Next: a new trace to compare.
- **Panning stutter with all effects off (2026-10-13)** – after the stand-ins became large images, every picture carried a CSS `drop-shadow` (22 px blur, twice) and the browser re-rasterises such filters for each tile of the wall that pans into view; large images were also decoded only when first needed, mid-pan. Now: no CSS filter anywhere on the wall – the soft shadow under every item is a pre-rendered image (`addStaticShadows`, same silhouettes as the cast shadows, made once after load, fading in with its item); all wall images are decoded in the background after load; srcset `sizes` asks for zoom 1 instead of 1.25 (smaller files to decode, a touch soft at the closest zoom). The glow is no longer restyled every frame while the darkness is off. Not measurable here – Martin judges on his Mac.
- **Darkness switch (2026-10-13)** – `fx.darkness` (admin → Nastavení, `?fx=dark`) turns off the candlelight darkness and the warm glow on the wall and on the doors; the static vignette stays. Frame lips need the darkness canvas, so they go with it. Note on the light trailing the pointer: anything a page draws is 1–2 frames behind the system cursor, which macOS draws itself; with the native cursor visible and the light on, that gap shows on fast moves and no page can remove it – the hand candle exists to hide it (light and candle lag together).
- **Smooth first (2026-10-13, Martin)** – „nejprve plynulá stránka bez lagu, efekty přidáme postupně“. The hand candle is now ONE static image (no flicker, no filter, no pointer prediction – the flame element and getPredictedEvents made it glitch). Every effect has its own switch (admin → Nastavení: cast shadows, frame lips, room-candle shadows, hand candle) and `?fx=none` / `?fx=cast,lips,room,candle` overrides them in the address for a quick comparison. **All stand-ins rasterised** and deployed as ordinary media through the API, as if they were Martin's own assets: 25 wall items (frames with their wire, shelves with their object, objects on the cabinet and in drawers; frames got an `opening`), 40 gallery photos (the 4 painted slides per exhibit, with captions), cabinet body + 2 drawer fronts + velvet (photographed-cabinet mode), the damask tile (`tileWorld` 140), closed/ajar doors, the hand candle; candles on the wall keep their light via `media.light`. 5.6 MB of media. The one-off tool is in git history (6e54e5c: `admin/public/rasterize.*`) and was removed afterwards. The nameplate keeps its SVG plate and live text (no image slot for it in the data model).
  **Safety:** layout saves now carry the revision the editor started from; a save based on an outdated layout is refused (409). An editor tab left open from testing on a temp data root, still connected when the admin ran on the real data, is the likely cause of the 6 items that disappeared at 01:59 – all stale tabs were closed.
  Still to judge on Martin's Mac: the remaining lag while panning (compare `?fx=none` against the default).
- **Phase 6 fixes (2026-10-13, Martin's feedback)** – the candle cursor lagged: the flame's flicker was a CSS animation inside the SVG plus a drop-shadow filter, which repainted the candle every frame; the flame is now its own compositor-animated element, the shadow is drawn into the SVG, and predicted pointer events are used. The lip shadow spun round when the cursor crossed a picture's centre; it now fades out as the flame comes in front of the opening (0 at the centre, full at the edge – measured), and the cast shadow has no minimum offset any more. Latency itself cannot be measured in the embedded browser.
- **Phase 6 done (2026-10-13)** – hand candle cursor (SVG candle on a brass tray, flame flicker as a compositor-only CSS animation, wall and doors, native cursor on touch, in the admin and over the viewer); cast shadows from the hand candle on a half-res canvas; room-candle static shadows (D12) with the hand shadow weakened where a room candle already lights, switch in admin → Nastavení (default on); frame lips inside openings (drawn openings, and placeholder frames from their geometry); baked shadows reduced to contact shadows while cast shadows are on. **Decision:** silhouette sprites are made in the browser at load, not at import (works for placeholders too, no pipeline change). Measured JS cost per frame (Chrome, 1440×900): cast shadows 0.16 ms, lips 0.07 ms, whole wall visible 0.13 ms. **Still not measured: real fps while dragging** – the embedded browser never runs requestAnimationFrame while a script is measuring; to do on Martin's Mac (DevTools → Performance, drag for 5 s), with real photos.
  Found while verifying: shadows appeared a second before their pictures (the hang-in animation) – each now waits for its item.
- **Phase 5 moved to the end** (Martin, 2026-10-13): publishing waits until everything else is done; D7 unchanged.
- **Phases 4 + 4b done (2026-10-13)** – pages: `/` doors (painted SVG stand-in until the photos exist; click → creak → ajar swap → `cabinet/`, capped at 1.4 s, immediate with reduced motion or failed audio; own quarter-res candlelight, hidden on touch), `cabinet/` wall, `e/<slug>/` per exhibit with its own title/description/canonical/OG image, `list/`, `404.html`, `sitemap.xml`, `robots.txt`, `favicon.svg`, Cloudflare Web Analytics loader (D13, token in admin → Nastavení, skips localhost). History: opening/closing an exhibit changes the URL, back/forward work. Admin tab Nastavení: nameplate texts, site description, site URL, domain, analytics token, doors photos + creak upload. New media kind „Dveře“; item cut-outs now get `og.jpg` too. 19 tests. First commit made, author = Martin Porter + noreply (D23) – the first attempt carried the personal e-mail and was amended before anything left the Mac.
  Verified in the browser on the real data (read-only): doors → cabinet, open/back/forward/close, deep link into a drawer exhibit (viewer open, narrow screen), list page (no overflow at 400 px), admin settings. Not verified: the creak (no sound file yet), OG previews in real messengers (needs the public URL, phase 5).
- **Phase 3 done (2026-10-12)** – wall editor at `/editor` (link „Editor stěny“ in the admin): the real wall fully lit, drag to move (several with Shift-click), corner handle to resize keeping the aspect ratio, `[`/`]` rotation (plus a slider), z-order, snapping onto the item below or the cabinet board (which moves the item onto/off the cabinet), arrows nudge 1/10 px, ⌘D duplicate, ⌫ remove, ⌘Z/⌘⇧Z undo/redo; library panel (drag a picture onto the wall, upload new ones with a look); inspector with image swap, position, placement (wall / cabinet / drawer N), exhibit fields (title, medium, description, tags, inventory number = next free, slug, plaque on/off), gallery (upload, add from library, order, cover = first, captions) and the opening drawn on the image. Saves the whole layout via `PUT /api/layout`. The public viewer shows the real gallery and captions (placeholder slides only without photos). 17 tests.
  Verified in the browser on the synthetic assets: move, undo, nudge, resize, drop from library, snap onto the cabinet, exhibit + 2 uploaded gallery photos + caption + reorder, the viewer on the public site, opening, multi-select delete + undo. Found and fixed: the opening dialog's Save was swallowed by the camera's drag guard. Not done: the editor is desktop-only (panels overlap below ~1000 px), and the nameplate text is not editable in the UI yet (settings.plateTitle/plateSubtitle in cabinet.json).
- **Phase 2 done (2026-10-12)** – import pipeline (`lib/images.mjs`), looks (`lib/look.mjs`: 4 presets in `data/looks.json` + `.cube` 3D LUTs from `assets-inbox/looks/`, trilinear, alpha untouched), admin in Czech (Import with before/after preview, Library with re-look / roles / light / delete, Wall & cabinet, a temporary numeric Items table until the phase 3 editor). Site renders real media for wall items, objects on the cabinet and in drawers, wallpaper tile, grime overlay, photographed cabinet body + drawer fronts + velvet; lights come from `media.light`. Fonts self-hosted (IM Fell English/SC + Spectral latin/latin-ext from @fontsource 5.3.0, OFL) – Google Fonts gone. `PODKLADY.md` = asset spec for Martin. 15 tests.
  Verified in the browser on **synthetic** assets (Martin has none yet) on a temp data root: everything loads, no console errors, drawers hide their contents when closed and show them open, lights work. **Not measured: fps while dragging** (the browser pane was hidden, rAF did not run) – the "≥ 50 fps" check is still open and has to be done with real photos on Martin's Mac. Found and fixed on the way: a build could prune a media folder mid-import (`pendingMedia`), and the phase 1 `return` line in `wall.js` had been commented out by an edit (an empty wall would have crashed).
- **Phase 1 done (2026-10-12)** – prototype split into `site/index.html` (template) + `css/cabinet.css` + `js/{main,wall,camera,viewer,placeholders,util}.js` (ES modules, no bundler). Spiral run once in Node, result frozen into `data/cabinet.json` (31 items, 15 exhibits, explicit seeds, tilts and inventory numbers), spiral code gone. The site loads `data.json` (public projection, `publicData()` in `build.mjs`). All public strings English (exhibit copy translated – **Martin to review** in `data/cabinet.json`). Verified in the browser against the prototype: same camera transform, all 77 positioned elements equal to within 0.005 px (rounding of the frozen x/y), same painted image sizes, viewer and drawers work.
  Open (fonts: solved in phase 2): `?v=` busts the cache of `main.js` only, imported modules rely on Pages' 10 min cache – fine while local, revisit before publishing.
- **Phase 0 done (2026-10-12)** – skeleton: admin (127.0.0.1, port 4322) + `/preview/`, `lib/{config,store,build}`, prototype copied unchanged into `site/index.html` and served byte for byte, `CLAUDE.md`, Czech `README.md`, `Kabinet.command`, 5 e2e tests passing. `git init`, no remote (D7). Admin git/publish module (Fotogalerie `admin/git.mjs`) deliberately left out until phase 5. Port 4322 so it can run beside Fotogalerie on 4321.
- **v4 (2026-10-12)** – only cheap effects, **no WebGL / normal maps** (D11);
  shelf candles cast shadows as an **experiment** that can be switched off
  (D12); **Cloudflare Web Analytics** as Fotogalerie (D13); **entrance page –
  the cabinet doors** (D14, phase 4b): a **separate, light static page**, no
  animation, door creak sound.
- **v3 (2026-10-12)** – architecture mirrors Fotogalerie (Pages from
  `main`/`docs`, no Actions; local admin; reuse code). **Each wall item is
  one photo** (frame and picture merged by Martin, D5). Optional import
  **look filter / LUT** (D6). **Nothing is published until Martin
  explicitly says so** (D7). Light & shadow + candle cursor added as a later
  phase with performance rules (phase 6).
- v2 – GitHub Pages instead of a server; English only; real photos; manual placement.
- v1 – Node server + SQLite + LXC (dropped).

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | **GitHub Pages from `main`, folder `/docs`**, no GitHub Actions. Domain **cabinet.martinposta.com** (Cloudflare CNAME → `martinposta.github.io`, **DNS only**). | Same as Fotogalerie |
| D2 | **Website English only.** Admin in **Czech** (like Fotogalerie). | Martin |
| D3 | Everything visual is **real photographs**; CSS/vector art only as placeholders. Goal: old, dirty, real. | Martin |
| D4 | **Manual placement** of every item (pictures and decorations). No layout algorithm. | Martin |
| D5 | **A wall item = one image** prepared by Martin (frame + picture together, cut out with alpha, already unified). Optional **opening mark** (rect/oval drawn in the admin) for effects that need to know where the picture is (phase 6). | Every item unique; Martin unifies in Photoshop |
| D6 | **Optional look filter at import** – presets and/or a `.cube` LUT, chosen per import (default: none). Originals kept **locally** so the look can be re-applied later. | "Instagram filter" as a free option |
| D7 | **Local only until Martin explicitly says "publish"** – no GitHub repo push, no Pages before that. | Martin |
| D8 | Video in the viewer: **probably not**, decide later. | Martin |
| D9 | Minimal deps, no framework, no bundler, no CDN at runtime; fonts self-hosted. **Ask before adding any npm dependency.** Expected: `sharp` (as Fotogalerie). | Martin's preference |
| D10 | Repo will be **public** (Pages Free). Nothing private in it. | Same as Fotogalerie |
| D11 | **Only cheap effects.** Nothing that re-rasterises `#world` per frame; **no WebGL, no normal maps** – not now, not later. | Martin |
| D12 | **Shelf candles cast shadows – as an experiment.** Behind a single flag in `settings` (`roomCandleShadows`); if they collide with the hand candle or produce artefacts, switch off and drop the code. | Martin: "try it, remove if odd" |
| D13 | **Cloudflare Web Analytics** (cookieless, token in admin settings, loader skips localhost) – copy Fotogalerie D18 as is. | Same as Fotogalerie |
| D14 | **Entrance page: closed cabinet doors** as a **separate static page** (`index.html` = doors, the wall lives at `cabinet/`). **No animation.** Click → door creak + swap to a photo of the doors ajar → go to `cabinet/`. Old-web "enter" splash on purpose. | Martin: cheap and fast; no background loading that could feel like a freeze |

## 2. Architecture (Fotogalerie pattern)

```
admin/server.mjs      node:http, 127.0.0.1 only, Host allow-list, Origin check   ← reuse
admin/public/         admin UI (Czech) + the wall editor
lib/config.mjs        paths, image settings, port
lib/store.mjs         load/save data/cabinet.json (atomic write)                 ← reuse
lib/images.mjs        sharp pipeline (+ look filter/LUT, alpha cut-outs)          ← reuse + extend
lib/look.mjs          presets + .cube LUT parser/applier (no new dependency)
lib/build.mjs         data/cabinet.json + site/ → docs/ (index, e/<slug>/, list/, data.json, CNAME, 404)
admin/git.mjs         publish (commit → fetch → rebase → push), sync              ← reuse
site/                 public site SOURCE: index.html template + js modules + css + fonts
docs/                 GENERATED public site, committed, served by Pages. Never edit by hand
data/cabinet.json     source of truth (committed, 2-space JSON)
assets-inbox/         Martin's source images (git-ignored, local only, needed to re-apply looks)
tests/                node:test end-to-end (as Fotogalerie)
Kabinet.command       macOS launcher (LF, executable) – like Galerie.command
```

Carry over Fotogalerie invariants: originals never in the repo; **no metadata,
never GPS** in published images; `docs/` is generated; all public URLs
relative to `{{ROOT}}`; admin local-only; don't set `GIT_TERMINAL_PROMPT=0`;
build independent of line endings; `npm test` after every change.

**Differences from Fotogalerie:**
- The public site is the **cabinet wall** (the prototype), not a masonry grid.
- The admin's main screen is a **visual wall editor** (drag & drop on the real wall).
- Originals are kept locally in `assets-inbox/` (Fotogalerie throws them away) so a look can be re-applied.
- No drafts/sync complexity needed in v1 (single Mac). Add later only if Martin
  wants the admin on Proxmox too (Fotogalerie phase 7b).

## 3. Data model – `data/cabinet.json`

```jsonc
{
  "version": 1,
  "settings": { "siteUrl": "", "customDomain": "cabinet.martinposta.com",
                "plateTitle": "Cabinet of Curiosities", "plateSubtitle": "Personal projects",
                "defaultLook": null },
  "wall":    { "wallpaper": "<mediaId>", "tileWorld": 280, "grime": "<mediaId>|null" },
  "cabinet": { "x": 0, "top": 1480, "body": "<mediaId>", "drawers": [ { "front": "<mediaId>", "x": 44, "y": 58, "w": 380, "h": 150 } ] },
  "media": {                                   // every processed image
    "a1b2c3d4e5f6": { "w": 1600, "h": 1240, "alpha": true, "widths": [640, 1280, 1600],
                      "look": "night-oil", "v": 1,
                      "light": { "x": 0.5, "y": 0.11, "radius": 340 } }   // only candles etc.
  },
  "items": [
    {
      "id": "time-transit",
      "media": "a1b2c3d4e5f6",                 // ONE image: frame + picture (D5)
      "x": 0, "y": 0,                          // world centre
      "w": 500,                                // world width; height from aspect
      "rotation": -0.4, "z": 10,
      "opening": { "shape": "rect", "x": 0.12, "y": 0.14, "w": 0.76, "h": 0.72 },  // optional, fractions of the image (phase 6)
      "drawer": null,                          // index → item lives in a drawer tray (+ "dx","dy")
      "exhibit": {                             // omit = decoration
        "slug": "time-transit", "inv": 1,
        "title": "Time Transit", "medium": "VR game · Unreal Engine 5",
        "description": "…", "tags": ["UE5", "VR"],
        "gallery": ["<mediaId>", "…"], "captions": { "<mediaId>": "…" },
        "plaque": true
      }
    }
  ]
}
```

- **Shelves, candles, skulls, the nameplate's brass plate – all just items**
  (one image each), placed by hand. The editor snaps an object's bottom onto
  the item under it.
- **Any item can be an exhibit**, including objects on shelves, on the cabinet and in drawers.
- **Light sources** come from the media (`light`), so a candle lights the room wherever it is placed.
- **Camera bounds** = bounding box of wall items + screen margins; bottom = `CUT_Y` of the cabinet (section 7).
- Text (plaques, nameplate, drawer tags) stays live HTML over photo plates, so it is editable.

## 4. Import pipeline and look (D5, D6)

- Input: PNG/TIFF/JPG/WebP. Cut-outs keep alpha → WebP with alpha.
- Widths: wall items `[640, 1280, 1600]` (largest frame ≈ 1050 px on screen at `Z_MAX` 1.25 × DPR 2);
  gallery `[960, 2048]`; plus `og.jpg` 1200 px for link previews (as Fotogalerie).
- Strip all metadata (Fotogalerie invariant 2).
- **Look filter (optional, per import, default none):**
  - presets in `data/looks.json`, built from sharp ops: `modulate` (brightness/saturation/hue),
    `linear` (contrast/lift), `recomb` (colour matrix / warm cast), `gamma`, optional vignette and
    grain baked in;
  - **`.cube` 3D LUT support** (Martin can make a LUT in DaVinci Resolve / Photoshop): parse the
    file, apply with trilinear interpolation on raw pixels (`sharp().raw()` → JS loop → back to sharp).
    No new dependency. Alpha passes through untouched.
  - Admin shows a before/after preview and lets Martin re-apply a different look later
    (that is why `assets-inbox/` exists).
- Wallpaper tile and grime overlay go through the same pipeline (look optional).

## 5. Phases

Each phase is self-contained and verifiable. Log every phase in this file.

### Phase 0 – repo and skeleton (local)
- `git init` (no remote yet – D7), `.gitignore` (`node_modules`, `assets-inbox/`, `.DS_Store`, `data/*.tmp`), `.gitattributes` as Fotogalerie.
- `CLAUDE.md` from this plan + section 7; `README.md` (Czech, for Martin).
- Copy the reusable Fotogalerie modules; prototype → `site/index.html` unchanged;
  `lib/build.mjs` copies it to `docs/`; admin serves `/preview/` like Fotogalerie.
- `Kabinet.command` launcher; `npm test` skeleton.
- **Done when:** `npm run admin` opens the admin and `/preview/` shows the prototype.

### Phase 1 – split into modules, data from JSON, freeze the layout
- Split the prototype into template + `js/` modules (camera, light, wall, viewer, cabinet, data) + css. No visual change.
- **Freeze the current layout:** run the prototype's spiral once, export x/y/w of every item into
  `cabinet.json`, delete the spiral code.
- Load from `data.json`; canvas-drawn placeholders only as fallback for items without media.
- All public strings in **English** ("Cabinet of Curiosities", plaques, exhibit copy – Martin reviews).
- **Done when:** same look as the prototype (apart from language), driven by data.

### Phase 2 – import pipeline, look filter, first real photos
- Section 4. Admin: drop files → choose look (or none) → media entry. Before/after preview.
- Render real wallpaper tile + grime, 2–3 real wall items, one shelf with an object, the cabinet.
- **Cabinet from photos:** `body` (carcass with empty drawer openings) + one cut-out per drawer front + velvet tray.
- **Done when:** these are real photos and dragging still holds ≥ 50 fps (measure as in the prototype).

### Phase 3 – wall editor in the admin
- Opens the real wall in edit mode: drag items, resize handle (keeps aspect), small rotation,
  z-order, snap to the item below, arrow-key nudge, multi-select, undo/redo.
- Library panel of all media → drag onto the wall to create an item.
- Inspector: exhibit on/off, title, medium, description, tags, inventory number (next free), plaque;
  drawer assignment; draw the **opening** (rect/oval) on the image.
- Gallery editor (order, captions, cover). Save writes `cabinet.json`.
- **Done when:** Martin adds a new curiosity from scratch without touching JSON or a terminal.

### Phase 3b – admin redesign: one app instead of „Správa“ + „Editor stěny“
Approved by Martin 2026-10-13. Visual design (four screens, dark neutral UI):
**https://claude.ai/artifact/GJJNApQhBuaheU4qvadkng** – Martin can export
screenshots if the link does not open from the Code session. The screens are
the reference for layout, grouping and copy; colours/sizes below are the spec.

**Why:** today the admin is two apps. Position can be edited in the numeric
„Položky“ table *and* in the editor; images are uploaded in „Import“ *and* in
the editor's library; exhibit texts are typed in a narrow inspector next to the
wall. Rule for the new admin: **every task has exactly one place.**

**Structure** – one page (`admin/public/index.html`), sections switched by the
top bar, URL hash keeps the section (`#stena`, `#exponaty/<slug>`,
`#knihovna`, `#mistnost/<part>`) so reload/back work. No framework (D9).

- **Top bar (all sections):** „Kabinet správa“ wordmark · segmented nav
  *Stěna · Exponáty · Knihovna · Místnost* · undo/redo (only meaningful on Stěna,
  disabled elsewhere) · save status (*Uloženo* green dot / *Ukládám…* amber) ·
  *Náhled webu ↗* · *Publikovat* with a count of unpublished changes
  (button may stay disabled/hidden until phase 5 – D7).
- **Global drop:** files dropped **anywhere in the window** open the import
  panel (see Knihovna). The separate Import tab disappears.

**1 · Stěna** (default section; replaces `/editor`)
- Centre: the real wall (current editor code). Floating toolbar top-centre:
  *Výběr* / *Posun pohledu*, *Přichytávat* toggle, *Náhled ve tmě* toggle
  (darkness + hand candle as on the site, off by default while editing),
  zoom − value +, *Celá stěna*. Coordinates of the pointer bottom-left.
- **Left panel, tab „Vrstvy“** (new): every item grouped by place – *Stěna*,
  *Na skříni*, *Šuplíky* (row prefix Š1…Š5) – with count per group, search
  box, small thumb, name, inventory number (brass, mono) or „dekorace“, a ☀
  mark for light sources. Click = select + pan to it (for drawer items: open
  the drawer). Selection syncs both ways with the wall. Second tab
  „Knihovna“ = today's drag-onto-the-wall library.
- **Right inspector** with tabs:
  - *Umístění* – „Kde je“ segmented *Stěna / Skříň / Šuplík ▾*; X, Y, Š(width),
    ∠(rotation) as 2×2 compact fields (mono digits); *Dozadu / Dopředu*.
  - *Vzhled* – image swap, opening („Nakreslit otvor…“), light info.
  - *Exponát* – on/off switch, inventory number, slug; **no text fields here**.
  - Under the tabs: **exhibit summary card** („Obsah exponátu – kompletní /
    chybí …“, checklist: název+technika+popis, počet fotek, štítek) with
    link *Upravit obsah v Exponátech →* (`#exponaty/<slug>`).
  - Actions: *Zaměnit obrázek…*, *Duplikovat*, *Sundat ze stěny* (danger).
- Selection outline **cool blue `#5aa9ff`** (gold would vanish among gilt
  frames), label above the selection „Název · š × v“, corner handles, a
  rotation handle; snap guides in brass. **Page end (`CUT_Y`) drawn as a
  dashed amber line** labelled „konec stránky“.
- Status bar: „31 věcí · 15 exponátů · Vybráno: 1“, short key hints +
  link to the full shortcut list (today's „Klávesy“ popover).

**2 · Exponáty** (replaces exhibit fields in the inspector)
- Left list (≈400 px): thumb, title, medium (or what is missing, in amber),
  inventory number. Filter chips: *Vše · Bez fotek · Bez popisu · V šuplících*
  with counts. Button *+ Udělat exponát z věci…* (pick a decoration).
- Right: document-style editor, max ≈880 px wide:
  inventory badge, place, *Ukázat na stěně* (→ `#stena`, selects + pans),
  *Otevřít detail na webu ↗*; **title** as a large IM Fell English input;
  medium; address `…/e/<slug>/`; description textarea with a character
  count; tags as chips with an inline „přidat štítek…“ input; plaque checkbox.
- **Gallery:** 4-column grid, **reorder by drag & drop** (keep ↑↓ as keyboard
  fallback), first = cover with a brass *OBÁLKA* badge, caption input under
  each photo, last tile = drop zone; *Vybrat z knihovny*.
- **Share preview:** card showing what the link preview will look like
  (cover, domain, „Title · Cabinet of Curiosities“, description trimmed) –
  built from the same data as the OG tags.
- Autosave on blur/debounce like the rest (status in the top bar).

**3 · Knihovna** (replaces tabs Import + Knihovna)
- Grid (5 columns) on a checkerboard for transparency; filter chips by kind
  (*Věci na stěnu, Fotky do galerií, Tapeta a špína, Skříň, Dveře, Zvuky*) +
  *Nepoužité* (amber); search; usage count per image („1×“, „nepoužito“).
- Selected image → detail strip: size, alpha, look, where it is used (links),
  *Změnit look…*, *Nastavit světlo…*, *Nahradit soubor…* (+ delete only when unused).
- **Import panel** (right side sheet, opens on drop or button): thumbnails of
  the dropped files, „Co to je“ as 4 large choice cards, look as thumbnail
  tiles (*Žádný*, presets, `.cube` LUTs), **before/after split slider**,
  checkbox *Po importu dát na stěnu* (for wall items: places them near the
  view centre), primary *Importovat N*. Gallery photos dropped while an
  exhibit is open in Exponáty go straight into its gallery.

**4 · Místnost** (replaces tab „Stěna a skříň“ + „Nastavení“)
- Left sub-nav: *Místnost* – Tapeta a špína, **Skříň a šuplíky**, Úvodní
  dveře, Jmenovka (texts now editable – open item from phase 3); *Web* –
  Adresa a popis, Světlo a efekty (today's fx switches + hand candle),
  Statistika (analytics token).
- **Skříň a šuplíky:** the cabinet body photo with drawers drawn as
  rectangles **on the photo** – draw new (*+ Nakreslit šuplík*), drag, resize,
  numbered; the **page end as a draggable amber line** on the photo (sets
  `cutY`). Right column: korpus + samet media pickers, one card per drawer
  (front image, what is inside, warning „chybí fotka čela“). The numeric
  drawer table goes away (keep numbers editable in the drawer card if needed).

**Look of the admin** (separate from the site's theme)
- Dark neutral so it does not compete with the green wall: app `#141416`,
  panels `#1a1a1d`, fields `#232327`, borders `#2c2c31`/`#3a3a40`, text
  `#e8e4dc`, secondary `#9a958c`, disabled `#6a665f`.
- Accent **brass `#c9a24a`** (primary buttons, active tab underline,
  inventory badges, cover badge; text on it `#1a1408`); selection **blue
  `#5aa9ff`**; warning/missing **amber `#e0a04a`**; ok **`#6fbf73`**; danger
  text `#f0a39a`.
- Type: **IBM Plex Sans** for UI, **IBM Plex Mono** for numbers/coordinates/
  inventory numbers, **IM Fell English (SC)** only for the wordmark and the
  exhibit title input. Self-host Plex (OFL) like the site fonts – no CDN.
  13 px base, 11 px uppercase section labels with letter-spacing.
- Radii 6–10 px, 1 px borders, no heavy shadows except floating toolbars.
- Desktop only is fine (≥ 1280 px); panels must not overlap below that –
  side panels may collapse.

**Keep from today (behaviour must not change):** every editor gesture and
shortcut (drag, Shift multi-select, handles, `[` `]`, arrows, ⌘D, ⌫,
⌘Z/⌘⇧Z, Esc), snapping, drawer open on click, opening dialog, revision check
on save (409 on a stale layout), all API endpoints and the data model, tests.
This phase is a **UI restructure**, not new data.

**Order of work (each step usable on its own, `npm test` green after each):**
1. Shell: one page, top bar, hash routing, admin theme + fonts; move the wall
   editor into section Stěna (old `/editor` redirects to `/#stena`).
2. Layers panel + inspector tabs + exhibit summary card.
3. Exponáty section (list, filters, document editor, gallery drag & drop,
   share preview); remove text fields from the inspector.
4. Knihovna + global drop + import side sheet; remove the Import tab.
5. Místnost with the visual drawer editor and draggable page end; settings
   moved in; nameplate texts editable; remove the „Položky“ table and old tabs.
- **Done when:** Martin can do every task in one obvious place; the old
  „Správa“ tabs and `/editor` are gone; nothing that worked before is lost.

### Phase 4 – exhibit pages, list page, SEO (still local)
- Build `docs/e/<slug>/index.html` with OG tags; viewer opens that exhibit on load
  (navigation with `pushState` between real files, as Fotogalerie).
- `docs/list/` plain list of exhibits (search engines, screen readers, no-drag visitors), linked from `<noscript>`.
- `sitemap.xml`, `robots.txt`, favicon, `404.html` in cabinet style.
- **Done when:** `/preview/e/time-transit/` opens the detail; OG tags correct.

### Phase 4b – entrance: the cabinet doors (D14)
The first thing a visitor sees: the closed doors of the cabinet in candlelight.
A **separate, minimal static page** – no wall code, no big images, loads instantly.

- **URLs:** `docs/index.html` = doors; the wall moves to `docs/cabinet/index.html`;
  exhibits stay at `docs/e/<slug>/` (they open the wall directly, no doors);
  `docs/list/` has no doors. Everything relative to `{{ROOT}}` (Fotogalerie invariant 4).
- **No animation.** Click on the doors (they are a `<button>`/link
  "Enter the cabinet", Enter/Space work too):
  1. play the **door creak** (allowed – it is inside the click),
  2. swap the closed-doors photo for a **photo of the doors ajar** (preloaded,
     small) – one image swap, no transition,
  3. navigate to `cabinet/` when the sound ends (~1 s; cap it, e.g. 1.4 s, and
     navigate immediately if audio fails or `prefers-reduced-motion` is set).
  Navigation would cut the sound off, hence the short wait.
- **No background loading of the wall** on the doors page (Martin's concern:
  decoding big images in the background feels like a freeze). At most a
  `<link rel="prefetch">` for `cabinet/` HTML + `data.json` – network only, no
  decoding, no main-thread work. Leave out if it causes any visible hitch.
- **Candlelight on the doors:** reuse the small light/darkness module (one
  quarter-res canvas, cheap) so the doors are found by candlelight like the
  room. Candle cursor (phase 6) applies here too.
- Own Open Graph tags for the doors page (the doors photo as preview image);
  Cloudflare Web Analytics loader on both pages.
- Optional small brass plate near the doors ("Cabinet of Curiosities ·
  Martin Pošta") – Martin decides the copy.
- **Assets** (`assets-inbox/doors/`): `closed.(png|jpg)` – the full doors
  scene, `ajar.(png|jpg)` – the same framing with the doors slightly open,
  `creak.(wav|ogg)` – exported to `.ogg` + `.mp3` for Safari, short, normalised.
  Sound licence must be CC0 or own recording (e.g. Freesound with the CC0
  filter) → `CREDITS.md`.
- **Done when:** the doors page loads instantly, the click plays the creak,
  shows the ajar photo and lands on the wall; deep links bypass the doors.

### Phase 5 – publish (ONLY when Martin explicitly says so – D7)
- Create the public GitHub repo (Martin), add `origin`, Settings → Pages: `main` + `/docs`.
- `docs/CNAME`, Cloudflare CNAME `cabinet` → `martinposta.github.io` **DNS only**, wait for the
  certificate, *Enforce HTTPS*. Commit author / noreply e-mail as Fotogalerie (D23 there).
- Cloudflare Web Analytics token (D13) – Martin creates the site in Cloudflare and pastes the token into admin settings.
- **Done when:** https://cabinet.martinposta.com loads.

### Phase 6 – light, shadow, candle cursor (after the content works)
Performance rules – the prototype once dropped to ~2 fps; keep everything per-frame in canvases:

| Effect | How | Cost |
|---|---|---|
| **Candle cursor** (candle on a metal tray) | `cursor: none` + one absolutely positioned element moved by `transform` on `pointermove`; flame = small sprite/CSS animation. Native cursor stays on `hover: none`/touch (no cursor) and in the admin. Not a CSS `cursor: url()` (size capped ~128 px, no animation). | negligible |
| **Cast shadows on the wall** | Import generates a **shadow sprite** per item (alpha silhouette, blurred, small). A **shadow canvas** between the wallpaper canvas and `#world`, half resolution, redrawn each frame: for every visible item `drawImage(shadow, offset)`, offset = direction away from the hand candle × distance factor, softer and longer when the light is close. Only the hand candle casts dynamic shadows; shelf candles get a fixed baked shadow. | low (≈ one `drawImage` per visible item at half res) |
| **Shadow inside the picture** (frame lip shading the canvas) | Needs the item's **opening** (D5). Painted **into the existing darkness canvas** (quarter res, already redrawn every frame): for each visible framed item, a soft dark gradient along the opening edges on the side away from the light, clipped to the opening. Static ambient occlusion inside the frame stays baked in Martin's image. | low |
| ✗ Changing CSS `box-shadow`/`filter: drop-shadow` per frame | Forces re-rasterising the whole `#world` layer every frame. **Do not.** | very high |

**Room candles experiment (D12).** Each candle placed in the room casts
**static** shadows: computed once at load (or when the layout changes) for the
items within its light radius and drawn into the same shadow canvas each frame
(no extra per-frame cost beyond the `drawImage`). Things to watch, and how to
keep them from looking wrong:
- *Double shadows* when the hand candle is near a room candle – physically
  correct; keep both, each at its own opacity.
- *A hand-candle shadow falling into an area a room candle lights* looks too
  dark (real light would fill it). Cheap fix: scale the hand shadow's opacity
  per item by `1 − roomLightAt(item)` (distance falloff of the nearest room
  candle, computed per item, not per pixel).
- *Hard edges where a room candle's radius ends* – fade the static shadow
  with the same falloff as the light cut-out.
- If it still looks odd after these: `roomCandleShadows: false`, delete the code (D12).

- **Done when:** shadows follow the candle, ≥ 50 fps while dragging on Martin's Mac.

### Phase 7 – optional
Video in the viewer (D8), ambient sound (candle crackle after first click), admin on Proxmox (Fotogalerie 7b pattern).

### Phase 8 – notices board, wallpaper around the doors, number-only plaques (brief 2026-11-20)
Three independent tasks, in this order. `npm test` green after each; Martin's
running admin is never stopped (tests on a copy, own port).

#### 8a – Notices board („Aktuality“)
A small chalkboard where the visitor reads what is new. **Deliberately simple**
(Martin rejected categories, links, pictures and a „latest lines“ preview as
too complicated): the board itself is only a picture, the text is readable
only after a click.

**On the wall**
- The board is an **ordinary hung item** (Martin's photo of a small slate in a
  frame, the chalk „writing“ baked into the texture – nothing readable, no live
  text on it). It is placed, resized, rotated and layered like anything else.
- Marked by **`item.opens = "notices"`** (Stěna → inspector → Vzhled or
  Exponát tab: „Otevírá aktuality“). At most one item may carry it – the
  server refuses a second one. It is **not an exhibit**: no inventory number,
  no plaque, no slug, not in Exponáty, not in `list/`.
- It behaves like an exhibit for the visitor: hover lift, pointer cursor,
  keyboard focus + Enter, click opens the notices panel. Cast/contact shadows
  as any item.
- **„Sundat ze stěny“ exactly as for exhibits** (the same stored-off-wall
  mechanism): off the wall it keeps its media and settings and can be hung back
  („Pověsit zpět“ puts it where it was). Where Martin finds it: a status card at
  the top of the new Aktuality tab – „Tabule je na stěně · Ukázat na stěně ·
  Sundat ze stěny“ / „Tabule je mimo stěnu · Pověsit zpět“ – and the usual
  inspector action on Stěna.
- Stand-in until Martin has a photo: generate one like the surround stand-ins
  (small dark slate, worn walnut frame, a few wavy chalk scribble lines and a
  smudge, transparent around, ~600 px tall), import it as ordinary media into
  his library, hang it near the nameplate and switch `opens` on. He replaces it.

**Beside the doors (entrance page)**
- A **copy of the same board** (same media) hangs beside the door casing.
  It is shown **only while the wall board is on the wall**; taking the board off
  the wall hides it on the doors page too, hanging it back shows it again.
  No separate on/off switch.
- Default place: right of the casing, centred around handle height, its height
  proportional to the casing (≈ ¼ of the casing height). Adjustable in Místnost
  → Úvodní dveře: drag/resize it on the doors preview, stored as
  `doors.noticesAt = {x, y, h}` in fractions of the portal box (4 decimals,
  like `frameOpening`).
- Click on it opens the same notices panel **on the doors page itself** – no
  creak, no navigation to the wall. The doors page must stay light (D14): the
  notices are written into the doors HTML at build time (a small JSON block),
  no `data.json` fetch. Narrow window where it does not fit next to the casing
  (phone): hide it.

**The panel (both places, same component)**
- Opens over a dark veil: the **same board close up**, large (≈ 820 px, fits the
  window height): walnut frame, slate surface, **chalk handwriting**. Mockup
  board 3 („Otevřený panel“).
- Content = a **timeline by date, newest first**: each entry is a date
  (e.g. „20 November 2026“, `en-GB`, in a brighter chalk) and its text, one
  paragraph per line break (reuse `paragraphs()`), a faint chalk squiggle between
  entries. **Nothing else** – no categories, no filters, no links, no images.
- Scrolls inside the board (faint chalk scrollbar, fade at the bottom); close
  with × (same big button as the viewer), Esc, click on the veil; focus moves
  into the panel and back to the board on close.
- Fonts: **Caveat** (text) and **Caveat Brush** (dates), OFL – self-hosted like
  the other fonts (latin + latin-ext, only the weights used), licences into
  `CREDITS.md`. The slate surface may be a library image (role „tabule –
  povrch“) with a CSS gradient as fallback.
- No notices yet: the panel shows one line „Nothing new yet.“.
- Phone list version: no board for now.

**Data**
- `data.notices = [{ id, date: "YYYY-MM-DD", text }]` (text English, plain,
  max a few thousand characters); `publicData()` passes them sorted newest
  first. Validated server-side (valid date, non-empty text, unique id).
- `diffCabinet` reports notices added / changed / removed in the publish
  preview; `check-release`: an empty notice text is a content error.

**Admin – new tab „Aktuality“** (top bar: Stěna · Exponáty · **Aktuality** ·
Knihovna · Místnost). Mockup board 4. One centred column (≈ 760 px):
- the board status card (above);
- „+ Nový zápis“ adds an entry with today's date and an empty, focused text;
- each entry = a card with a **date field** and an **auto-growing textarea**
  (plain text, a line break = a new paragraph), „Smazat“ with an in-page
  confirmation; newest first, re-sorted when a date changes (on blur);
- autosave like everywhere else (status in the top bar), undo not needed.

**Done when:** Martin writes a notice in the admin, it shows on the opened
board on the wall and next to the doors; taking the board off the wall hides
both, hanging it back shows both.

#### 8b – Wallpaper around the doors
The entrance page has black emptiness around the door casing. Fill it with
**the room's wallpaper** (the same tile media, scaled so it reads the same size
relative to the doors as on the wall at zoom 1) and the room's **grime overlay**
when one is set. The doors page does not pan or zoom, so a plain static CSS
background is fine here (no per-frame cost). The darkness, candlelight and
vignette stay on top as now. Use a small derivative (the tile only) – the page
must stay fast (it loads in ~180 ms today).
- **Done when:** around the doors there is the same green wallpaper as in the
  room, in candlelight; load time and request count about the same.

#### 8c – Plaques show only the inventory number
The plaque text „001 Time Transit“ is too long and distracting. Every exhibit
plaque now reads only **„Inv. no. 001“** (museum convention; three digits as
now) – on the wall, above things standing on something, on the cabinet, the
paper tags in the drawers and the phone list. The title stays everywhere else
(viewer, `list/`, page titles, OG tags, the item's `aria-label` – the plaque
itself becomes decorative for screen readers). Plaque sizes/positions
(`plates.plaque`, `plaqueAt`) keep working; plaques simply get shorter.
- **Done when:** no plaque on the site shows a title, only „Inv. no. NNN“.

## 6. Open questions
- (none right now)

## 7. Rules from the prototype that must not break
Tuned over many rounds with Martin. Put them in `CLAUDE.md`.

**Performance:**
- No `mix-blend-mode` and no `filter` on full-screen layers; no per-frame CSS shadow changes.
- Wallpaper = **one full-screen `<canvas>`**, tile rendered once, drawn via `createPattern` with a transform.
- `#world` has `will-change: transform`, moves only via `translate3d() scale()`; re-rasterised once after zoom settles.
- Darkness = **quarter-resolution canvas**; lights cut out with `destination-out` (hand candle + every media with `light`).
- Wall images are static `<img>` with sensible sizes. The camera stops when it reaches its target.

**Interaction:**
- **Pan by dragging** (mouse, pen, finger) – never by following the cursor (wall jumped after closing the viewer).
- Click vs drag threshold 6 px; a drag ending over an item does not open it (capture-phase click handler).
- **No camera animation** – instant pan and zoom, no inertia, no rubber band.
- Wheel zoom **towards the cursor**, pinch on touch.
- **Zoom limits:** max **1.25**; min **0.7** on a ~1566 px wide window, proportionally less on narrower ones (`0.7 * min(1, vw/1566)`).
- Side margins in screen px (26 % of window width, max 440 px).
- **The cabinet is the bottom edge:** camera never below `CUT_Y`; the cabinet's foot is never visible.
- No HUD. Keyboard: arrows, +/−, 0 (farthest view), Enter on a focused exhibit.

**Look:**
- Night room: black screen edges, flickering candlelight around the cursor (off with
  `prefers-reduced-motion`), candles placed in the room light themselves.
- Nameplate above the centre piece with clear space around it.
- Drawer opens: front slides down, reveals a velvet tray with objects.

## 8. Assets – what Martin prepares (`assets-inbox/`)

```
assets-inbox/
  wallpaper/        seamless tile (≥ 1024 px) + optional large non-tiling grime/stain image
  items/            one image per wall item: frame + picture together, PNG/TIFF with alpha
  objects/          shelves, candles, skulls, decorations – cut-outs with alpha
  cabinet/          body.png (empty drawer openings), drawer-<n>.png fronts, tray.png velvet
  plates/           blank brass plates (text is live)
  doors/            entrance: closed.png, ajar.png (same framing), creak.wav
  exhibits/<slug>/  gallery photos of one exhibit (≥ 2000 px) + info.md (English)
  looks/            optional .cube LUTs
```

Every third-party file: source URL + licence → `CREDITS.md`. Only **CC0 / public domain / own
work**. "Fair use" is not a licence (US court defence) – no images of unclear origin (e.g. Pinterest).

Sources (CC0 / public domain): Cooper Hewitt / Smithsonian Open Access (historic wallpapers),
The Met Open Access (frames, objects, botanical prints), Rijksmuseum (incl. photographed frames),
Poly Haven + ambientCG (wood, metal, fabric, surface imperfections), Biodiversity Heritage Library
(old botanical/zoological plates).

// Builds the wall from data.json: hung items (frames, shelves), the nameplate, the cabinet with its
// drawers, candle halos. Positions are data (placed by hand, PLAN D4); only the cabinet's drawer grid
// and the derived bounds are computed here.

import { R, esc } from './util.js';
import { mediaImg, mediaUrl } from './media.js';

const PAINTED=new Map(); // placeholder paint cache: key -> blob URL
const PAD_TOP=44;                       // room above an item for its wire and nail
const SHELF={plank:18,bracket:44};
const ROOM=70;                          // clear space around the nameplate
// cabinet geometry (world units); x/top/w come from data
const CAB_GEOM={w:1260,topH:34,inset:22,pad:26,gap:16,r1:150,r2:172};

// The brass plaque of an exhibit. `pqAt` ({dx,dy}, world px, dragged in the admin) moves it off its default
// place as two custom properties the CSS adds to its transform; `data-pq` lets the editor find it.
function makePlaque(it, cls){
  const p=document.createElement("div"); p.className=cls; p.dataset.pq=it.id;
  p.innerHTML=`<b>${it.inv}</b>${esc(it.title)}`;
  if(it.pqAt){ p.style.setProperty("--pq-dx",`${it.pqAt.dx}px`); p.style.setProperty("--pq-dy",`${it.pqAt.dy}px`); }
  return p;
}

// data item -> the runtime shape the drawing code works with (the phone list uses it too)
export function runtimeItem(d, i, MEDIA){
  const p=d.placeholder||{}, f=p.frame||{}, ex=d.exhibit;
  const m=d.media&&MEDIA[d.media];
  const it={ id:d.id, x:d.x, y:d.y, rotation:d.rotation||0, seed:p.seed??(17+i*53), aw:p.w, ah:p.h,
    art:p.paint==="art"?p.name:undefined, shelf:p.paint==="object"?p.name:undefined,
    shape:f.shape||"rect", mat:f.mat||"gold", fw:f.fw??20, ornate:!!f.ornate,
    on:d.on, drawer:d.drawer, px:d.dx, py:d.dy, work:!!ex, opening:d.opening, sits:d.sits, pqAt:d.plaqueAt };
  // a real image: w is its world width, the height follows its aspect; aw/ah feed the cabinet code
  if(m){ Object.assign(it,{ mediaId:d.media, m, aw:d.w, ah:d.w*m.h/m.w, art:undefined, shelf:undefined }); }
  if(ex) Object.assign(it,{ slug:ex.slug, title:ex.title, medium:ex.medium||"", desc:ex.description||"",
    tags:ex.tags||[], inv:String(ex.inv).padStart(3,"0"), gallery:ex.gallery||[], captions:ex.captions||{}, plaque:ex.plaque!==false });
  return it;
}

// the site's faces by role (FONTS in lib/build.mjs); "italic" is IM Fell's italic cut
const FONT={display:"var(--f-display)",italic:"var(--f-display)",label:"var(--f-label)",body:"var(--f-body)"};

/**
 * Plaque look as custom properties on #world, read by .plaque in cabinet.css. With an image the plaque
 * is a 9-slice: the outer `ends` % of the image on each side keep their shape (screws, rounded corners),
 * the middle stretches with the title.
 */
export function plateLook(world,PQ,MEDIA){
  const st=world.style, m=PQ.media&&MEDIA[PQ.media];
  for(const k of ["--pq-font","--pq-style","--pq-size","--pq-color","--pq-num","--pq-img","--pq-slice","--pq-end"]) st.removeProperty(k);
  world.classList.toggle("pq-img",!!m); world.classList.toggle("pq-flat",PQ.engraved===false);
  if(PQ.font){ st.setProperty("--pq-font",FONT[PQ.font]||FONT.label); st.setProperty("--pq-style",PQ.font==="italic"?"italic":"normal"); }
  if(PQ.size) st.setProperty("--pq-size",`${PQ.size}px`);
  if(PQ.color) st.setProperty("--pq-color",PQ.color);
  if(PQ.numColor) st.setProperty("--pq-num",PQ.numColor);
  if(m){
    const url=new URL(mediaUrl(PQ.media,m,m.widths[0]),document.baseURI).href;
    // plaque height is 2.2 × the font size (cabinet.css); an end keeps the image's own proportions
    const h=(PQ.size||14)*2.2, end=h*(PQ.ends??30)/100*m.w/m.h;
    st.setProperty("--pq-img",`url("${url}")`); st.setProperty("--pq-slice",`${PQ.ends??30}%`); st.setProperty("--pq-end",`${end.toFixed(1)}px`);
  }
}

/**
 * The nameplate, unplaced: a "plate" image when one is set, otherwise the painted SVG cartouche (concave
 * corners, bevel, engraved inner line, two screws); the text is live HTML over it. Exported so the
 * admin's preview (Místnost → Jmenovka a štítky) is the same element, not a copy of it.
 */
export function makeNameplate(W,H,NP,MEDIA,{title,line}){
  const npImg=NP.media&&MEDIA[NP.media];
  const el=document.createElement("div"); el.className="nameplate"+(NP.engraved===false?" flat":"");
  el.style.width=`${W}px`; el.style.height=`${H}px`;
  if(npImg){ const im=mediaImg(NP.media,npImg,W,"np-img"); el.appendChild(im); el.img=im; }
  else {
    const r=26, ins=10, r2=r+ins;
    const k=Math.sqrt(r2*r2-ins*ins); // where the inner line meets the inner corner arcs
    const outer=`M${r} 0H${W-r}A${r} ${r} 0 0 1 ${W} ${r}V${H-r}A${r} ${r} 0 0 1 ${W-r} ${H}H${r}A${r} ${r} 0 0 1 0 ${H-r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
    const inner=`M${k} ${ins}H${W-k}A${r2} ${r2} 0 0 1 ${W-ins} ${k}V${H-k}A${r2} ${r2} 0 0 1 ${W-k} ${H-ins}H${k}A${r2} ${r2} 0 0 1 ${ins} ${H-k}V${k}A${r2} ${r2} 0 0 1 ${k} ${ins}Z`;
    const screw=x=>`<g transform='translate(${x} ${H/2})'><circle r='9' fill='url(#sc)' stroke='#4a3008' stroke-width='1'/><path d='M-6 -2.5L6 2.5' stroke='#3a2606' stroke-width='2.2' stroke-linecap='round' transform='rotate(${x<W/2?-30:20})'/></g>`;
    const svg=`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f8e6a8'/><stop offset='.3' stop-color='#dcb35c'/><stop offset='.55' stop-color='#a97f2e'/><stop offset='.8' stop-color='#e8ca7a'/><stop offset='1' stop-color='#8a6420'/></linearGradient>
        <linearGradient id='sheen' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.35' stop-color='#fff6d8' stop-opacity='.35'/><stop offset='.5' stop-color='#fff' stop-opacity='0'/></linearGradient>
        <radialGradient id='sc' cx='.35' cy='.3'><stop offset='0' stop-color='#fff1bf'/><stop offset='.55' stop-color='#c9a24a'/><stop offset='1' stop-color='#5e420f'/></radialGradient>
        <pattern id='br' width='${W}' height='3' patternUnits='userSpaceOnUse'><rect width='${W}' height='1' fill='rgba(80,50,10,.10)'/></pattern>
        <clipPath id='c'><path d='${outer}'/></clipPath>
      </defs>
      <path d='${outer}' fill='url(#g)'/>
      <g clip-path='url(#c)'><rect width='${W}' height='${H}' fill='url(#br)'/><rect width='${W}' height='${H}' fill='url(#sheen)'/></g>
      <path d='${outer}' fill='none' stroke='#4a3008' stroke-width='3'/>
      <path d='${outer}' fill='none' stroke='rgba(255,244,205,.55)' stroke-width='1.2' transform='translate(${W*0.003} 1.5) scale(.994 .977)'/>
      <path d='${inner}' fill='none' stroke='rgba(70,44,8,.55)' stroke-width='1.6'/>
      <path d='${inner}' fill='none' stroke='rgba(255,240,200,.45)' stroke-width='1' transform='translate(0 1.4)'/>
      <path d='M${W/2-206} ${H*.7}H${W/2-166}M${W/2+166} ${H*.7}H${W/2+206}' stroke='rgba(70,44,8,.5)' stroke-width='1.2'/>
      ${screw(30)}${screw(W-30)}
    </svg>`;
    el.style.backgroundImage=`url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  const font=(k,size,color)=>k?`font-family:${FONT[k]||FONT.display};font-style:${k==="italic"?"italic":"normal"};font-size:${size}px;color:${color}`:"";
  el.insertAdjacentHTML("beforeend",`<h1 style="${font(NP.font,NP.size,NP.color)}">${esc(title)}</h1><p style="${font(NP.subFont,NP.subSize,NP.subColor)}">${esc(line)}</p>`);
  if(NP.dy) el.style.setProperty("--np-dy",`${NP.dy}px`);
  return el;
}

export function buildWall(world, data){
  const settings=data.settings;
  const MEDIA=data.media||{};
  const all=data.items.map((d,i)=>runtimeItem(d,i,MEDIA));
  const WALL_ITEMS=all.filter(it=>it.on!=="cabinet"&&it.drawer==null);
  const CAB_TOP=all.filter(it=>it.on==="cabinet");
  const CAB_HIDDEN=all.filter(it=>it.drawer!=null);
  const CAB_ITEMS=CAB_TOP.concat(CAB_HIDDEN);
  const EXHIBIT_COUNT=all.filter(it=>it.work).length;
  const PLATE={...data.nameplate};
  // the look of the nameplate and the plaques (admin → Místnost → Jmenovka a štítky); a "plate" image
  // replaces the painted brass, and the nameplate then takes the image's own proportions
  const PL=data.plates||{nameplate:{},plaque:{}}, NP=PL.nameplate||{}, PQ=PL.plaque||{};
  const npImg=NP.media&&MEDIA[NP.media];
  if(NP.w) PLATE.w=NP.w;
  if(npImg) PLATE.h=Math.round(PLATE.w*npImg.h/npImg.w);
  plateLook(world,PQ,MEDIA);

  const radii=(it)=>{
    if(it.shape==="oval"||it.shape==="circle") return ["50%","50%","50%"];
    if(it.shape==="arch"){ const a=it.ow/2, b=a-it.fw, c2=b-6; return [`${a}px ${a}px 3px 3px`,`${b}px ${b}px 1px 1px`,`${c2}px ${c2}px 0 0`]; }
    return ["3px","1px","0"];
  };
  WALL_ITEMS.forEach(it=>{
    if(it.m){ it.ow=it.aw; it.oh=it.ah; it.padB=it.work?56:10; return; }
    if(it.shelf){ it.ow=Math.round(it.aw+56); it.oh=it.ah+SHELF.plank+SHELF.bracket; it.padB=it.work?56:10; return; }
    it.ow=it.aw+2*(it.fw+6); it.oh=it.ah+2*(it.fw+6); it.padB=it.work?56:10;
  });
  // bounds of everything hung, the nameplate's clear space included
  // an exhibit standing on something – its bottom on the top of another hung item (a shelf), the same
  // contact the editor's snapping makes – gets its plaque ABOVE it: below, the plaque lands on the shelf
  // board or the cabinet's top edge and cannot be read (Martin). Objects on the cabinet top: always above.
  WALL_ITEMS.forEach(it=>{
    if(!it.work) return;
    const b=it.y+it.oh/2;
    // standing on a bookcase shelf (sits) counts too: the plaque below would land on the shelf board
    it.plaqueAbove=!!it.sits||WALL_ITEMS.some(o=>o!==it&&Math.abs((o.y-o.oh/2)-b)<6&&it.x>o.x-o.ow/2&&it.x<o.x+o.ow/2);
    if(it.plaqueAbove) it.padB=10;
  });
  const boxes=WALL_ITEMS.map(it=>({x0:it.x-it.ow/2,x1:it.x+it.ow/2,y0:it.y-it.oh/2-PAD_TOP,y1:it.y+it.oh/2+it.padB}));
  boxes.push({x0:PLATE.x-PLATE.w/2-ROOM,x1:PLATE.x+PLATE.w/2+ROOM,y0:PLATE.y-PLATE.h/2-ROOM,y1:PLATE.y+PLATE.h/2});
  const BOUNDS={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity};
  boxes.forEach(p=>{BOUNDS.x0=Math.min(BOUNDS.x0,p.x0);BOUNDS.x1=Math.max(BOUNDS.x1,p.x1);BOUNDS.y0=Math.min(BOUNDS.y0,p.y0);BOUNDS.y1=Math.max(BOUNDS.y1,p.y1);});
  BOUNDS.cx=(BOUNDS.x0+BOUNDS.x1)/2; BOUNDS.cy=(BOUNDS.y0+BOUNDS.y1)/2; BOUNDS.w=BOUNDS.x1-BOUNDS.x0; BOUNDS.h=BOUNDS.y1-BOUNDS.y0;

  const CAB={...CAB_GEOM, w:data.cabinet.w||CAB_GEOM.w};
  CAB.cx=data.cabinet.x; CAB.x0=CAB.cx-CAB.w/2; CAB.top=data.cabinet.top;
  CAB.row1=CAB.topH+24; CAB.row2=CAB.row1+CAB.r1+CAB.gap;
  // a photographed cabinet (PLAN phase 2): body photo + drawer rectangles from data, in world px from
  // the cabinet's top-left; otherwise the painted walnut chest with three drawers above two
  const BODY=data.cabinet.body&&MEDIA[data.cabinet.body];
  const RECTS=[];
  if(BODY){
    CAB.bodyH=CAB.w*BODY.h/BODY.w;
    (data.cabinet.drawers||[]).forEach(d=>RECTS.push({x:d.x,y:d.y,w:d.w,h:d.h,front:d.front&&MEDIA[d.front]?d.front:null}));
  } else {
    const ix0=CAB.inset+CAB.pad, iw=CAB.w-2*ix0;
    [[CAB.row1,CAB.r1,3],[CAB.row2,CAB.r2,2]].forEach(([y,h,n])=>{
      const w=(iw-(n-1)*CAB.gap)/n;
      for(let i=0;i<n;i++) RECTS.push({x:ix0+i*(w+CAB.gap),y,w,h,front:null});
    });
  }
  // CUT_Y is the lowest line the screen may ever show: the cabinet's foot stays hidden. Default: just
  // above the bottom of the lowest drawer; data.cabinet.cutY (from the cabinet top) overrides it.
  const lowest=RECTS.length?Math.max(...RECTS.map(r=>r.y+r.h)):(CAB.bodyH||400)*.8+26;
  const CUT_Y=CAB.top+(data.cabinet.cutY??lowest-26);
  // the room: by default it grows with what hangs on the wall; data.room (admin → Stěna → Velikost
  // místnosti) fixes its left, right and top edge – the bottom is always the page end, CUT_Y – and the
  // camera then never shows anything outside it (WALL.hard)
  // A room that grows with its content makes space for the surround outside the content, so the side
  // panels and the cornice never cover what hangs at the edges; in a fixed room they sit inside it.
  const R=data.room, SG=data.surround?.on?data.surround:null, sx=SG?SG.sideW+40:0, sy=SG?SG.corniceH+40:0;
  const WALL=R?{x0:R.x0,x1:R.x1,y0:R.y0,y1:CUT_Y,hard:true}
    :{x0:Math.min(BOUNDS.x0,CAB.x0-30)-sx,x1:Math.max(BOUNDS.x1,CAB.x0+CAB.w+30)+sx,y0:BOUNDS.y0-sy,y1:CUT_Y};
  CAB_TOP.forEach(it=>{ it.x-=CAB.cx; });   // the cabinet code places top objects relative to its centre

  const candleSources=[]; // lights carried by real images (media.light): [x, y, radius] in world px
  // a thing standing on a bookcase is laid after it (so it is drawn in front) and at least at its layer
  const byId=new Map(WALL_ITEMS.map(it=>[it.id,it]));
  const hostOf=it=>it.sits&&it.sits!==it.id?byId.get(it.sits):null;
  const depth=it=>{ let d=0, c=it; while((c=hostOf(c))&&d<20) d++; return d; };
  WALL_ITEMS.forEach(it=>{ const h=hostOf(it); if(h&&(h.z||0)>(it.z||0)) it.z=h.z; });
  [...WALL_ITEMS].sort((a,b)=>depth(a)-depth(b)).forEach((it,k)=>{
    const hang=document.createElement("div"); hang.className="hang"; hang.dataset.id=it.id;
    hang.style.cssText=`left:${it.x-it.ow/2}px;top:${it.y-it.oh/2}px;width:${it.ow}px;--i:${k}${it.z?`;z-index:${it.z}`:""}`;
    if(it.m){
      const im=mediaImg(it.mediaId,it.m,it.ow,`piece${it.work?" work":""}`);
      im.style.cssText=`width:${it.ow}px;height:${it.oh}px;--tilt:${it.rotation.toFixed(2)}deg;background:${it.m.alpha?"transparent":it.m.color}`;
      if(it.work){ im.tabIndex=0; im.setAttribute("role","button"); im.alt=`${it.title}, ${it.medium}. Open the gallery`; }
      hang.appendChild(im);
      if(it.work&&it.plaque) hang.appendChild(makePlaque(it,`plaque${it.plaqueAbove?" above":""}`));
      world.appendChild(hang);
      it.el=im;
      if(it.m.light) candleSources.push([it.x-it.ow/2+it.m.light.x*it.ow, it.y-it.oh/2+it.m.light.y*it.oh, it.m.light.radius]);
      return;
    }
    if(it.shelf){
      const sh=document.createElement("div"); sh.className=`shelf${it.work?" work":""}`; sh.style.cssText=`width:${it.ow}px;height:${it.oh}px`;
      if(it.work){ sh.tabIndex=0; sh.setAttribute("role","button"); sh.setAttribute("aria-label",`${it.title}, ${it.medium}. Open the gallery`); }
      const B=SHELF.bracket, W=it.ow, bx=[W*.2,W*.8];
      // front view of a scrolled iron bracket: post down the wall, curl at the foot, brass screw heads
      const bracket=x=>`<g transform='translate(${x} 0)'>
        <path d='M-4 0H4V${B-14}C4 ${B-4} -10 ${B-2} -10 ${B-12}C-10 ${B-18} -2 ${B-18} -2 ${B-13}' fill='none' stroke='#1c1a17' stroke-width='5' stroke-linecap='round'/>
        <path d='M-1.5 1V${B-15}' stroke='rgba(255,230,180,.25)' stroke-width='1.2'/>
        <circle cx='0' cy='${B*.32}' r='2.4' fill='#c9a24a' stroke='#4a3008' stroke-width='.6'/></g>`;
      sh.innerHTML=`<img class="obj" alt="" draggable="false" decoding="async" style="left:${(W-it.aw)/2}px;bottom:${B+SHELF.plank-2}px;width:${it.aw}px;height:${it.ah}px">
        <div class="plank" style="bottom:${B}px"></div>
        <svg class="brackets" style="bottom:0;height:${B}px" viewBox="0 0 ${W} ${B}" aria-hidden="true">${bracket(bx[0])}${bracket(bx[1])}</svg>`;
      hang.appendChild(sh);
      if(it.work&&it.plaque) hang.appendChild(makePlaque(it,"plaque"));
      world.appendChild(hang);
      it.img=sh.querySelector(".obj"); it.el=sh;
      return;
    }
    const [fr,lr,cr]=radii(it);
    const round=it.shape==="oval"||it.shape==="circle";
    const ex=round?.36:.16, ey=round?60:48;
    hang.innerHTML=`<svg class="wire" viewBox="0 0 ${it.ow} 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M${it.ow/2} 6 L${it.ow*ex} ${ey} M${it.ow/2} 6 L${it.ow*(1-ex)} ${ey}" stroke="rgba(196,176,120,.55)" stroke-width="1.3" fill="none"/>
        <circle cx="${it.ow/2}" cy="6" r="4.2" fill="#b8954a" stroke="#4a3008" stroke-width=".8"/><circle cx="${it.ow/2-1.2}" cy="4.8" r="1.4" fill="#f3d98b"/></svg>`;
    const fr_el=document.createElement("div");
    fr_el.className=`frame m-${it.mat}${it.work?" work":""}`;
    fr_el.style.cssText=`width:${it.ow}px;height:${it.oh}px;--fw:${it.fw}px;--tilt:${it.rotation.toFixed(2)}deg;border-radius:${fr}`;
    if(it.work){ fr_el.tabIndex=0; fr_el.setAttribute("role","button"); fr_el.setAttribute("aria-label",`${it.title}, ${it.medium}. Open the gallery`); }
    if(it.ornate&&it.shape==="rect"){ const o=document.createElement("div"); o.className="orn"; fr_el.appendChild(o); }
    const liner=document.createElement("div"); liner.className="liner"; liner.style.borderRadius=lr;
    const cv=document.createElement("img"); cv.alt=""; cv.decoding="async"; cv.draggable=false; cv.style.borderRadius=cr;
    liner.appendChild(cv); fr_el.appendChild(liner); hang.appendChild(fr_el);
    if(it.work&&it.plaque) hang.appendChild(makePlaque(it,"plaque"));
    world.appendChild(hang);
    it.img=cv; it.el=fr_el;
  });
  const DRAWERS=[];
  { // cabinet
    const el=document.createElement("div"); el.className="cabinet";
    const bodyH=BODY?CAB.bodyH:CAB.row2+CAB.r2+320; // runs on past the page end
    el.style.cssText=`left:${CAB.x0}px;top:${CAB.top}px;width:${CAB.w}px;height:${bodyH}px`;
    if(BODY){ el.classList.add("photo"); el.appendChild(mediaImg(data.cabinet.body,BODY,CAB.w,"cab-photo")); }
    else el.innerHTML=`<div class="cab-body"></div><div class="cab-top"></div>`;
    const TRAY=data.cabinet.tray&&MEDIA[data.cabinet.tray];
    const handle=`<svg width="96" height="34" viewBox="-48 -17 96 34" aria-hidden="true">
        <circle cx="-34" cy="-4" r="9" fill="url(#hb)" stroke="#3a2606" stroke-width="1"/><circle cx="34" cy="-4" r="9" fill="url(#hb)" stroke="#3a2606" stroke-width="1"/>
        <path d="M-34 -4 C-34 18 34 18 34 -4" fill="none" stroke="#3a2606" stroke-width="7" stroke-linecap="round"/>
        <path d="M-34 -4 C-34 18 34 18 34 -4" fill="none" stroke="url(#hg)" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="-34" cy="-4" r="3" fill="#2a1a04"/><circle cx="34" cy="-4" r="3" fill="#2a1a04"/></svg>`;
    RECTS.forEach(({x,y,w,h,front})=>{
      const d=document.createElement("div"); d.className="drawer";
      d.style.cssText=`left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
      d.innerHTML=`<div class="tray"></div><div class="front${front?" photo":""}" role="button" tabindex="0" aria-expanded="false" aria-label="Drawer ${DRAWERS.length+1}">${front?"":handle}</div>`;
      if(front) d.querySelector(".front").appendChild(mediaImg(front,MEDIA[front],w,"front-photo"));
      if(TRAY){ const t=d.querySelector(".tray"); t.classList.add("photo"); t.appendChild(mediaImg(data.cabinet.tray,TRAY,w,"tray-photo")); }
      el.appendChild(d); DRAWERS.push({el:d,w,h,x,y});
    });
    // shared gradients for the brass handles
    el.insertAdjacentHTML("afterbegin",`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <radialGradient id="hb" cx=".35" cy=".3"><stop offset="0" stop-color="#fff1bf"/><stop offset=".55" stop-color="#c9a24a"/><stop offset="1" stop-color="#5e420f"/></radialGradient>
      <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3d98b"/><stop offset=".6" stop-color="#b8954a"/><stop offset="1" stop-color="#6b4a12"/></linearGradient></defs></svg>`);
    // objects standing on the top board
    CAB_TOP.forEach(it=>{
      const im=it.m?mediaImg(it.mediaId,it.m,it.aw,""):document.createElement("img"); im.className=`cab-obj${it.work?" work":""}`; im.alt=it.work?`${it.title}, ${it.medium}. Open the gallery`:""; im.draggable=false; im.decoding="async";
      im.style.cssText=`left:${CAB.w/2+it.x-it.aw/2}px;top:${4-it.ah}px;width:${it.aw}px;height:${it.ah}px;--tilt:${it.rotation.toFixed(2)}deg`;
      if(it.work){ im.tabIndex=0; im.setAttribute("role","button"); }
      im.dataset.id=it.id;
      el.appendChild(im); it.img=im; it.el=im;
      it.wx=CAB.cx+it.x; it.wy=CAB.top-it.ah/2;
      if(it.m?.light) candleSources.push([it.wx-it.aw/2+it.m.light.x*it.aw, CAB.top+4-it.ah+it.m.light.y*it.ah, it.m.light.radius]);
      if(it.work&&it.plaque){ const p=makePlaque(it,"plaque above"); p.style.left=`${CAB.w/2+it.x}px`; p.style.top=`${4-it.ah}px`; el.appendChild(p); }
    });
    // hidden objects lying in the drawers
    CAB_HIDDEN.forEach(it=>{
      const D=DRAWERS[it.drawer];
      if(!D) return; // drawer no longer exists (the cabinet was re-photographed with fewer drawers)
      const tray=D.el.querySelector(".tray");
      const im=it.m?mediaImg(it.mediaId,it.m,it.aw,""):document.createElement("img"); im.className=`item${it.work?" work":""}`; im.alt=it.work?`${it.title}, ${it.medium}. Open the gallery`:""; im.draggable=false; im.decoding="async";
      const sc=Math.min(1,(D.h*.62)/it.ah), w=it.aw*sc, h=it.ah*sc;
      im.style.cssText=`left:${D.w*it.px-w/2}px;top:${D.h*it.py-h/2}px;width:${w}px;height:${h}px;--tilt:${it.rotation.toFixed(2)}deg`;
      if(it.work){ im.tabIndex=-1; im.setAttribute("role","button"); }
      im.dataset.id=it.id;
      tray.appendChild(im); it.img=im; it.el=im;
      it.wx=CAB.x0+D.x+D.w*it.px; it.wy=CAB.top+D.y+D.h*it.py;
      if(it.work&&it.plaque){ const t=document.createElement("div"); t.className="tag"; t.style.cssText=`left:${Math.max(12,D.w*it.px-w/2-30)}px;top:${Math.max(12,D.h*it.py-h/2-14)}px`; t.innerHTML=`<b>${it.inv}</b>${esc(it.title)}`; tray.appendChild(t); }
    });
    world.appendChild(el);
    // drawers open and close; an open drawer's items become reachable by keyboard
    DRAWERS.forEach(D=>{
      const front=D.el.querySelector(".front");
      const toggle=()=>{ const open=D.el.classList.toggle("open"); front.setAttribute("aria-expanded",open);
        D.el.querySelectorAll(".item.work").forEach(i=>i.tabIndex=open?0:-1); };
      front.addEventListener("click",toggle);
      front.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); toggle(); } });
    });
  }

  // warm halo painted on the wall around every candle (shelf or cabinet)
  const candleFlames=[];
  WALL_ITEMS.filter(it=>it.shelf==="candle").forEach(it=>{
    const objTop=it.y-it.oh/2+(it.oh-(SHELF.bracket+SHELF.plank-2)-it.ah);
    candleFlames.push([it.x, objTop+it.ah*.15, 340]);
  });
  CAB_TOP.filter(it=>it.shelf==="candle").forEach(it=>candleFlames.push([CAB.cx+it.x, CAB.top+4-it.ah+it.ah*.15, 340]));
  candleFlames.push(...candleSources);
  candleFlames.forEach(([fx,fy,reach])=>{
    const r=300*reach/340, h=document.createElement("div");
    h.style.cssText=`position:absolute;left:${fx-r}px;top:${fy-r}px;width:${2*r}px;height:${2*r}px;pointer-events:none;background:radial-gradient(circle closest-side,rgba(255,190,100,.32),rgba(255,150,60,.12) 40%,rgba(255,130,40,0) 100%)`;
    world.prepend(h);
  });
  // the room's surround (admin → Místnost → Obložení): the wainscot runs along the bottom of the wall
  // behind everything hung and the cabinet; side panels and the cornice frame the room on top of it all
  const SU=data.surround;
  if(SU?.on){
    // the smallest derivative that is still sharp at zoom 1.25 on a 2× display (need: m => file px wide)
    const bg=(id,need)=>{ const m=id&&MEDIA[id]; if(!m) return null;
      const w=m.widths.find(x=>x>=need(m))??m.widths[m.widths.length-1];
      return { url:new URL(mediaUrl(id,m,w),document.baseURI).href, m }; };
    const div=(cls,css)=>{ const d=document.createElement("div"); d.className=cls; d.style.cssText=css; return d; };
    const W0=WALL.x0, W1=WALL.x1, Y0=WALL.y0, H=CUT_Y-WALL.y0;
    const wain=bg(SU.wainscot,m=>SU.wainscotH*2.5*m.w/m.h);
    if(wain){
      const tileW=SU.wainscotH*wain.m.w/wain.m.h;
      world.prepend(div("surround wainscot",`left:${W0}px;top:${CUT_Y-SU.wainscotH}px;width:${W1-W0}px;height:${SU.wainscotH}px;`
        +`background-image:url("${wain.url}");background-size:${tileW.toFixed(1)}px ${SU.wainscotH}px`));
    }
    const top=bg(SU.sideTop,()=>SU.sideW*2.5), mid=bg(SU.sideMid,()=>SU.sideW*2.5);
    if(top||mid) for(const right of [false,true]){
      const side=div(`surround side${right?" right":""}`,`left:${right?W1-SU.sideW:W0}px;top:${Y0}px;width:${SU.sideW}px;height:${H}px`);
      if(top){ const im=document.createElement("img"); im.className="cap"; im.alt=""; im.src=top.url; im.decoding="async"; side.appendChild(im); }
      if(mid) side.appendChild(div("mid",`background-image:url("${mid.url}")`));
      world.appendChild(side);
    }
    const cor=bg(SU.cornice,m=>SU.corniceH*2.5*m.w/m.h);
    if(cor){
      const tileW=SU.corniceH*cor.m.w/cor.m.h;
      world.appendChild(div("surround cornice",`left:${W0}px;top:${Y0}px;width:${W1-W0}px;height:${SU.corniceH}px;`
        +`background-image:url("${cor.url}");background-size:${tileW.toFixed(1)}px ${SU.corniceH}px`));
    }
  }
  // grime / stains: one large image with alpha stretched over the wall, behind everything (no blend modes)
  const GRIME=data.wall?.grime&&MEDIA[data.wall.grime];
  if(GRIME){
    const gw=WALL.x1-WALL.x0, gh=WALL.y1-WALL.y0+400;
    const g=mediaImg(data.wall.grime,GRIME,gw,"grime");
    g.style.cssText=`left:${WALL.x0}px;top:${WALL.y0}px;width:${gw}px;height:${gh}px;opacity:${data.wall.grimeOpacity??1}`;
    g.alt=""; world.prepend(g);
  }
  { // nameplate
    const el=makeNameplate(PLATE.w,PLATE.h,NP,MEDIA,{ title:settings.plateTitle, line:`${settings.plateSubtitle} · ${EXHIBIT_COUNT} exhibit${EXHIBIT_COUNT===1?"":"s"}` });
    el.dataset.id="__nameplate"; el.style.left=`${PLATE.x-PLATE.w/2}px`; el.style.top=`${PLATE.y-PLATE.h/2}px`;
    world.prepend(el);
  }

  // paint each picture once into a scratch canvas, then hang it as a static image (cheap to composite);
  // results are cached per painter+seed+size, so the editor's rebuilds after every change stay instant
  const scratch=document.createElement("canvas");
  async function paintAll(){
    // the canvas painters (49 kB) are fetched only when a stand-in is left to paint
    if(!WALL_ITEMS.concat(CAB_ITEMS).some(it=>!it.m&&it.img)) return;
    const { OBJ, paintArt }=await import('./placeholders.js');
    for(const it of WALL_ITEMS.concat(CAB_ITEMS)){
      if(it.m||!it.img) continue;
      const key=`${it.shelf||it.art}|${it.seed}|${it.aw}x${it.ah}`;
      if(PAINTED.has(key)){ it.img.src=PAINTED.get(key); continue; }
      scratch.width=it.aw*2; scratch.height=it.ah*2;
      const ctx=scratch.getContext("2d");
      if(it.shelf){ ctx.clearRect(0,0,scratch.width,scratch.height); OBJ[it.shelf](ctx,scratch.width,scratch.height,R(it.seed)); }
      else paintArt(ctx,scratch.width,scratch.height,it,0);
      const blob=await new Promise(res=>scratch.toBlob(res,it.shelf?"image/png":"image/jpeg",.9));
      it.img.src=URL.createObjectURL(blob); PAINTED.set(key,it.img.src);
      await new Promise(res=>setTimeout(res,0)); // yield so the page stays responsive while painting
    }
  }

  // an empty wall frames the nameplate
  const centre=WALL_ITEMS[0]||{x:PLATE.x,y:PLATE.y+PLATE.h,oh:0,padB:0};
  // the page's start (where the view opens): data.view, else above the middle of the cabinet at the height
  // between the nameplate's top and the centre piece's plaque
  const top=PLATE.y-PLATE.h/2, bot=centre.y+centre.oh/2+centre.padB;
  const START={ x:data.view?.x??CAB.cx, y:data.view?.y??(top+bot)/2 };
  return { WALL, BOUNDS, PLATE, CUT_Y, CAB, DRAWERS, centre, START, candleFlames, items:all, exhibits:all.filter(it=>it.work), paintAll };
}

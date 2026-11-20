// Exhibit viewer: a framed slideshow next to the catalogue card. Placeholder slides are painted
// on canvas until an exhibit has a real gallery.

import { roman, esc } from './util.js';
// every line written in the admin is its own paragraph (an empty line between them does not add a second gap)
const paragraphs=t=>String(t||"").split(/\n+/).map(p=>p.trim()).filter(Boolean);
// the canvas painters (49 kB) are fetched only if a painted stand-in is ever opened
const painters=()=>import('./placeholders.js');
import { mediaUrl } from './media.js';

// media: data.media, for exhibits with a real gallery (exhibit.gallery = media ids, first = cover)
const SIZES="(max-width:820px) 100vw, 860px";
function setSources(img,id,m){
  img.sizes=SIZES;
  img.srcset=m.widths.map(w=>`${mediaUrl(id,m,w)} ${w}w`).join(", ");
  img.src=mediaUrl(id,m,m.widths[m.widths.length-1]);
}

export function createViewer({ ui, onClose, media = {} }) {
  const V={el:document.getElementById("viewer"),stage:document.getElementById("vStage"),frame:document.getElementById("vFrame"),
    count:document.getElementById("vCount"),cap:document.getElementById("vCaption"),dots:document.getElementById("vDots"),
    inv:document.getElementById("vInv"),title:document.getElementById("vTitle"),medium:document.getElementById("vMedium"),
    desc:document.getElementById("vDesc"),tags:document.getElementById("vTags"),close:document.getElementById("vClose")};
  const CAPS=["Overall view","Detail","Another variant","Close up, warm light"];
  const note=document.querySelector(".card .note");
  let cur=0, imgs=[], caps=[], lastFocus=null;
  function openViewer(it){
    lastFocus=document.activeElement; ui.viewerOpen=true;
    V.inv.textContent=`inv. no. ${it.inv}`; V.title.textContent=it.title; V.medium.textContent=it.medium; V.desc.replaceChildren(...paragraphs(it.desc).map(t=>Object.assign(document.createElement("p"),{textContent:t})));
    V.tags.innerHTML=it.tags.map(t=>`<li>${esc(t)}</li>`).join("");
    V.stage.querySelectorAll("img").forEach(n=>n.remove()); V.dots.innerHTML="";
    const dot=v=>{ const d=document.createElement("button"); d.type="button"; d.setAttribute("aria-label",`Slide ${v+1}`); d.addEventListener("click",()=>show(v)); V.dots.appendChild(d); };
    // the gallery's photos; without any, a real image shows itself – its own wall picture, one slide.
    // Only painted stand-ins still get the four painted placeholder slides.
    let real=(it.gallery||[]).filter(id=>media[id]);
    if(!real.length&&it.mediaId&&media[it.mediaId]) real=[it.mediaId];
    V.stage.classList.toggle("real",real.length>0);
    if(note) note.hidden=real.length>0;
    if(real.length){
      // the stage takes the cover's proportions; other photos are fitted inside it
      const c=media[real[0]];
      V.el.style.setProperty("--ar",(c.w/c.h).toFixed(4));   // on .viewer: the photo frame and the layout both read it
      caps=real.map(id=>it.captions?.[id]||"");
      // the photos are only created here; each one is fetched and *decoded off the main thread* before it
      // is shown (load()), the cover first and the rest after it – inserting four 2048 px photos at once
      // had them decoded mid-animation, which is what made opening a detail stutter
      imgs=real.map((id,v)=>{
        const img=new Image(); img.alt=caps[v]||`${it.title}, photo ${v+1}`; img.decoding="async";
        img._media=[id,media[id]];
        V.stage.insertBefore(img,V.stage.firstChild); dot(v);
        return img;
      });
      V.dots.hidden=imgs.length<2; V.stage.querySelectorAll(".nav").forEach(n=>n.hidden=imgs.length<2);
      V.el.hidden=false; show(0); V.close.focus();
      return;
    }
    V.dots.hidden=false; V.stage.querySelectorAll(".nav").forEach(n=>n.hidden=false);
    caps=CAPS;
    const ar=it.m?it.aw/it.ah:it.shelf?4/3:it.aw/it.ah;
    V.el.style.setProperty("--ar",ar.toFixed(4));
    const W=1200, H=Math.round(W/ar);
    V.el.hidden=false; V.close.focus();
    painters().then(({paintArt,paintObjSlide})=>{
    imgs=[0,1,2,3].map(v=>{
      const cv=document.createElement("canvas"); cv.width=W; cv.height=H;
      if(it.m){ const c=cv.getContext("2d"); c.fillStyle="#0c1510"; c.fillRect(0,0,W,H); if(it.el?.complete) c.drawImage(it.el,0,0,W,H); }
      else if(it.shelf) paintObjSlide(cv.getContext("2d"),W,H,it,v); else paintArt(cv.getContext("2d"),W,H,it,v);
      const img=new Image(); img.alt=`${it.title}: ${CAPS[v]} (placeholder)`; img.src=cv.toDataURL("image/jpeg",.88);
      V.stage.insertBefore(img,V.stage.firstChild);
      dot(v);
      return img;
    });
    show(0);
    });
  }
  // fetch + decode one slide (real photos only); painted slides already have their pixels
  function load(img){
    if(!img._media) return Promise.resolve();
    if(!img._ready){ setSources(img,...img._media); img._ready=img.decode().catch(()=>{}); }
    return img._ready;
  }
  function show(i){
    cur=(i+imgs.length)%imgs.length;
    const want=cur, img=imgs[want];
    // the old slide stays until the new one is decoded, then they cross-fade
    load(img).then(()=>{
      if(want!==cur) return;
      imgs.forEach((im,k)=>im.classList.toggle("on",k===want));
      // neighbours next, so the arrows find them ready
      [want+1,want-1].forEach(k=>{ const n=imgs[(k+imgs.length)%imgs.length]; if(n) load(n); });
    });
    [...V.dots.children].forEach((d,k)=>d.setAttribute("aria-current",k===cur?"true":"false"));
    V.count.textContent=`${roman(cur+1)} / ${roman(imgs.length)}`; V.cap.textContent=caps[cur]||"";
    V.count.hidden=imgs.length<2;
  }
  function closeViewer(){ V.el.hidden=true; ui.viewerOpen=false; onClose(); if(lastFocus&&lastFocus.focus) lastFocus.focus({preventScroll:true}); }
  V.close.addEventListener("click",closeViewer);
  document.getElementById("vPrev").addEventListener("click",()=>show(cur-1));
  document.getElementById("vNext").addEventListener("click",()=>show(cur+1));
  V.el.addEventListener("click",e=>{ if(e.target===V.el) closeViewer(); });
  addEventListener("keydown",e=>{
    if(!ui.viewerOpen) return;
    if(e.key==="Escape") closeViewer();
    if(e.key==="ArrowLeft") show(cur-1);
    if(e.key==="ArrowRight") show(cur+1);
  });
  // a swipe across the photo turns the page; mostly sideways only, so scrolling the detail on a phone
  // (a vertical move that drifts a little) does not flip the photo
  let sx=null, sy=0;
  V.stage.addEventListener("pointerdown",e=>{ sx=e.clientX; sy=e.clientY; });
  V.stage.addEventListener("pointerup",e=>{ if(sx===null) return; const d=e.clientX-sx, dy=e.clientY-sy; sx=null; if(Math.abs(d)>40&&Math.abs(d)>Math.abs(dy)*1.5) show(cur+(d<0?1:-1)); });
  V.stage.addEventListener("pointercancel",()=>{ sx=null; });

  // hovering an exhibit starts fetching and decoding its cover, so a click finds it ready
  const warmed=new Set();
  function prefetch(it){
    const id=(it.gallery||[]).find(g=>media[g]);
    if(!id||warmed.has(id)) return;
    warmed.add(id);
    const img=new Image(); img.decoding="async"; setSources(img,id,media[id]); img.decode().catch(()=>{});
  }
  return { open: openViewer, close: closeViewer, prefetch };
}

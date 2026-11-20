// Real images (PLAN phase 2): every media item has WebP derivatives at media/<id>/<width>.webp.

/** URL of one derivative; `?v=` changes when the image is re-rendered (a new look). */
export const mediaUrl=(id,m,w)=>`media/${id}/${w}.webp?v=${m.v||1}`;

/** URL of a quick preview (`p<width>.webp`, see IMAGE.preview in lib/config.mjs). */
const previewUrl=(id,m,pw)=>`media/${id}/p${pw}.webp?v=${m.v||1}`;

/**
 * The derivative a srcset with sizes=worldW would pick: the smallest at least worldW × DPR wide. Images live
 * inside the scaled #world, so this asks for zoom 1: at the closest zoom (1.25) that is a touch soft, but
 * every file is smaller to decode, and decoding big images mid-pan was part of the stutter (2026-10-13).
 */
export const fullWidth=(m,worldW)=>m.widths.find(w=>w>=worldW*Math.min(window.devicePixelRatio||1,3))??m.widths[m.widths.length-1];

// Preview first, full file after (Martin, 2026-11-20): an image with a preview shows it at once and swaps to
// the full derivative once that is downloaded *and decoded* – swapping `src` to an image already decoded
// elsewhere repaints in one step, so nothing blinks. The wall holds the swaps until its previews are in,
// then fetches the full files nearest the middle of the screen first; elsewhere each swaps on its own.
let held=false;
const pending=[];
const loaded=im=>im.complete?Promise.resolve():new Promise(r=>{im.addEventListener("load",r,{once:true});im.addEventListener("error",r,{once:true});});
/** Fetches the full file of `im`; resolves once it is downloaded (the decode and the swap follow on their own). */
function upgrade(im){
  const url=im.dataset.full; if(!url) return Promise.resolve();
  delete im.dataset.full;
  const f=new Image(); f.decoding="async"; f.src=url;
  return loaded(f).then(()=>{
    // decoded off-screen first, so the swap repaints in one step – but decode() never settles in a tab that is
    // not being rendered, so it gets a short while and the swap happens regardless
    Promise.race([f.decode().catch(()=>{}),new Promise(r=>setTimeout(r,400))]).then(()=>{ im.src=url; });
  });
}
/** From now on the full files wait for releaseUpgrades() (the wall calls this before it builds). */
export function holdUpgrades(){ held=true; }
/**
 * Once the previews on screen are in (or after 3 s), fetch the full files, nearest the middle of the screen
 * first. Previews off screen do not hold anything up: by the time anyone pans there they are long in.
 */
export async function releaseUpgrades(){
  held=false;
  const list=pending.splice(0), cx=innerWidth/2, cy=innerHeight/2;
  const at=list.map(im=>{ const r=im.getBoundingClientRect(), seen=r.width>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;
    return { im, seen, d:r.width?Math.hypot(r.left+r.width/2-cx,r.top+r.height/2-cy):1e9 }; }).sort((a,b)=>a.d-b.d);
  await Promise.race([Promise.all(at.filter(x=>x.seen).map(x=>loaded(x.im))),new Promise(r=>setTimeout(r,3000))]);
  let i=0;
  const worker=async()=>{ while(i<at.length) await upgrade(at[i++].im); };
  await Promise.all([worker(),worker(),worker(),worker()]);
}

/** A static <img> for a media item shown `worldW` world px wide – its preview first when it has one. */
export function mediaImg(id,m,worldW,cls){
  const im=document.createElement("img");
  im.className=cls; im.alt=""; im.draggable=false; im.decoding="async";
  im.width=Math.round(worldW); im.height=Math.round(worldW*m.h/m.w);
  const fw=fullWidth(m,worldW), pw=m.pv?.[fw];
  if(!pw){ im.src=mediaUrl(id,m,fw); return im; }
  im.src=previewUrl(id,m,pw); im.dataset.full=mediaUrl(id,m,fw);
  if(held) pending.push(im); else loaded(im).then(()=>upgrade(im));
  return im;
}

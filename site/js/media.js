// Real images (PLAN phase 2): every media item has WebP derivatives at media/<id>/<width>.webp.

/** URL of one derivative; `?v=` changes when the image is re-rendered (a new look). */
export const mediaUrl=(id,m,w)=>`media/${id}/${w}.webp?v=${m.v||1}`;

/**
 * A static <img> for a media item shown `worldW` world px wide. Images live inside the scaled #world,
 * where the browser picks a srcset candidate by layout size, not by on-screen size. `sizes` asks for
 * zoom 1: at the closest zoom (1.25) that is a touch soft, but every file is smaller to decode, and
 * decoding big images mid-pan was part of the stutter (2026-10-13).
 */
export function mediaImg(id,m,worldW,cls){
  const im=document.createElement("img");
  im.className=cls; im.alt=""; im.draggable=false; im.decoding="async";
  im.src=mediaUrl(id,m,m.widths[m.widths.length-1]);
  im.srcset=m.widths.map(w=>`${mediaUrl(id,m,w)} ${w}w`).join(", ");
  im.sizes=`${Math.round(worldW)}px`;
  im.width=Math.round(worldW); im.height=Math.round(worldW*m.h/m.w);
  return im;
}

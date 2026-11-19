// Small shared helpers.

// seeded PRNG (mulberry32): the same seed always paints the same placeholder
export const R = s => () => { s|=0; s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// 1 -> "I", 14 -> "XIV" (slide counter; a gallery can be longer than the prototype's six)
export const roman=n=>[[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]].reduce((s,[v,r])=>{ while(n>=v){ s+=r; n-=v; } return s; },"");
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

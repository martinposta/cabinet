// Canvas-painted placeholders: pictures, shelf objects, frame ornaments and the wallpaper tile.
// Used for every item without real media (PLAN phase 1); real photographs replace them item by item.

import { R, clamp } from './util.js';

export function decorSvgs(){
  const ros = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><defs><radialGradient id='g' cx='40%' cy='35%'><stop offset='0' stop-color='#fff2c0'/><stop offset='.5' stop-color='#d4ad55'/><stop offset='1' stop-color='#5e420f'/></radialGradient></defs><g fill='url(#g)' stroke='#4a3008' stroke-width='.6'>${[0,45,90,135,180,225,270,315].map(a=>`<ellipse cx='20' cy='9' rx='4.2' ry='8' transform='rotate(${a} 20 20)'/>`).join("")}<circle cx='20' cy='20' r='6.5'/></g><circle cx='20' cy='20' r='2.6' fill='#3a2606'/></svg>`;
  const crest = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 88 40'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fbe6a6'/><stop offset='.55' stop-color='#c79d45'/><stop offset='1' stop-color='#6b4a12'/></linearGradient></defs><g fill='url(#g)' stroke='#4a3008' stroke-width='.7'><path d='M44 2 C52 10 54 20 44 30 C34 20 36 10 44 2Z'/><path d='M44 26 C56 18 70 18 80 26 C72 24 62 28 56 34 C52 30 48 28 44 30Z'/><path d='M44 26 C32 18 18 18 8 26 C16 24 26 28 32 34 C36 30 40 28 44 30Z'/><circle cx='44' cy='32' r='5'/></g></svg>`;
  const damask = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='200' viewBox='0 0 140 200'><defs><g id='m'><path d='M0 -40 C15 -22 15 4 0 20 C-15 4 -15 -22 0 -40Z'/><path d='M0 8 C18 4 32 -10 26 -26 C22 -36 10 -32 14 -22 C18 -12 10 -4 0 0Z'/><path d='M0 8 C-18 4 -32 -10 -26 -26 C-22 -36 -10 -32 -14 -22 C-18 -12 -10 -4 0 0Z'/><path d='M0 18 C10 28 24 28 30 42 C16 40 6 34 0 26Z'/><path d='M0 18 C-10 28 -24 28 -30 42 C-16 40 -6 34 0 26Z'/><circle cx='0' cy='-50' r='3.2'/><circle cx='0' cy='34' r='2.6'/><path d='M0 -64 l4 6 l-4 6 l-4 -6Z'/></g></defs><g fill='rgba(140,190,148,.085)' stroke='rgba(214,180,100,.07)' stroke-width='1'><use href='#m' x='70' y='100'/><use href='#m' x='0' y='0'/><use href='#m' x='140' y='0'/><use href='#m' x='0' y='200'/><use href='#m' x='140' y='200'/></g><g fill='rgba(214,180,100,.06)'><circle cx='70' cy='0' r='2'/><circle cx='0' cy='100' r='2'/><circle cx='140' cy='100' r='2'/><circle cx='70' cy='200' r='2'/></g></svg>`;
  const u = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  const rs = document.documentElement.style;
  rs.setProperty("--rosette", u(ros));
  rs.setProperty("--crest", u(crest));
  // pre-render one wallpaper tile (2x) to a bitmap; the wall canvas only fills it as a pattern
  const tile=document.createElement("canvas"); tile.width=280; tile.height=400;
  const tc=tile.getContext("2d"); tc.fillStyle="#163126"; tc.fillRect(0,0,280,400);
  tc.fillStyle="rgba(0,0,0,.07)"; tc.fillRect(0,0,2,400); tc.fillRect(140,0,2,400);
  const im=new Image();
  im.onload=()=>{ tc.drawImage(im,0,0,280,400); window.__wallTile=tile; window.__wallDirty=true; };
  im.src=`data:image/svg+xml,${encodeURIComponent(damask)}`;
  window.__wallTile=tile;
}

/* ================= painting ================= */
function ground(c,w,h,a,b,cx=.5,cy=.42){
  const g=c.createRadialGradient(w*cx,h*cy,0,w*cx,h*cy,Math.hypot(w,h)*.62);
  g.addColorStop(0,a); g.addColorStop(1,b); c.fillStyle=g; c.fillRect(-w,-h,w*3,h*3);
}
function texture(c,w,h,r){
  c.save();
  for(let i=0;i<w*h/220;i++){ c.fillStyle=r()<.5?"rgba(255,240,210,.035)":"rgba(0,0,0,.06)"; c.fillRect(r()*w,r()*h,1+r()*2.5,1+r()*2.5); }
  c.lineCap="round";
  for(let i=0;i<40;i++){
    c.strokeStyle=r()<.5?"rgba(255,235,200,.025)":"rgba(0,0,0,.05)"; c.lineWidth=3+r()*12;
    const x=r()*w,y=r()*h; c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo(x+(r()-.5)*80,y+(r()-.5)*40,x+(r()-.5)*160,y+(r()-.5)*60); c.stroke();
  }
  c.fillStyle="rgba(0,0,0,.025)"; for(let y=0;y<h;y+=3) c.fillRect(0,y,w,1);
  c.restore();
}
function varnish(c,w,h,warm){
  c.save();
  const g=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.hypot(w,h)*.6);
  g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,"rgba(0,0,0,.5)"); c.fillStyle=g; c.fillRect(0,0,w,h);
  c.globalCompositeOperation="soft-light"; c.fillStyle=warm?"rgba(220,140,50,.45)":"rgba(200,145,70,.28)"; c.fillRect(0,0,w,h);
  c.restore();
}
function leafShape(c,x,y,len,wid,ang,fill,rib){
  c.save(); c.translate(x,y); c.rotate(ang);
  c.beginPath(); c.moveTo(0,0); c.quadraticCurveTo(wid,-len*.5,0,-len); c.quadraticCurveTo(-wid,-len*.5,0,0);
  c.fillStyle=fill; c.fill();
  if(rib){ c.strokeStyle=rib; c.lineWidth=Math.max(1,wid*.08); c.beginPath(); c.moveTo(0,0); c.lineTo(0,-len*.92); c.stroke(); }
  c.restore();
}
function glowDot(c,x,y,rad,col){
  const g=c.createRadialGradient(x,y,0,x,y,rad); g.addColorStop(0,col); g.addColorStop(1,"rgba(0,0,0,0)");
  c.fillStyle=g; c.beginPath(); c.arc(x,y,rad,0,Math.PI*2); c.fill();
}
function stem(c,x0,y0,x1,y1,bend,col,lw){ c.strokeStyle=col; c.lineWidth=lw; c.lineCap="round"; c.beginPath(); c.moveTo(x0,y0); c.quadraticCurveTo((x0+x1)/2+bend,(y0+y1)/2,x1,y1); c.stroke(); }
function daisy(c,x,y,s,r){
  for(let i=0;i<16;i++){ const a=i/16*Math.PI*2+r()*.1; c.save(); c.translate(x,y); c.rotate(a);
    c.fillStyle=i%2?"#efe6cf":"#e3d7b8"; c.beginPath(); c.ellipse(0,-s*.55,s*.13,s*.42,0,0,Math.PI*2); c.fill(); c.restore(); }
  c.fillStyle="#d9a63a"; c.beginPath(); c.arc(x,y,s*.22,0,Math.PI*2); c.fill();
  c.fillStyle="rgba(120,70,10,.55)"; for(let i=0;i<14;i++){ c.beginPath(); c.arc(x+(r()-.5)*s*.3,y+(r()-.5)*s*.3,s*.025,0,7); c.fill(); }
}
function rose(c,x,y,s,r){
  const g=c.createRadialGradient(x-s*.2,y-s*.25,s*.1,x,y,s); g.addColorStop(0,"#f6cfae"); g.addColorStop(.6,"#e2a07a"); g.addColorStop(1,"#a8623f");
  c.fillStyle=g; c.beginPath(); c.arc(x,y,s*.85,0,7); c.fill();
  c.strokeStyle="rgba(120,55,30,.55)"; c.lineWidth=s*.05; c.lineCap="round";
  for(let i=0;i<8;i++){ const rr=s*(.15+i*.09); const a0=r()*6; c.beginPath(); c.arc(x+(r()-.5)*s*.1,y+(r()-.5)*s*.1,rr,a0,a0+1.6+r()*1.4); c.stroke(); }
  c.strokeStyle="rgba(255,225,200,.45)"; c.lineWidth=s*.03; c.beginPath(); c.arc(x-s*.1,y-s*.2,s*.45,3.4,4.6); c.stroke();
}
function sunflower(c,x,y,s,r){
  for(let k=0;k<2;k++) for(let i=0;i<22;i++){ const a=i/22*Math.PI*2+k*.14; c.save(); c.translate(x,y); c.rotate(a);
    leafShape(c,0,-s*.3,s*.72,s*.15,0,k?"#e8b23a":"#c98a1e",null); c.restore(); }
  c.fillStyle="#3a2412"; c.beginPath(); c.arc(x,y,s*.36,0,7); c.fill();
  c.fillStyle="#6a4520"; for(let i=0;i<60;i++){ const a=i*2.4,d=Math.sqrt(i/60)*s*.32; c.beginPath(); c.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,s*.025,0,7); c.fill(); }
}

const ART = {
  timeTransit(c,w,h,r){
    ground(c,w,h,"#1b3a37","#050c0e");
    for(let i=0;i<160;i++){ c.fillStyle=`rgba(240,230,200,${.2+r()*.6})`; const s=r()*1.8+.4; c.fillRect(r()*w,r()*h*.75,s,s); }
    const cx=w*(.42+r()*.16), cy=h*.44, s=Math.min(w,h)*.42;
    glowDot(c,cx,cy,s*1.2,"rgba(120,220,210,.35)");
    glowDot(c,cx,cy,s*.4,"rgba(235,255,245,.75)");
    for(let i=0;i<5;i++){ c.strokeStyle=`rgba(226,188,104,${.75-i*.12})`; c.lineWidth=(5-i)*1.3; c.beginPath(); c.arc(cx,cy,s*(.42+i*.15),0,7); c.stroke(); }
    const R2=s*.87;
    for(let i=0;i<60;i++){ const a=i/60*Math.PI*2, L=i%5?s*.04:s*.1; c.strokeStyle="rgba(240,210,140,.8)"; c.lineWidth=i%5?1.2:2.4;
      c.beginPath(); c.moveTo(cx+Math.cos(a)*R2,cy+Math.sin(a)*R2); c.lineTo(cx+Math.cos(a)*(R2-L),cy+Math.sin(a)*(R2-L)); c.stroke(); }
    c.fillStyle="#f3d98b"; c.textAlign="center"; c.textBaseline="middle"; c.font=`${s*.11}px "IM Fell English", Georgia, serif`;
    ["XII","III","VI","IX"].forEach((t,i)=>{ const a=i*Math.PI/2-Math.PI/2; c.fillText(t,cx+Math.cos(a)*s*1.08,cy+Math.sin(a)*s*1.08); });
    c.strokeStyle="#f3d98b"; c.lineCap="round";
    [[r()*6,s*.55,4],[r()*6,s*.75,2.2]].forEach(([a,l,lw])=>{ c.lineWidth=lw; c.beginPath(); c.moveTo(cx,cy); c.lineTo(cx+Math.cos(a)*l,cy+Math.sin(a)*l); c.stroke(); });
    // floor and traveller
    const fy=h*.86; const fg=c.createLinearGradient(0,fy,0,h); fg.addColorStop(0,"rgba(120,220,210,.18)"); fg.addColorStop(1,"rgba(0,0,0,0)");
    c.fillStyle=fg; c.fillRect(0,fy,w,h-fy);
    c.strokeStyle="rgba(150,230,220,.35)"; c.lineWidth=1.5; c.beginPath(); c.ellipse(cx,fy,s*.9,s*.08,0,0,7); c.stroke();
    const px=cx, ph=s*.42; c.fillStyle="#04090a";
    c.beginPath(); c.arc(px,fy-ph,ph*.12,0,7); c.fill();
    c.beginPath(); c.moveTo(px-ph*.16,fy-ph*.86); c.lineTo(px+ph*.16,fy-ph*.86); c.lineTo(px+ph*.11,fy); c.lineTo(px-ph*.11,fy); c.fill();
    c.fillStyle="rgba(140,240,230,.9)"; c.fillRect(px-ph*.1,fy-ph*1.02,ph*.2,ph*.05);
  },
  optics(c,w,h,r){
    ground(c,w,h,"#20302d","#070d0c");
    const t=w/8.5, cx=w/2, cy=h*.5;
    const P=(i,j)=>[cx+(i-j)*t/2, cy+(i+j)*t/4];
    for(let i=-5;i<=5;i++) for(let j=-5;j<=5;j++){ const [x,y]=P(i,j);
      c.beginPath(); c.moveTo(x,y-t/4); c.lineTo(x+t/2,y); c.lineTo(x,y+t/4); c.lineTo(x-t/2,y); c.closePath();
      c.fillStyle=(i+j)%2?"#223631":"#1b2b27"; c.fill(); c.strokeStyle="rgba(140,180,160,.12)"; c.lineWidth=1; c.stroke(); }
    // laser path along grid axes
    const dirs=[[1,0],[0,1],[-1,0],[0,-1]];
    let i=-3,j=-2,d=0; const pts=[[i,j]];
    for(let k=0;k<5;k++){ const L=2+Math.floor(r()*2); i+=dirs[d][0]*L; j+=dirs[d][1]*L; i=clamp(i,-4,4); j=clamp(j,-4,4); pts.push([i,j]); d=(d+(r()<.5?1:3))%4; }
    const sp=pts.map(p=>P(p[0],p[1]));
    const cube=(x,y,s,top,l,rr)=>{ c.fillStyle=top; c.beginPath(); c.moveTo(x,y-s); c.lineTo(x+s,y-s/2); c.lineTo(x,y); c.lineTo(x-s,y-s/2); c.fill();
      c.fillStyle=l; c.beginPath(); c.moveTo(x-s,y-s/2); c.lineTo(x,y); c.lineTo(x,y+s*.8); c.lineTo(x-s,y+s*.3); c.fill();
      c.fillStyle=rr; c.beginPath(); c.moveTo(x+s,y-s/2); c.lineTo(x,y); c.lineTo(x,y+s*.8); c.lineTo(x+s,y+s*.3); c.fill(); };
    c.lineJoin="round"; c.lineCap="round";
    [[16,"rgba(255,60,40,.12)"],[7,"rgba(255,70,50,.35)"],[2.2,"#ffd7c8"]].forEach(([lw,col])=>{ c.strokeStyle=col; c.lineWidth=lw; c.beginPath(); sp.forEach((p,k)=>k?c.lineTo(p[0],p[1]-t*.12):c.moveTo(p[0],p[1]-t*.12)); c.stroke(); });
    sp.slice(1,-1).forEach(([x,y])=>{ c.fillStyle="rgba(0,0,0,.35)"; c.beginPath(); c.ellipse(x,y,t*.22,t*.09,0,0,7); c.fill();
      c.save(); c.translate(x,y-t*.12); c.rotate(r()<.5?-.6:.6); c.fillStyle="#cfd8d6"; c.fillRect(-t*.22,-3,t*.44,6); c.fillStyle="#ffffff"; c.fillRect(-t*.2,-3,t*.4,1.6); c.restore();
      glowDot(c,x,y-t*.12,t*.18,"rgba(255,120,90,.5)"); });
    const [ex,ey]=sp[0]; cube(ex,ey,t*.26,"#5b6b66","#3b4844","#2c3633"); glowDot(c,ex,ey-t*.12,t*.2,"rgba(255,90,60,.8)");
    const [tx,ty]=sp[sp.length-1]; c.strokeStyle="#f3d98b"; c.lineWidth=3; c.beginPath(); c.ellipse(tx,ty-t*.06,t*.2,t*.1,0,0,7); c.stroke(); glowDot(c,tx,ty-t*.1,t*.35,"rgba(255,210,140,.55)");
  },
  book(c,w,h,r){
    ground(c,w,h,"#3a2615","#0d0704",.75,.2);
    glowDot(c,w*.78,h*.2,w*.5,"rgba(255,180,90,.28)");
    c.fillStyle="#f6e2a8"; c.beginPath(); c.ellipse(w*.78,h*.17,w*.018,w*.04,0,0,7); c.fill();
    c.fillStyle="#d9cdb0"; c.fillRect(w*.765,h*.2,w*.03,h*.12);
    const cx=w/2, cy=h*.62, bw=w*.4, bh=h*.36;
    c.fillStyle="#4a1614"; c.beginPath(); c.moveTo(cx,cy-bh/2+16); c.lineTo(cx-bw-10,cy-bh/2+4); c.lineTo(cx-bw-10,cy+bh/2+14); c.lineTo(cx,cy+bh/2+22); c.lineTo(cx+bw+10,cy+bh/2+14); c.lineTo(cx+bw+10,cy-bh/2+4); c.fill();
    [-1,1].forEach(sx=>{
      const g=c.createLinearGradient(cx,0,cx+sx*bw,0); g.addColorStop(0,"#a8936a"); g.addColorStop(.18,"#e5d5b0"); g.addColorStop(1,"#efe2c2");
      c.fillStyle=g; c.beginPath(); c.moveTo(cx,cy-bh/2+10); c.quadraticCurveTo(cx+sx*bw*.5,cy-bh/2-14,cx+sx*bw,cy-bh/2);
      c.lineTo(cx+sx*bw,cy+bh/2); c.quadraticCurveTo(cx+sx*bw*.5,cy+bh/2-14,cx,cy+bh/2+6); c.fill();
      c.strokeStyle="rgba(70,50,30,.45)"; c.lineWidth=1.4;
      for(let k=0;k<11;k++){ const y=cy-bh/2+bh*.2+k*bh*.068; const x0=cx+sx*bw*.12, len=bw*(.6+r()*.22)*(k===10?.5:1);
        if(sx<0&&k<2) continue; c.beginPath(); c.moveTo(x0,y); c.lineTo(x0+sx*len,y); c.stroke(); }
    });
    c.fillStyle="#3a2a18"; c.textAlign="center"; c.font=`italic ${bh*.11}px "IM Fell English", Georgia, serif`; c.fillText("The Book",cx-bw*.5,cy-bh/2+bh*.2);
    c.fillStyle="#8a1f1a"; c.beginPath(); c.moveTo(cx+4,cy-bh/2+6); c.lineTo(cx+14,cy-bh/2+6); c.lineTo(cx+16,cy+bh/2+60); c.lineTo(cx+9,cy+bh/2+48); c.lineTo(cx+2,cy+bh/2+60); c.fill();
  },
  homelab(c,w,h,r){
    ground(c,w,h,"#1a2528","#04080a",.5,.3);
    const x=w*.3, rw=w*.4, top=h*.06, bot=h*.94;
    c.fillStyle="#14191b"; c.fillRect(x-8,top,rw+16,bot-top);
    c.fillStyle="#2b3236"; c.fillRect(x-8,top,10,bot-top); c.fillRect(x+rw-2,top,10,bot-top);
    const n=7, uh=(bot-top-20)/n;
    for(let k=0;k<n;k++){
      const y=top+10+k*uh; const g=c.createLinearGradient(0,y,0,y+uh-4); g.addColorStop(0,"#2f373b"); g.addColorStop(1,"#1d2326");
      c.fillStyle=g; c.fillRect(x+4,y,rw-8,uh-5);
      c.fillStyle="#0d1113"; for(let b=0;b<4;b++) c.fillRect(x+rw*.42+b*rw*.13,y+uh*.2,rw*.11,uh*.55);
      for(let l=0;l<3;l++){ const col=r()<.7?"#5fd38a":(r()<.5?"#e7a33c":"#7ab8e8"); const lx=x+rw*.08+l*rw*.06, ly=y+uh*.45;
        glowDot(c,lx,ly,uh*.35,col.replace(/^#(..)(..)(..)$/,(m,a,b2,cc)=>`rgba(${parseInt(a,16)},${parseInt(b2,16)},${parseInt(cc,16)},.35)`));
        c.fillStyle=col; c.beginPath(); c.arc(lx,ly,uh*.07,0,7); c.fill(); }
    }
    c.fillStyle="#b9a77a"; c.font=`${uh*.32}px "IM Fell English SC", Georgia, serif`; c.textAlign="left"; c.fillText("pve · thebook",x+rw*.08,top+10+uh*.88);
    c.lineWidth=5; c.lineCap="round";
    ["#2f4c6a","#6a5a2a","#3a5a40","#5a2a2a"].forEach((col,k)=>{ c.strokeStyle=col; c.beginPath(); const y=top+40+k*uh*1.5; c.moveTo(x+rw,y); c.bezierCurveTo(x+rw+w*.12,y+30,x+rw+w*.1,bot,w*.95,bot+10); c.stroke(); });
  },
  freetime(c,w,h,r){
    ground(c,w,h,"#203a2e","#07110c");
    const cx=w/2, cy=h*.5, s=Math.min(w,h)*.3;
    glowDot(c,cx,cy,s*2.2,"rgba(255,200,110,.25)");
    for(let i=0;i<24;i++){ const a=i/24*Math.PI*2; c.save(); c.translate(cx,cy); c.rotate(a);
      c.fillStyle=i%2?"#c9963a":"#f0cf7a";
      if(i%2){ c.beginPath(); c.moveTo(-s*.08,-s*1.05); c.lineTo(0,-s*1.75); c.lineTo(s*.08,-s*1.05); c.fill(); }
      else { c.strokeStyle="#f0cf7a"; c.lineWidth=s*.05; c.beginPath(); c.moveTo(0,-s*1.05); for(let k=1;k<=6;k++) c.lineTo((k%2?1:-1)*s*.07,-s*1.05-k*s*.11); c.stroke(); }
      c.restore(); }
    const g=c.createRadialGradient(cx-s*.3,cy-s*.3,s*.1,cx,cy,s); g.addColorStop(0,"#fff0bd"); g.addColorStop(.6,"#e2b453"); g.addColorStop(1,"#8a6420");
    c.fillStyle=g; c.beginPath(); c.arc(cx,cy,s,0,7); c.fill();
    c.fillStyle="#5a3d10"; c.beginPath(); c.arc(cx-s*.3,cy-s*.15,s*.08,0,7); c.arc(cx+s*.3,cy-s*.15,s*.08,0,7); c.fill();
    c.strokeStyle="#5a3d10"; c.lineWidth=s*.05; c.beginPath(); c.arc(cx,cy+s*.05,s*.42,.5,2.64); c.stroke();
    const txt="FREETIME · STUDIO · "; c.fillStyle="#f3d98b"; c.font=`${s*.2}px "IM Fell English SC", Georgia, serif`; c.textAlign="center"; c.textBaseline="middle";
    [...txt].forEach((ch,k)=>{ const a=k/txt.length*Math.PI*2-Math.PI/2; c.save(); c.translate(cx+Math.cos(a)*s*1.98,cy+Math.sin(a)*s*1.98); c.rotate(a+Math.PI/2); c.fillText(ch,0,0); c.restore(); });
  },
  ai(c,w,h,r){
    ground(c,w,h,"#25202e","#08060c");
    const cx=w/2, cy=h/2, s=Math.min(w,h)*.4;
    glowDot(c,cx,cy,s*.9,"rgba(170,230,190,.28)");
    c.strokeStyle="rgba(226,192,110,.75)"; c.lineWidth=2;
    [1,.86,.5].forEach(k=>{ c.beginPath(); c.arc(cx,cy,s*k,0,7); c.stroke(); });
    const poly=(n,rad,rot)=>{ c.beginPath(); for(let k=0;k<=n;k++){ const a=k/n*Math.PI*2+rot; const x=cx+Math.cos(a)*rad, y=cy+Math.sin(a)*rad; k?c.lineTo(x,y):c.moveTo(x,y);} c.stroke(); };
    poly(3,s*.86,-Math.PI/2); poly(4,s*.5,Math.PI/4);
    const pts=[]; for(let k=0;k<34;k++){ const a=r()*Math.PI*2, d=Math.sqrt(r())*s*.8; pts.push([cx+Math.cos(a)*d,cy+Math.sin(a)*d]); }
    c.strokeStyle="rgba(170,230,200,.3)"; c.lineWidth=1;
    pts.forEach(p=>{ const near=pts.map(q=>[q,Math.hypot(q[0]-p[0],q[1]-p[1])]).sort((a,b)=>a[1]-b[1]).slice(1,3);
      near.forEach(([q])=>{ c.beginPath(); c.moveTo(p[0],p[1]); c.lineTo(q[0],q[1]); c.stroke(); }); });
    pts.forEach(p=>{ glowDot(c,p[0],p[1],5,"rgba(200,255,220,.8)"); });
    const gl="ΑΒΓΔΘΛΞΠΣΦΨΩ"; c.fillStyle="#e2c06e"; c.font=`${s*.09}px "IM Fell English", Georgia, serif`; c.textAlign="center"; c.textBaseline="middle";
    for(let k=0;k<24;k++){ const a=k/24*Math.PI*2; c.fillText(gl[Math.floor(r()*gl.length)],cx+Math.cos(a)*s*.93,cy+Math.sin(a)*s*.93); }
  },
  civitai(c,w,h,r){
    ground(c,w,h,"#2e1215","#0b0405");
    const cols=4, rows=3, gw=w*.82, gh=h*.78, cw=gw/cols, ch=gh/rows, x0=(w-gw)/2, y0=(h-gh)/2;
    const pick=Math.floor(r()*cols*rows);
    for(let k=0;k<cols*rows;k++){
      const ix=k%cols, iy=Math.floor(k/cols); c.save();
      c.translate(x0+ix*cw+cw/2,y0+iy*ch+ch/2); c.rotate((r()-.5)*.12); const sc=k===pick?1.14:1; c.scale(sc,sc);
      const pw=cw*.82, ph=ch*.84;
      if(k===pick) glowDot(c,0,0,cw*.8,"rgba(255,210,120,.5)");
      c.fillStyle="#ece2c8"; c.shadowColor="rgba(0,0,0,.5)"; c.shadowBlur=8; c.fillRect(-pw/2,-ph/2,pw,ph); c.shadowBlur=0;
      const hue=Math.floor(r()*360), g=c.createLinearGradient(0,-ph/2,0,ph/2);
      g.addColorStop(0,`hsl(${hue} 35% 55%)`); g.addColorStop(1,`hsl(${(hue+40)%360} 40% 22%)`);
      c.fillStyle=g; c.fillRect(-pw/2+4,-ph/2+4,pw-8,ph*.72);
      c.fillStyle=`hsla(${(hue+180)%360},45%,70%,.8)`; c.beginPath(); c.arc((r()-.5)*pw*.4,-ph*.1,ph*.12,0,7); c.fill();
      c.fillStyle="rgba(0,0,0,.35)"; c.beginPath(); c.moveTo(-pw/2+4,ph*.22); c.quadraticCurveTo(0,-ph*.05,pw/2-4,ph*.2); c.lineTo(pw/2-4,ph*.26); c.lineTo(-pw/2+4,ph*.26); c.fill();
      c.restore();
    }
  },
  portfolio(c,w,h,r){
    ground(c,w,h,"#ecdfbf","#bba67a");
    c.strokeStyle="rgba(170,60,40,.18)"; c.lineWidth=1;
    for(let k=1;k<6;k++){ c.beginPath(); c.moveTo(w*k/6,0); c.lineTo(w*k/6,h); c.stroke(); }
    for(let k=1;k<9;k++){ c.beginPath(); c.moveTo(0,h*k/9); c.lineTo(w,h*k/9); c.stroke(); }
    c.fillStyle="#2b2118"; c.textBaseline="alphabetic"; c.textAlign="left";
    c.font=`${h*.42}px "IM Fell English", Georgia, serif`; c.fillText("M",w*.12,h*.55);
    c.font=`italic ${h*.07}px "IM Fell English", Georgia, serif`; c.fillText("Aa Bb Cc",w*.14,h*.68);
    c.fillStyle="rgba(43,33,24,.55)"; for(let k=0;k<4;k++) c.fillRect(w*.14,h*(.73+k*.035),w*(.5+r()*.2),2);
    ["#163126","#c9a24a","#6e1d1c","#2a2117"].forEach((col,k)=>{ c.fillStyle=col; c.beginPath(); c.arc(w*(.22+k*.17),h*.9,w*.06,0,7); c.fill(); });
  },
  mini(c,w,h,r){
    ground(c,w,h,"#202326","#060707",.5,.15);
    const cone=c.createLinearGradient(0,0,0,h); cone.addColorStop(0,"rgba(255,215,150,.28)"); cone.addColorStop(1,"rgba(255,215,150,0)");
    c.fillStyle=cone; c.beginPath(); c.moveTo(w*.44,0); c.lineTo(w*.56,0); c.lineTo(w*.9,h); c.lineTo(w*.1,h); c.fill();
    c.fillStyle="#2b2f30"; c.fillRect(w*.06,h*.12,w*.24,h*.3);
    c.strokeStyle="#8a8f8c"; c.lineWidth=3; for(let k=0;k<4;k++){ c.beginPath(); c.moveTo(w*(.09+k*.055),h*.18); c.lineTo(w*(.09+k*.055),h*.34); c.stroke(); }
    const fy=h*.82; c.fillStyle="rgba(0,0,0,.5)"; c.beginPath(); c.ellipse(w*.55,fy,w*.36,h*.04,0,0,7); c.fill();
    const x0=w*.22, x1=w*.88, yb=fy-h*.06, yt=h*.48;
    const body="#5f1a18";
    c.fillStyle=body; c.beginPath(); c.moveTo(x0,yb); c.lineTo(x0,yt+h*.06); c.quadraticCurveTo(x0,yt,x0+w*.05,yt); c.lineTo(x1-w*.04,yt+h*.01);
    c.quadraticCurveTo(x1,yt+h*.02,x1,yt+h*.09); c.lineTo(x1,yb); c.closePath(); c.fill();
    c.fillStyle="#3c3f42"; c.beginPath(); c.moveTo(x0+w*.12,yt); c.lineTo(x0+w*.18,h*.32); c.lineTo(x1-w*.18,h*.32); c.lineTo(x1-w*.1,yt); c.fill();
    c.fillStyle="#ece6da"; c.fillRect(x0+w*.165,h*.3,x1-x0-w*.33,h*.025);
    c.fillStyle="rgba(170,200,220,.25)"; c.beginPath(); c.moveTo(x0+w*.2,h*.36); c.lineTo(x0+w*.27,h*.36); c.lineTo(x0+w*.22,yt-2); c.lineTo(x0+w*.15,yt-2); c.fill();
    c.strokeStyle="rgba(255,255,255,.18)"; c.lineWidth=2; c.beginPath(); c.moveTo(x0+w*.02,yt+h*.07); c.lineTo(x1-w*.02,yt+h*.08); c.stroke();
    [x0+w*.14,x1-w*.13].forEach(wx=>{ c.fillStyle="#0c0d0e"; c.beginPath(); c.arc(wx,yb,h*.1,0,7); c.fill();
      c.fillStyle="#9aa09c"; c.beginPath(); c.arc(wx,yb,h*.055,0,7); c.fill(); c.fillStyle="#3a3d3e"; c.beginPath(); c.arc(wx,yb,h*.018,0,7); c.fill(); });
    glowDot(c,x1-w*.01,yt+h*.08,h*.18,"rgba(255,235,180,.55)");
    c.fillStyle="#fff5d8"; c.beginPath(); c.ellipse(x1-w*.012,yt+h*.08,w*.008,h*.03,0,0,7); c.fill();
  },
  classic(c,w,h,r){
    ground(c,w,h,"#dccaa2","#a99064");
    c.strokeStyle="rgba(90,70,40,.12)"; c.lineWidth=1;
    for(let x=0;x<w;x+=w/24){ c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); }
    for(let y=0;y<h;y+=w/24){ c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke(); }
    const ink="#3a2a1a"; c.strokeStyle=ink; c.lineWidth=2.4; c.lineJoin="round";
    const yb=h*.66, x0=w*.08, x1=w*.92;
    c.beginPath(); c.moveTo(x0,yb-h*.06); c.quadraticCurveTo(x0+w*.02,yb-h*.18,x0+w*.2,yb-h*.2);
    c.lineTo(x0+w*.42,yb-h*.22); c.quadraticCurveTo(x0+w*.5,yb-h*.42,x0+w*.62,yb-h*.4); c.quadraticCurveTo(x0+w*.74,yb-h*.36,x1-w*.04,yb-h*.18);
    c.quadraticCurveTo(x1,yb-h*.12,x1,yb-h*.04); c.lineTo(x1,yb); c.lineTo(x0,yb); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(x0+w*.46,yb-h*.22); c.quadraticCurveTo(x0+w*.52,yb-h*.36,x0+w*.6,yb-h*.36); c.lineTo(x0+w*.66,yb-h*.22); c.stroke();
    [x0+w*.18,x1-w*.17].forEach(wx=>{ c.fillStyle="#d4c29a"; c.beginPath(); c.arc(wx,yb,h*.12,0,7); c.fill(); c.stroke();
      c.beginPath(); c.arc(wx,yb,h*.075,0,7); c.stroke(); for(let k=0;k<12;k++){ const a=k/12*Math.PI*2; c.beginPath(); c.moveTo(wx,yb); c.lineTo(wx+Math.cos(a)*h*.075,yb+Math.sin(a)*h*.075); c.lineWidth=1; c.stroke(); } c.lineWidth=2.4; });
    c.lineWidth=1; const dy=h*.86; c.beginPath(); c.moveTo(x0,dy); c.lineTo(x1,dy); c.stroke();
    [[x0,1],[x1,-1]].forEach(([x,s2])=>{ c.beginPath(); c.moveTo(x,dy); c.lineTo(x+s2*8,dy-4); c.lineTo(x+s2*8,dy+4); c.closePath(); c.fillStyle=ink; c.fill(); c.beginPath(); c.moveTo(x,dy-10); c.lineTo(x,dy+10); c.stroke(); });
    c.fillStyle="#d8c69e"; c.fillRect(w/2-w*.07,dy-h*.05,w*.14,h*.08);
    c.fillStyle=ink; c.font=`italic ${h*.065}px "IM Fell English", Georgia, serif`; c.textAlign="center"; c.textBaseline="middle"; c.fillText("4 120 mm",w/2,dy-h*.005);
    c.textAlign="left"; c.font=`${h*.07}px "IM Fell English SC", Georgia, serif`; c.fillText("Tab. III",w*.06,h*.12);
  },
  /* -------- specimens -------- */
  botanical(c,w,h,r){
    ground(c,w,h,"#1f3527","#0b160f");
    const kind=Math.floor(r()*4), bx=w/2, by=h*1.02, s=Math.min(w,h);
    if(kind===0){ for(let k=0;k<3;k++){ const fx=w*(.3+k*.2+(r()-.5)*.08), fy=h*(.25+r()*.25); stem(c,bx,by,fx,fy,(r()-.5)*s*.3,"#4c6b3a",s*.012);
        leafShape(c,(bx+fx)/2,(by+fy)/2+s*.1,s*.22,s*.05,(r()-.5)*1.6,"#54703f","#2f4626"); daisy(c,fx,fy,s*.13,r); } }
    else if(kind===1){ const fx=w*.5, fy=h*.36; stem(c,bx,by,fx,fy,s*.08,"#41613a",s*.018);
        leafShape(c,w*.5,h*.72,s*.32,s*.12,-.9,"#4a6a3c","#2b4224"); leafShape(c,w*.52,h*.6,s*.28,s*.1,.8,"#56774a","#2b4224"); rose(c,fx,fy,s*.2,r); }
    else if(kind===2){ const fx=w*.5, fy=h*.38; stem(c,bx,by,fx,fy,-s*.05,"#4c6b3a",s*.02);
        leafShape(c,w*.5,h*.75,s*.3,s*.12,-1,"#4f6d3b","#2f4626"); sunflower(c,fx,fy,s*.28,r); daisy(c,w*.28,h*.66,s*.07,r); daisy(c,w*.72,h*.6,s*.07,r); }
    else { stem(c,bx,by,w*.5,h*.1,s*.1,"#6b5a2a",s*.012);
        for(let k=0;k<9;k++){ const t=k/9, x=bx+(w*.5-bx)*t+s*.1*Math.sin(t*3), y=by+(h*.1-by)*t;
          leafShape(c,x,y,s*(.24-t*.12),s*(.06-t*.02),(k%2?1:-1)*(.9+r()*.3),k%3?"#a4823e":"#7d6a32","#4a3a18"); } }
  },
  moth(c,w,h,r){
    ground(c,w,h,"#e6d6b0","#b49d70");
    const cx=w/2, cy=h*.46, s=Math.min(w,h)*.42;
    const wing=(sx,top)=>{ c.save(); c.translate(cx,cy); c.scale(sx,1);
      const g=c.createLinearGradient(0,0,s,0); g.addColorStop(0,"#5b4630"); g.addColorStop(1,top?"#a98a5c":"#8f7550");
      c.fillStyle=g; c.beginPath();
      if(top){ c.moveTo(0,-s*.05); c.quadraticCurveTo(s*.6,-s*.75,s*1.05,-s*.45); c.quadraticCurveTo(s*.8,-s*.05,s*.05,s*.08); }
      else { c.moveTo(s*.03,s*.04); c.quadraticCurveTo(s*.8,s*.05,s*.62,s*.55); c.quadraticCurveTo(s*.3,s*.6,s*.02,s*.2); }
      c.fill(); c.strokeStyle="rgba(50,35,20,.5)"; c.lineWidth=1; c.stroke();
      c.strokeStyle="rgba(60,40,20,.35)"; for(let k=0;k<4;k++){ c.beginPath(); c.moveTo(s*.05,0); c.quadraticCurveTo(s*.4,(top?-1:1)*s*(.1+k*.1),s*(top?.95:.6),(top?-1:1)*s*(.2+k*.08)); c.stroke(); }
      if(top){ c.fillStyle="#e8d6aa"; c.beginPath(); c.arc(s*.55,-s*.32,s*.09,0,7); c.fill(); c.fillStyle="#3b2a18"; c.beginPath(); c.arc(s*.55,-s*.32,s*.045,0,7); c.fill(); }
      c.restore(); };
    wing(1,false); wing(-1,false); wing(1,true); wing(-1,true);
    c.fillStyle="#3b2a18"; c.beginPath(); c.ellipse(cx,cy+s*.08,s*.07,s*.32,0,0,7); c.fill();
    c.strokeStyle="#3b2a18"; c.lineWidth=1.2; [-1,1].forEach(sx=>{ c.beginPath(); c.moveTo(cx,cy-s*.2); c.quadraticCurveTo(cx+sx*s*.15,cy-s*.55,cx+sx*s*.32,cy-s*.6); c.stroke(); });
    c.fillStyle="#4a3a26"; c.font=`italic ${h*.07}px "IM Fell English", Georgia, serif`; c.textAlign="center"; c.fillText("Lepidoptera",cx,h*.9);
  },
  leaf(c,w,h,r){
    ground(c,w,h,"#e3d3ad","#ae976a");
    c.save(); c.translate(w/2,h*.88); c.rotate((r()-.5)*.3);
    const L=h*.72, W=w*.36;
    const g=c.createLinearGradient(-W,0,W,0); g.addColorStop(0,"#8a5e26"); g.addColorStop(.5,"#c0913f"); g.addColorStop(1,"#9a6a2c");
    c.fillStyle=g; c.beginPath(); c.moveTo(0,0); c.bezierCurveTo(W*1.2,-L*.25,W*.6,-L*.8,0,-L); c.bezierCurveTo(-W*.6,-L*.8,-W*1.2,-L*.25,0,0); c.fill();
    c.strokeStyle="rgba(80,50,20,.6)"; c.lineWidth=1.6; c.beginPath(); c.moveTo(0,h*.06); c.lineTo(0,-L*.95); c.stroke();
    c.lineWidth=1; for(let k=1;k<9;k++){ const y=-L*k/10; [-1,1].forEach(sx=>{ c.beginPath(); c.moveTo(0,y); c.quadraticCurveTo(sx*W*.4,y-L*.03,sx*W*.75*Math.sin(Math.PI*k/10),y-L*.08); c.stroke(); }); }
    c.restore();
  },
  fern(c,w,h,r){
    ground(c,w,h,"#e3d3ad","#ae976a");
    const bx=w/2, by=h*.94, tx=w*.52, ty=h*.08;
    stem(c,bx,by,tx,ty,w*.08,"#4d5a2c",2);
    for(let k=1;k<22;k++){ const t=k/22, x=bx+(tx-bx)*t+w*.08*Math.sin(t*Math.PI)*.5, y=by+(ty-by)*t, len=w*.38*(1-t*.8);
      [-1,1].forEach(sx=>leafShape(c,x,y,len,len*.18,sx*(1.25-t*.4),k%2?"#5f6e33":"#4d5a2c",null)); }
  },
  landscape(c,w,h,r){
    const sky=c.createLinearGradient(0,0,0,h); sky.addColorStop(0,"#1e2c2c"); sky.addColorStop(.55,"#5e6650"); sky.addColorStop(.7,"#8c8460"); sky.addColorStop(1,"#1a2016");
    c.fillStyle=sky; c.fillRect(-w,-h,w*3,h*3);
    for(let k=0;k<14;k++){ c.fillStyle=`rgba(${20+r()*30},${30+r()*30},${30+r()*20},.35)`; c.beginPath(); c.ellipse(r()*w,h*(.1+r()*.35),w*(.1+r()*.2),h*(.04+r()*.06),0,0,7); c.fill(); }
    c.fillStyle="#3b4436"; c.beginPath(); c.moveTo(0,h*.66); for(let x=0;x<=w;x+=w/10) c.lineTo(x,h*(.42+r()*.2)); c.lineTo(w,h); c.lineTo(0,h); c.fill();
    c.fillStyle="#232a20"; const kx=w*(.55+r()*.2), ky=h*.5; c.fillRect(kx,ky,w*.06,h*.08); c.fillRect(kx-w*.015,ky-h*.05,w*.025,h*.13); c.fillRect(kx+w*.05,ky-h*.03,w*.02,h*.11);
    c.fillStyle="#141a12"; c.beginPath(); c.moveTo(0,h*.72); for(let x=0;x<=w;x+=w/16) c.lineTo(x,h*(.66+r()*.1)); c.lineTo(w,h); c.lineTo(0,h); c.fill();
    c.fillStyle="rgba(200,190,140,.25)"; c.fillRect(w*.1,h*.82,w*.5,h*.015);
    for(let k=0;k<5;k++){ const x=r()*w*.4, y=h*.7; c.fillStyle="#0e130c"; c.beginPath(); c.ellipse(x,y-h*.12,w*.05,h*.14,0,0,7); c.fill(); }
  },
};

/* ---- shelf objects ---- */
const lin=(c,x0,y0,x1,y1,stops)=>{ const g=c.createLinearGradient(x0,y0,x1,y1); stops.forEach(([o,col])=>g.addColorStop(o,col)); return g; };
const rad=(c,x,y,r0,x1,y1,r1,stops)=>{ const g=c.createRadialGradient(x,y,r0,x1,y1,r1); stops.forEach(([o,col])=>g.addColorStop(o,col)); return g; };
const BRASS=[[0,"#5e420f"],[.25,"#e8c66e"],[.5,"#9a7224"],[.75,"#f3d98b"],[1,"#6b4a12"]];
const contactShadow=(c,x,y,rx,ry)=>{ c.save(); c.fillStyle=rad(c,x,y,0,x,y,rx,[[0,"rgba(0,0,0,.45)"],[1,"rgba(0,0,0,0)"]]); c.scale(1,ry/rx); c.beginPath(); c.arc(x,y*rx/ry,rx,0,7); c.fill(); c.restore(); };
const OBJ={
  skull(c,w,h){
    const cx=w*.5;
    contactShadow(c,cx,h*.985,w*.38,h*.03);
    const bone=rad(c,cx-w*.12,h*.25,w*.05,cx,h*.4,w*.5,[[0,"#f6eedb"],[.55,"#d9c9a3"],[1,"#8e7a55"]]);
    // cranium + face
    c.fillStyle=bone; c.beginPath();
    c.moveTo(cx-w*.36,h*.5); c.bezierCurveTo(cx-w*.44,h*.05,cx+w*.44,h*.05,cx+w*.36,h*.5);
    c.bezierCurveTo(cx+w*.34,h*.62,cx+w*.26,h*.66,cx+w*.24,h*.72);
    c.lineTo(cx+w*.2,h*.86); c.quadraticCurveTo(cx,h*.93,cx-w*.2,h*.86);
    c.lineTo(cx-w*.24,h*.72); c.bezierCurveTo(cx-w*.26,h*.66,cx-w*.34,h*.62,cx-w*.36,h*.5); c.fill();
    // jaw resting on the shelf
    c.fillStyle=lin(c,0,h*.82,0,h,[[0,"#cbb98f"],[1,"#7e6b48"]]);
    c.beginPath(); c.moveTo(cx-w*.22,h*.84); c.quadraticCurveTo(cx-w*.24,h*.99,cx,h*.995); c.quadraticCurveTo(cx+w*.24,h*.99,cx+w*.22,h*.84); c.quadraticCurveTo(cx,h*.9,cx-w*.22,h*.84); c.fill();
    // sockets
    const sock=(sx)=>{ c.fillStyle=rad(c,cx+sx*w*.14,h*.5,w*.01,cx+sx*w*.14,h*.52,w*.13,[[0,"#0a0705"],[.7,"#2a1f14"],[1,"rgba(60,45,30,.0)"]]); c.beginPath(); c.ellipse(cx+sx*w*.14,h*.52,w*.11,h*.085,sx*.25,0,7); c.fill(); };
    sock(-1); sock(1);
    // nose
    c.fillStyle="#1a120b"; c.beginPath(); c.moveTo(cx,h*.6); c.quadraticCurveTo(cx-w*.06,h*.7,cx-w*.03,h*.71); c.lineTo(cx,h*.69); c.lineTo(cx+w*.03,h*.71); c.quadraticCurveTo(cx+w*.06,h*.7,cx,h*.6); c.fill();
    // teeth
    for(let i=-4;i<=4;i++){ const tx=cx+i*w*.04; c.fillStyle="#efe5cb"; c.fillRect(tx-w*.017,h*.78,w*.034,h*.07); c.strokeStyle="rgba(60,40,20,.55)"; c.lineWidth=1.2; c.strokeRect(tx-w*.017,h*.78,w*.034,h*.07); }
    c.strokeStyle="rgba(60,40,20,.4)"; c.lineWidth=1.5; c.beginPath(); c.moveTo(cx-w*.19,h*.85); c.lineTo(cx+w*.19,h*.85); c.stroke();
    // suture + cheek light
    c.strokeStyle="rgba(90,70,40,.35)"; c.lineWidth=1.2; c.beginPath(); c.moveTo(cx-w*.05,h*.1); for(let i=0;i<8;i++) c.lineTo(cx-w*.04+i*w*.015,h*(.12+((i%2)?.02:0)+i*.015)); c.stroke();
    c.fillStyle="rgba(255,250,235,.35)"; c.beginPath(); c.ellipse(cx-w*.13,h*.22,w*.09,h*.06,-.5,0,7); c.fill();
  },
  belljar(c,w,h,r){
    const cx=w*.5, by=h*.9;
    contactShadow(c,cx,h*.985,w*.46,h*.025);
    // turned wooden base
    c.fillStyle=lin(c,0,by,0,h,[[0,"#7a4f2a"],[.3,"#4a2d16"],[1,"#2a180b"]]);
    c.beginPath(); c.moveTo(w*.06,by); c.lineTo(w*.94,by); c.lineTo(w*.98,h*.985); c.lineTo(w*.02,h*.985); c.fill();
    c.fillStyle="#9a6a3c"; c.fillRect(w*.06,by-1,w*.88,3);
    // twig + morpho butterfly inside
    c.strokeStyle="#4a3420"; c.lineWidth=w*.025; c.lineCap="round";
    c.beginPath(); c.moveTo(cx,by); c.quadraticCurveTo(cx-w*.05,h*.6,cx+w*.08,h*.4); c.stroke();
    c.lineWidth=w*.014; c.beginPath(); c.moveTo(cx-w*.02,h*.62); c.quadraticCurveTo(cx-w*.18,h*.55,cx-w*.22,h*.48); c.stroke();
    leafShape(c,cx-w*.2,h*.5,w*.14,w*.05,-1.9,"#5b6b33",null);
    leafShape(c,cx+w*.06,h*.5,w*.12,w*.045,1.2,"#4d5a2c",null);
    const bx=cx+w*.08, byy=h*.4, s=w*.2;
    [-1,1].forEach(sx=>{
      c.save(); c.translate(bx,byy); c.scale(sx,1);
      c.fillStyle=rad(c,s*.3,-s*.2,s*.05,s*.4,-s*.2,s*.8,[[0,"#7fe0ff"],[.5,"#1f7fd1"],[1,"#0b2346"]]);
      c.beginPath(); c.moveTo(0,0); c.quadraticCurveTo(s*.4,-s*.9,s*1.0,-s*.6); c.quadraticCurveTo(s*.85,-s*.05,0,s*.05); c.fill();
      c.fillStyle=rad(c,s*.3,s*.25,s*.05,s*.3,s*.25,s*.6,[[0,"#4fb6ef"],[1,"#0b2346"]]);
      c.beginPath(); c.moveTo(0,s*.02); c.quadraticCurveTo(s*.7,s*.05,s*.55,s*.55); c.quadraticCurveTo(s*.2,s*.6,0,s*.15); c.fill();
      c.restore(); });
    c.fillStyle="#1b130c"; c.beginPath(); c.ellipse(bx,byy+s*.08,s*.06,s*.3,0,0,7); c.fill();
    // glass dome
    const gx0=w*.1, gx1=w*.9, top=h*.04;
    const dome=()=>{ c.beginPath(); c.moveTo(gx0,by); c.lineTo(gx0,h*.32); c.bezierCurveTo(gx0,top-h*.02,gx1,top-h*.02,gx1,h*.32); c.lineTo(gx1,by); };
    dome(); c.fillStyle="rgba(200,235,225,.10)"; c.fill();
    dome(); c.strokeStyle="rgba(230,250,240,.45)"; c.lineWidth=2.5; c.stroke();
    c.fillStyle=lin(c,gx0,0,gx0+w*.2,0,[[0,"rgba(255,255,255,.0)"],[.4,"rgba(255,255,255,.38)"],[1,"rgba(255,255,255,0)"]]);
    c.beginPath(); c.moveTo(gx0+w*.06,by-h*.04); c.lineTo(gx0+w*.06,h*.3); c.quadraticCurveTo(gx0+w*.08,h*.14,gx0+w*.2,h*.1); c.lineTo(gx0+w*.22,h*.13); c.quadraticCurveTo(gx0+w*.13,h*.18,gx0+w*.13,h*.32); c.lineTo(gx0+w*.13,by-h*.04); c.fill();
    // knob
    c.fillStyle="rgba(220,245,235,.55)"; c.beginPath(); c.ellipse(cx,top+h*.005,w*.05,h*.022,0,0,7); c.fill();
  },
  globe(c,w,h,r){
    const cx=w*.5, R=w*.36, cy=R+h*.06;
    contactShadow(c,cx,h*.985,w*.32,h*.025);
    // base + stem
    c.fillStyle=lin(c,cx-w*.3,0,cx+w*.3,0,[[0,"#2a180b"],[.4,"#6a4425"],[1,"#22140a"]]);
    c.beginPath(); c.ellipse(cx,h*.95,w*.3,h*.04,0,0,7); c.fill(); c.fillRect(cx-w*.3,h*.92,w*.6,h*.03);
    c.fillStyle=lin(c,cx-w*.3,0,cx+w*.3,0,[[0,"#3a2412"],[.45,"#8a5a32"],[1,"#2a180b"]]); c.beginPath(); c.ellipse(cx,h*.92,w*.3,h*.035,0,0,7); c.fill();
    c.fillStyle=lin(c,cx-w*.05,0,cx+w*.05,0,BRASS); c.fillRect(cx-w*.03,cy+R*.95,w*.06,h*.92-(cy+R*.95));
    c.beginPath(); c.ellipse(cx,h*.83,w*.07,h*.02,0,0,7); c.fill();
    // sphere
    c.save(); c.beginPath(); c.arc(cx,cy,R,0,7); c.clip();
    c.fillStyle=rad(c,cx-R*.35,cy-R*.35,R*.1,cx,cy,R*1.05,[[0,"#d9cfa6"],[.6,"#9fae8a"],[1,"#3f5141"]]); c.fillRect(cx-R,cy-R,2*R,2*R);
    c.fillStyle="rgba(150,110,50,.55)";
    for(let i=0;i<6;i++){ const ax=cx+(r()-.5)*R*1.4, ay=cy+(r()-.5)*R*1.3; c.beginPath(); c.moveTo(ax,ay); for(let k=0;k<9;k++){ const a=k/9*Math.PI*2; const rr=R*(.12+r()*.18); c.lineTo(ax+Math.cos(a)*rr*1.3,ay+Math.sin(a)*rr); } c.closePath(); c.fill(); }
    c.strokeStyle="rgba(80,60,30,.35)"; c.lineWidth=1;
    for(let k=-2;k<=2;k++){ c.beginPath(); c.ellipse(cx,cy+k*R*.36,R*Math.sqrt(1-Math.pow(k*.36,2)),R*.08,0,0,7); c.stroke(); }
    for(let k=-2;k<=2;k++){ c.beginPath(); c.ellipse(cx,cy,Math.abs(k)*R*.3+1,R,0,0,7); c.stroke(); }
    c.fillStyle=rad(c,cx+R*.4,cy+R*.4,R*.2,cx,cy,R,[[0,"rgba(0,0,0,.45)"],[1,"rgba(0,0,0,0)"]]); c.fillRect(cx-R,cy-R,2*R,2*R);
    c.restore();
    c.fillStyle="rgba(255,250,230,.35)"; c.beginPath(); c.ellipse(cx-R*.4,cy-R*.45,R*.22,R*.12,-.6,0,7); c.fill();
    // brass meridian
    c.strokeStyle=lin(c,cx-R,0,cx+R,0,BRASS); c.lineWidth=w*.035;
    c.beginPath(); c.arc(cx,cy,R*1.1,Math.PI*.62,Math.PI*2.38); c.stroke();
  },
  hourglass(c,w,h,r){
    const cx=w*.5, t=h*.05, b=h*.93, disc=h*.06;
    contactShadow(c,cx,h*.985,w*.46,h*.025);
    const wood=(y)=>{ c.fillStyle=lin(c,0,y,0,y+disc,[[0,"#9a6a3c"],[.3,"#6a4425"],[1,"#2e1b0d"]]); c.beginPath(); c.roundRect(w*.04,y,w*.92,disc,3); c.fill(); };
    // glass bulbs
    const gw=w*.36, mid=(t+disc+b)/2;
    const bulb=()=>{ c.beginPath(); c.moveTo(cx-gw,t+disc); c.bezierCurveTo(cx-gw,mid-h*.12,cx-w*.03,mid-h*.06,cx-w*.03,mid); c.bezierCurveTo(cx-w*.03,mid+h*.06,cx-gw,mid+h*.12,cx-gw,b); c.lineTo(cx+gw,b); c.bezierCurveTo(cx+gw,mid+h*.12,cx+w*.03,mid+h*.06,cx+w*.03,mid); c.bezierCurveTo(cx+w*.03,mid-h*.06,cx+gw,mid-h*.12,cx+gw,t+disc); c.closePath(); };
    bulb(); c.fillStyle="rgba(210,235,230,.12)"; c.fill();
    c.save(); bulb(); c.clip();
    const sand=lin(c,0,mid,0,b,[[0,"#f0cf86"],[1,"#b8873a"]]);
    c.fillStyle=sand; c.beginPath(); c.moveTo(cx-gw,b); c.lineTo(cx-gw,b-h*.12); c.quadraticCurveTo(cx,b-h*.3,cx+gw,b-h*.12); c.lineTo(cx+gw,b); c.fill();
    c.beginPath(); c.moveTo(cx-gw,mid-h*.16); c.quadraticCurveTo(cx,mid-h*.1,cx+gw,mid-h*.16); c.lineTo(cx+gw,mid); c.lineTo(cx-gw,mid); c.fill();
    c.fillRect(cx-1.2,mid-h*.02,2.4,b-h*.2-mid);
    c.restore();
    bulb(); c.strokeStyle="rgba(230,250,240,.5)"; c.lineWidth=2; c.stroke();
    c.fillStyle="rgba(255,255,255,.3)"; c.fillRect(cx-gw*.7,t+disc+h*.04,w*.04,h*.18); c.fillRect(cx-gw*.7,mid+h*.12,w*.04,h*.16);
    // spindles
    [w*.1,w*.9].forEach(x=>{ c.fillStyle=lin(c,x-w*.04,0,x+w*.04,0,[[0,"#3a2412"],[.5,"#8a5a32"],[1,"#2a180b"]]);
      c.fillRect(x-w*.025,t+disc,w*.05,b-t-disc);
      for(let k=1;k<6;k++){ const y=t+disc+(b-t-disc)*k/6; c.beginPath(); c.ellipse(x,y,w*.045,h*.012,0,0,7); c.fill(); } });
    wood(t); wood(b);
  },
  bottle(c,w,h,r){
    const cx=w*.5, by=h*.985, R=w*.42, cy=by-R;
    contactShadow(c,cx,h*.985,w*.42,h*.025);
    const flask=()=>{ c.beginPath(); c.moveTo(cx-w*.1,h*.18); c.lineTo(cx-w*.1,cy-R*.86); c.arc(cx,cy,R,-Math.PI/2-.24,Math.PI*1.5+.24,true); c.lineTo(cx+w*.1,h*.18); c.closePath(); };
    // liquid
    c.save(); flask(); c.clip();
    c.fillStyle=rad(c,cx,cy+R*.2,R*.1,cx,cy,R,[[0,"#d4ff9a"],[.4,"#6fbf3a"],[1,"#1d4a14"]]); c.fillRect(0,cy-R*.25,w,h);
    c.fillStyle="rgba(230,255,200,.5)"; c.fillRect(0,cy-R*.25,w,2);
    for(let i=0;i<10;i++){ c.fillStyle="rgba(230,255,210,.6)"; c.beginPath(); c.arc(cx+(r()-.5)*R*1.2,cy+r()*R*.7,1+r()*2.5,0,7); c.fill(); }
    c.restore();
    flask(); c.fillStyle="rgba(200,230,215,.10)"; c.fill(); c.strokeStyle="rgba(225,250,240,.55)"; c.lineWidth=2.2; c.stroke();
    c.fillStyle="rgba(255,255,255,.35)"; c.beginPath(); c.ellipse(cx-R*.5,cy-R*.2,R*.1,R*.32,.3,0,7); c.fill();
    // label + string
    c.fillStyle="#e9dcb8"; c.fillRect(cx-R*.55,cy-R*.05,R*1.1,R*.42); c.strokeStyle="#6b2a14"; c.lineWidth=1.2; c.strokeRect(cx-R*.5,cy,R*1.0,R*.32);
    c.fillStyle="#3a2412"; c.font=`italic ${R*.2}px "IM Fell English", Georgia, serif`; c.textAlign="center"; c.textBaseline="middle"; c.fillText("Aqua vitae",cx,cy+R*.16);
    c.strokeStyle="#8a6a3a"; c.lineWidth=1.5; c.beginPath(); c.moveTo(cx-w*.1,h*.24); c.quadraticCurveTo(cx-w*.2,h*.34,cx-w*.16,h*.42); c.stroke();
    // cork
    c.fillStyle=lin(c,cx-w*.12,0,cx+w*.12,0,[[0,"#6b4a2a"],[.5,"#c49a64"],[1,"#5a3c20"]]); c.beginPath(); c.roundRect(cx-w*.12,h*.05,w*.24,h*.14,3); c.fill();
    c.fillStyle="rgba(60,40,20,.4)"; for(let i=0;i<14;i++) c.fillRect(cx-w*.1+r()*w*.2,h*.06+r()*h*.12,1.5,1.5);
  },
  candle(c,w,h,r){
    const cx=w*.5;
    contactShadow(c,cx,h*.985,w*.4,h*.025);
    const brass=(x0,x1)=>lin(c,x0,0,x1,0,BRASS);
    // foot, stem with knops, drip dish
    c.fillStyle=brass(cx-w*.4,cx+w*.4); c.beginPath(); c.ellipse(cx,h*.95,w*.4,h*.035,0,0,7); c.fill();
    c.beginPath(); c.moveTo(cx-w*.36,h*.95); c.quadraticCurveTo(cx-w*.1,h*.9,cx-w*.07,h*.82); c.lineTo(cx+w*.07,h*.82); c.quadraticCurveTo(cx+w*.1,h*.9,cx+w*.36,h*.95); c.fill();
    c.fillStyle=brass(cx-w*.06,cx+w*.06); c.fillRect(cx-w*.05,h*.6,w*.1,h*.24);
    [h*.8,h*.7,h*.61].forEach((y,i)=>{ c.fillStyle=brass(cx-w*.12,cx+w*.12); c.beginPath(); c.ellipse(cx,y,w*(.1-i*.015),h*.022,0,0,7); c.fill(); });
    c.fillStyle=brass(cx-w*.34,cx+w*.34); c.beginPath(); c.ellipse(cx,h*.56,w*.34,h*.03,0,0,7); c.fill();
    c.fillStyle="rgba(60,40,10,.45)"; c.beginPath(); c.ellipse(cx,h*.553,w*.26,h*.018,0,0,7); c.fill();
    // candle with drips
    const ct=h*.24, cw=w*.15;
    c.fillStyle=lin(c,cx-cw,0,cx+cw,0,[[0,"#cdbf9f"],[.35,"#f6efdc"],[1,"#bfae8a"]]);
    c.fillRect(cx-cw,ct,cw*2,h*.555-ct);
    c.beginPath(); c.ellipse(cx,ct,cw,h*.012,0,0,7); c.fill();
    c.fillStyle="#efe6cf";
    [[-.8,.12],[.4,.2],[.85,.08]].forEach(([dx,len])=>{ const x=cx+dx*cw; c.beginPath(); c.moveTo(x-3,ct); c.lineTo(x-3,ct+h*len); c.arc(x,ct+h*len,3,Math.PI,0,true); c.lineTo(x+3,ct); c.fill(); });
    // wick + flame + halo
    c.strokeStyle="#2a1a0c"; c.lineWidth=2; c.beginPath(); c.moveTo(cx,ct); c.lineTo(cx+1,ct-h*.03); c.stroke();
    glowDot(c,cx,ct-h*.09,w*.5,"rgba(255,190,90,.30)");
    c.fillStyle=rad(c,cx,ct-h*.05,1,cx,ct-h*.08,h*.09,[[0,"#ffffff"],[.35,"#ffe8a0"],[.75,"#ff9a2a"],[1,"rgba(255,120,20,0)"]]);
    c.beginPath(); c.moveTo(cx,ct-h*.19); c.bezierCurveTo(cx+w*.09,ct-h*.08,cx+w*.06,ct-h*.01,cx,ct-h*.01); c.bezierCurveTo(cx-w*.06,ct-h*.01,cx-w*.09,ct-h*.08,cx,ct-h*.19); c.fill();
    c.fillStyle="rgba(80,140,255,.55)"; c.beginPath(); c.ellipse(cx,ct-h*.025,w*.025,h*.018,0,0,7); c.fill();
  },
  books(c,w,h,r){
    contactShadow(c,w*.5,h*.985,w*.48,h*.03);
    const cols=[["#5e1a18","#8a2a24"],["#1f3a2c","#2f5a42"],["#1c2440","#2c3a66"],["#6b4a1a","#9a6e2a"]];
    let y=h*.995;
    for(let i=0;i<4;i++){
      const bh=h*(.2+r()*.06), bw=w*(.78+r()*.2), x=(w-bw)/2+(r()-.5)*w*.08;
      y-=bh; const [a,b]=cols[i];
      // page block on the right end
      c.fillStyle=lin(c,0,y,0,y+bh,[[0,"#efe4c6"],[1,"#b9a87c"]]); c.fillRect(x+bw-w*.05,y+bh*.1,w*.05,bh*.8);
      c.strokeStyle="rgba(120,100,60,.4)"; c.lineWidth=1; for(let k=1;k<5;k++){ c.beginPath(); c.moveTo(x+bw-w*.05,y+bh*.1+bh*.16*k); c.lineTo(x+bw,y+bh*.1+bh*.16*k); c.stroke(); }
      // spine
      c.fillStyle=lin(c,0,y,0,y+bh,[[0,b],[.5,a],[1,"#120806"]]);
      c.beginPath(); c.roundRect(x,y,bw-w*.04,bh,[bh*.3,2,2,bh*.3]); c.fill();
      c.fillStyle="#d4ae55"; [x+bw*.08,x+bw*.13,x+bw*.8,x+bw*.85].forEach(gx=>c.fillRect(gx,y+bh*.08,2,bh*.84));
      c.fillStyle="rgba(230,200,120,.85)"; c.fillRect(x+bw*.3,y+bh*.42,bw*.36,bh*.16);
      c.fillStyle="rgba(255,240,220,.12)"; c.fillRect(x+4,y+bh*.12,bw-w*.1,bh*.14);
    }
  },
  camera(c,w,h,r){
    const black=lin(c,0,0,0,h,[[0,"#3a3632"],[.5,"#1b1917"],[1,"#0c0b0a"]]), chrome=(x0,x1)=>lin(c,x0,0,x1,0,[[0,"#5a5a58"],[.3,"#e8e6de"],[.55,"#8d8c86"],[.8,"#d8d6cc"],[1,"#4a4a48"]]);
    contactShadow(c,w*.55,h*.985,w*.4,h*.03);
    // magazine reels on top
    [[w*.42,h*.3],[w*.72,h*.3]].forEach(([x,y])=>{
      c.fillStyle=black; c.beginPath(); c.arc(x,y,w*.16,0,7); c.fill();
      c.strokeStyle="rgba(200,200,190,.35)"; c.lineWidth=2; c.beginPath(); c.arc(x,y,w*.16,0,7); c.stroke();
      c.fillStyle=chrome(x-w*.04,x+w*.04); c.beginPath(); c.arc(x,y,w*.04,0,7); c.fill();
      for(let k=0;k<3;k++){ const a=k*2.094+r(); c.fillStyle="#0a0908"; c.beginPath(); c.arc(x+Math.cos(a)*w*.095,y+Math.sin(a)*w*.095,w*.03,0,7); c.fill(); }
    });
    // body
    c.fillStyle=black; c.beginPath(); c.roundRect(w*.3,h*.48,w*.56,h*.42,6); c.fill();
    c.fillStyle="rgba(255,255,255,.04)"; for(let i=0;i<300;i++) c.fillRect(w*.3+r()*w*.56,h*.48+r()*h*.42,1.5,1.5);
    c.strokeStyle="rgba(220,220,210,.35)"; c.lineWidth=2; c.beginPath(); c.roundRect(w*.3,h*.48,w*.56,h*.42,6); c.stroke();
    // lens barrel + matte box
    c.fillStyle=chrome(0,0); c.fillStyle=lin(c,0,h*.6,0,h*.78,[[0,"#d8d6cc"],[.4,"#6a6a66"],[1,"#2a2a28"]]);
    c.fillRect(w*.13,h*.6,w*.17,h*.18);
    c.fillStyle="#141312"; c.fillRect(w*.17,h*.585,w*.03,h*.21); c.fillRect(w*.23,h*.585,w*.025,h*.21);
    c.fillStyle=lin(c,0,h*.55,0,h*.83,[[0,"#2a2826"],[1,"#0c0b0a"]]); c.beginPath(); c.moveTo(w*.13,h*.62); c.lineTo(w*.04,h*.55); c.lineTo(w*.04,h*.83); c.lineTo(w*.13,h*.76); c.fill();
    c.fillStyle=rad(c,w*.06,h*.66,1,w*.07,h*.69,w*.05,[[0,"#cfe6ff"],[.4,"#3a5a8a"],[1,"#0a1020"]]); c.beginPath(); c.ellipse(w*.07,h*.69,w*.02,h*.1,0,0,7); c.fill();
    // viewfinder, crank, chrome plate, feet
    c.fillStyle=black; c.fillRect(w*.62,h*.42,w*.2,h*.07); c.fillStyle=chrome(w*.8,w*.86); c.fillRect(w*.8,h*.425,w*.06,h*.06);
    c.strokeStyle=chrome(w*.86,w*.98); c.lineWidth=w*.022; c.lineCap="round"; c.beginPath(); c.moveTo(w*.86,h*.7); c.lineTo(w*.94,h*.7); c.lineTo(w*.94,h*.8); c.stroke();
    c.fillStyle=chrome(w*.4,w*.62); c.beginPath(); c.roundRect(w*.42,h*.62,w*.18,h*.1,3); c.fill();
    c.fillStyle="#2a2826"; c.font=`${h*.036}px "IM Fell English SC", Georgia, serif`; c.textAlign="center"; c.textBaseline="middle"; c.fillText("FREETIME",w*.51,h*.672,w*.16);
    c.fillStyle=chrome(w*.3,w*.86); c.fillRect(w*.32,h*.9,w*.52,h*.05);
    c.fillStyle="#0c0b0a"; c.fillRect(w*.36,h*.95,w*.06,h*.04); c.fillRect(w*.74,h*.95,w*.06,h*.04);
  },
  coins(c,w,h,r){
    const coin=(x,y,rr,gold,tilt)=>{
      const ry=rr*tilt;
      c.fillStyle=gold?"#7a5410":"#6c6e70"; c.beginPath(); c.ellipse(x,y+rr*.12,rr,ry,0,0,7); c.fill();
      c.fillStyle=rad(c,x-rr*.35,y-ry*.4,rr*.1,x,y,rr,gold?[[0,"#fff4c0"],[.5,"#e3b74c"],[1,"#8a5e14"]]:[[0,"#ffffff"],[.5,"#c9ccd0"],[1,"#6c6e72"]]);
      c.beginPath(); c.ellipse(x,y,rr,ry,0,0,7); c.fill();
      c.strokeStyle=gold?"rgba(110,70,10,.6)":"rgba(70,72,76,.6)"; c.lineWidth=1.4; c.beginPath(); c.ellipse(x,y,rr*.78,ry*.78,0,0,7); c.stroke();
      c.fillStyle=gold?"rgba(120,80,15,.55)":"rgba(80,82,86,.5)"; c.beginPath(); c.ellipse(x,y,rr*.32,ry*.36,0,0,7); c.fill();
    };
    contactShadow(c,w*.5,h*.8,w*.45,h*.16);
    // a short stack on the left, the rest scattered
    for(let k=0;k<6;k++) coin(w*.24,h*.66-k*h*.055,w*.13,k%2===0,.42);
    const spots=[[.5,.5,1],[.66,.7,0],[.78,.42,1],[.46,.78,1],[.86,.72,0],[.62,.3,1],[.36,.42,0]];
    spots.forEach(([x,y,g])=>coin(w*x,h*y,w*(.1+r()*.025),!!g,.45+r()*.12));
  },
  gears(c,w,h,r){
    const gear=(x,y,R,teeth,rot)=>{
      c.save(); c.translate(x,y); c.rotate(rot);
      c.beginPath();
      for(let i=0;i<teeth*2;i++){ const a=i/(teeth*2)*Math.PI*2, rr=i%2?R*.84:R; const a2=a+Math.PI/(teeth*2);
        c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); c.lineTo(Math.cos(a2)*rr,Math.sin(a2)*rr); }
      c.closePath();
      c.fillStyle=rad(c,-R*.35,-R*.35,R*.1,0,0,R*1.1,[[0,"#fff0b8"],[.45,"#d4a84a"],[1,"#6b4a12"]]); c.fill();
      c.strokeStyle="rgba(60,38,6,.7)"; c.lineWidth=1.5; c.stroke();
      c.globalCompositeOperation="destination-out";
      for(let k=0;k<5;k++){ const a=k/5*Math.PI*2; c.beginPath(); c.ellipse(Math.cos(a)*R*.48,Math.sin(a)*R*.48,R*.16,R*.11,a,0,7); c.fill(); }
      c.beginPath(); c.arc(0,0,R*.14,0,7); c.fill();
      c.globalCompositeOperation="source-over";
      c.strokeStyle="rgba(255,240,200,.35)"; c.lineWidth=1.2; c.beginPath(); c.arc(0,0,R*.7,3.4,4.6); c.stroke();
      c.restore();
    };
    contactShadow(c,w*.5,h*.78,w*.45,h*.2);
    gear(w*.34,h*.5,h*.4,16,r());
    gear(w*.68,h*.4,h*.28,12,r());
    gear(w*.74,h*.76,h*.18,9,r());
    c.fillStyle=lin(c,w*.1,0,w*.9,0,BRASS); c.save(); c.translate(w*.5,h*.9); c.rotate(-.12); c.fillRect(-w*.32,-h*.025,w*.64,h*.05); c.restore();
  },
  letters(c,w,h,r){
    contactShadow(c,w*.5,h*.8,w*.45,h*.16);
    const env=(x,y,ew,eh,rot,col)=>{ c.save(); c.translate(x,y); c.rotate(rot);
      c.fillStyle=col; c.shadowColor="rgba(0,0,0,.35)"; c.shadowBlur=6; c.fillRect(-ew/2,-eh/2,ew,eh); c.shadowBlur=0;
      c.strokeStyle="rgba(120,90,50,.35)"; c.lineWidth=1.2; c.beginPath(); c.moveTo(-ew/2,-eh/2); c.lineTo(0,eh*.08); c.lineTo(ew/2,-eh/2); c.stroke();
      c.restore(); };
    env(w*.52,h*.55,w*.78,h*.62,.08,"#d9c79c");
    env(w*.5,h*.5,w*.8,h*.62,-.05,"#e6d7b0");
    env(w*.48,h*.48,w*.78,h*.6,.02,"#efe3c4");
    c.fillStyle="rgba(70,50,30,.6)"; c.font=`italic ${h*.09}px "IM Fell English", Georgia, serif`; c.textAlign="left"; c.fillText("M. P., Praha",w*.18,h*.62);
    c.strokeStyle="#7a5a32"; c.lineWidth=2.4; c.beginPath(); c.moveTo(w*.08,h*.5); c.lineTo(w*.92,h*.46); c.moveTo(w*.46,h*.16); c.lineTo(w*.5,h*.84); c.stroke();
    c.fillStyle=rad(c,w*.47,h*.46,1,w*.48,h*.48,w*.08,[[0,"#d0453a"],[.7,"#8a1f18"],[1,"#5a1410"]]); c.beginPath(); for(let k=0;k<12;k++){ const a=k/12*Math.PI*2, rr=w*(.07+(k%2)*.012); c.lineTo(w*.48+Math.cos(a)*rr,h*.48+Math.sin(a)*rr*1.1); } c.fill();
    c.fillStyle="rgba(60,10,8,.5)"; c.beginPath(); c.arc(w*.48,h*.48,w*.035,0,7); c.fill();
  },
};

function paintArt(ctx,w,h,item,v){
  const r=R(item.seed*977+v*131+7);
  ctx.save();
  if(v===1||v===3){ const z=v===1?1.75:1.35, fx=w*(.3+r()*.4), fy=h*(.3+r()*.4); ctx.translate(fx,fy); ctx.scale(z,z); ctx.translate(-fx,-fy); }
  ART[item.art](ctx,w,h,R(item.seed*31+(v===2?999:0)),v);
  ctx.restore();
  texture(ctx,w,h,R(item.seed+5+v));
  varnish(ctx,w,h,v===3);
}

function paintObjSlide(c,W,H,it,v){
  const r=R(it.seed*7+v);
  // backdrop: the same green wall, lit from above
  c.fillStyle=rad(c,W*.5,H*.32,0,W*.5,H*.45,W*.75,[[0,v===2?"#3a3a22":"#26443a"],[1,"#060d09"]]); c.fillRect(0,0,W,H);
  c.save(); c.globalAlpha=.06; c.fillStyle="#9fd0a8";
  for(let y=0;y<H;y+=H/5) for(let x=(y/(H/5))%2?W/10:0;x<W;x+=W/5){ c.beginPath(); c.ellipse(x,y,W*.025,H*.06,0,0,7); c.fill(); }
  c.restore();
  // object rendered large off-screen, then placed on a plank
  const oh=H*.66, ow=oh*it.aw/it.ah, off=document.createElement("canvas");
  off.width=Math.round(ow); off.height=Math.round(oh); OBJ[it.shelf](off.getContext("2d"),off.width,off.height,R(it.seed));
  const plankY=H*.86, ox=(W-ow)/2, oy=plankY-oh+4;
  c.save();
  if(v===1||v===3){ const z=v===1?1.9:1.45, fx=W/2+(r()-.5)*ow*.3, fy=oy+oh*(v===1?.35:.5); c.translate(fx,fy); c.scale(z,z); c.translate(-fx,-fy); }
  c.fillStyle=lin(c,0,plankY,0,plankY+H*.06,[[0,"#a87a4c"],[.12,"#6a4626"],[1,"#2e1b0d"]]); c.fillRect(-W,plankY,W*3,H*.06);
  c.fillStyle="rgba(0,0,0,.45)"; c.fillRect(-W,plankY+H*.06,W*3,H*.02);
  c.shadowColor="rgba(0,0,0,.55)"; c.shadowBlur=H*.04; c.shadowOffsetX=H*.02; c.shadowOffsetY=H*.025;
  c.drawImage(off,ox,oy,ow,oh);
  c.restore();
  if(v===2) glowDot(c,W*.15,H*.2,W*.6,"rgba(255,180,90,.18)");
  varnish(c,W,H,v===2);
}

export { ART, OBJ, paintArt, paintObjSlide };

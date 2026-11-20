// Camera: wallpaper canvas, pan by dragging, zoom towards the cursor, candlelight darkness.
// Rules from the prototype (CLAUDE.md): instant pan/zoom, no inertia, never below CUT_Y.

import { clamp, reduceMotion } from './util.js';

// world: #world element; WALL: wall bounds incl. the cabinet, y1 = CUT_Y; BOUNDS: hung items + nameplate;
// PLATE: nameplate box; centre: the centre piece; candleFlames: [[x,y]] world positions;
// ui.viewerOpen: set by the viewer while it is open. The admin's wall editor passes dark:false (no
// candlelight darkness, the room is fully lit) and moves the bounds with setWall() as items move.
// hooks (phase 6): shadows(state) runs every frame after the camera moved, with state.changed when the
// view or the hand candle moved since the last frame; dark(dctx, k, state) paints extra darkness (the
// frame lips) into the quarter-res darkness canvas after the lights were cut out.
/**
 * Where a visitor's view opens on a vw×vh window: centred on START (data.view, by default above the
 * middle of the cabinet), at the zoom that fits the nameplate and the centre piece, then held inside the
 * wall's margins and above the page end – exactly what the camera does on load. Pure, so the admin can
 * draw the same frame on the wall.
 */
/**
 * With a fixed room size (admin → Stěna → Velikost místnosti, WALL.hard) the room must always cover the
 * window: this is the farthest zoom that still does. 0 for a room that grows with its content.
 */
function coverZoom(WALL,vw,vh){
  return WALL.hard?Math.max(vw/(WALL.x1-WALL.x0),vh/(WALL.y1-WALL.y0)):0;
}

export function openingView({ WALL, PLATE, centre, START }, vw, vh) {
  // a tab opened in the background can report a 0×0 window: z would be 0 and every position NaN
  vw=Math.max(vw,320); vh=Math.max(vh,320);
  const Z_MAX=1.25, zMin=Math.max(.7*Math.min(1,vw/1566),coverZoom(WALL,vw,vh));
  const c=centre, top=PLATE.y-PLATE.h/2, bot=c.y+c.oh/2+c.padB, span=bot-top;
  const lo=Math.min(zMin,Z_MAX), hi=Math.max(1.1,lo);
  const z=clamp(Math.min(vw/1250,(vh-120)/(span+170)),lo,hi);
  // a fixed room (WALL.hard) is the whole page: no margin outside it
  const side=WALL.hard?0:Math.max(72,Math.min(440,vw*.26)), pt=WALL.hard?0:Math.max(72,Math.min(160,vh*.12));
  const ax=WALL.x0-side/z+vw/(2*z), bx=WALL.x1+side/z-vw/(2*z);
  const [x0,x1]=ax<=bx?[ax,bx]:[(ax+bx)/2,(ax+bx)/2];
  const ay=WALL.y0-pt/z+vh/(2*z), by=WALL.y1-vh/(2*z);
  const [y0,y1]=ay<=by?[ay,by]:[by,by];
  return { x:clamp(START.x,x0,x1), y:clamp(START.y,y0,y1), z };
}

export function startCamera({ world, WALL: wall0, BOUNDS, PLATE, centre, START, candleFlames, ui, dark: darkOn = true, hooks = {}, zFloor = null, fitBox = null }) {
  // Wallpaper: one element with the tile as a repeating background, a tile larger than the screen on
  // every side, moved by transform only – panning composites it and never repaints it; only a zoom
  // change re-rasterises it (new background-size). It used to be a full-screen <canvas> refilled with a
  // pattern on every frame, and a trace of a pan showed the GPU missing frames (2026-10-13).
  const wall=document.getElementById("wall");
  let tileW=0, tileH=0, wallZ=-1, rasterZ=0, settle=0;
  function sizeWall(){ wallZ=-1; }
  function drawWall(ox,oy,z){
    const t=window.__wallTile;
    if(window.__wallDirty||(!tileW&&t)){
      window.__wallDirty=false;
      if(!t) return;
      // world px per tile px: 0.5 for the painted 2x tile, tileWorld/width for a photographed one
      const s=window.__wallTileScale||.5;
      tileW=(t.naturalWidth||t.width)*s; tileH=(t.naturalHeight||t.height)*s;
      wall.style.backgroundImage=`url("${t instanceof HTMLImageElement?t.src:t.toDataURL()}")`;
      wallZ=-1;
      // fade in from the black page, a frame later so the transition starts from opacity 0
      requestAnimationFrame(()=>wall.classList.add("tiled"));
    }
    if(!tileW) return;
    // The tile is rastered at zoom wallZ and the element is SCALED to the current zoom, so a zoom does not
    // repaint the wallpaper every frame (a new background-size did, all of it); it is re-rastered at the
    // exact zoom once the zoom settles (tick) or when it drifts too far to stay sharp.
    if(wallZ<0||Math.abs(z-wallZ)/wallZ>.3){
      wallZ=z;
      const tw0=tileW*z, th0=tileH*z;
      wall.style.transformOrigin="0 0";
      wall.style.backgroundSize=`${tw0}px ${th0}px`;
      // big enough to cover the screen at the smallest scale it will be shown at (1/1.3) plus one tile
      wall.style.width=`${Math.ceil(vw*1.3+2*tw0)}px`; wall.style.height=`${Math.ceil(vh*1.3+2*th0)}px`;
    }
    const s=z/wallZ, tw=tileW*z, th=tileH*z;
    wall.style.transform=`translate3d(${((ox%tw)+tw)%tw-tw}px,${((oy%th)+th)%th-th}px,0) scale(${s.toFixed(5)})`;
  }
  let vw=innerWidth, vh=innerHeight;
  let WALL=wall0;
  const cam={x:BOUNDS.cx,y:BOUNDS.cy,z:1}, tgt={x:BOUNDS.cx,y:BOUNDS.cy,z:1};
  const Z_MAX=1.25; // closest allowed view (world px -> screen px)
  const Z_MIN=.7;   // farthest view on a ~1566px-wide window; narrower windows scale it down proportionally
  let zMin=.3, zMax=Z_MAX, zHome=1;
  let last="";
  function fitZooms(){
    vw=innerWidth||vw||320; vh=innerHeight||vh||320;
    const P=pad();
    const fitAll=Math.min((vw-2*Math.min(P.l,80))/(WALL.x1-WALL.x0),(vh-P.t)/(WALL.y1-WALL.y0));
    zHome=clamp(Math.min(vw/1250,vh/900),.32,1.1);
    // zFloor: the admin's editor may look much farther out than a visitor (whole room, its edges)
    zMin=zFloor??Math.min(Z_MAX,Math.max(Z_MIN*Math.min(1,vw/1566),coverZoom(WALL,vw,vh))); void fitAll; zMax=Z_MAX;
    tgt.z=clamp(tgt.z,zMin,zMax);
  }
  fitZooms();
  { // opening shot: see openingView()
    const o=openingView({WALL,PLATE,centre,START},vw,vh);
    zHome=o.z; cam.z=tgt.z=o.z; cam.x=tgt.x=o.x; cam.y=tgt.y=o.y;
  }

  // screen-space margin around the wall (px), constant at every zoom; top/bottom leave room for the HUD
  function pad(){
    if(WALL.hard) return {l:0,r:0,t:0,b:0}; // a fixed room is the page: nothing outside it is shown
    const side=Math.max(72,Math.min(440,vw*.26));
    return {l:side,r:side,t:Math.max(72,Math.min(160,vh*.12)),b:Math.max(96,Math.min(180,vh*.14))};
  }
  // allowed camera-centre range at zoom z, so every wall edge can reach its screen margin
  function range(lo,hi,view,pA,pB,z){
    const a=lo-pA/z+view/(2*z), b=hi+pB/z-view/(2*z);
    return a<=b?[a,b]:[(a+b)/2,(a+b)/2];
  }
  const rangeX=z=>{ const P=pad(); return range(WALL.x0,WALL.x1,vw,P.l,P.r,z); };
  // vertically the screen bottom may never pass CUT_Y (the cabinet foot stays hidden); if everything fits, sit on that line
  const rangeY=z=>{ const P=pad(), lo=WALL.y0-P.t/z+vh/(2*z), hi=WALL.y1-vh/(2*z); return lo<=hi?[lo,hi]:[hi,hi]; };
  function clampTarget(){
    const [x0,x1]=rangeX(tgt.z), [y0,y1]=rangeY(tgt.z);
    tgt.x=clamp(tgt.x,x0,x1); tgt.y=clamp(tgt.y,y0,y1);
  }
  // rubber band: signed distance past the allowed range (0 when inside)
  const overshoot=(v,[lo,hi])=>v<lo?v-lo:v>hi?v-hi:0;

  /* ---- drag state ---- */
  const drag={active:false,id:null,moved:false,sx:0,sy:0,lx:0,ly:0,lt:0,vx:0,vy:0};
  let inertia=false;
  // zoom anchor keeps the wall point under the cursor fixed while zoom animates
  let anchor=null;
  let lastT=performance.now(), shadowKey="";

  function tick(now){
    const dt=Math.min(48,now-lastT); lastT=now;
    if(!ui.viewerOpen){
      if(inertia&&!drag.active){
        tgt.x+=drag.vx*dt; tgt.y+=drag.vy*dt;
        const f=Math.pow(.93,dt/16.7); drag.vx*=f; drag.vy*=f;
        // brake hard if inertia carries past an edge
        if(overshoot(tgt.x,rangeX(tgt.z))) drag.vx*=.6;
        if(overshoot(tgt.y,rangeY(tgt.z))) drag.vy*=.6;
        if(Math.hypot(drag.vx,drag.vy)*cam.z<.01) inertia=false;
        cam.x=tgt.x; cam.y=tgt.y;
      }
      if(!drag.active&&!inertia) clampTarget();
      const kz=1, kp=1; // instant camera: no easing on pan or zoom
      cam.z+=(tgt.z-cam.z)*kz;
      if(Math.abs(tgt.z-cam.z)<.0008) cam.z=tgt.z;
      if(anchor){
        // derive position from zoom so the anchored point never drifts
        cam.x=anchor.wx-(anchor.sx-vw/2)/cam.z; cam.y=anchor.wy-(anchor.sy-vh/2)/cam.z;
        if(cam.z===tgt.z){ anchor=null; tgt.x=cam.x; tgt.y=cam.y; }
      } else if(!drag.active){
        cam.x+=(tgt.x-cam.x)*kp; cam.y+=(tgt.y-cam.y)*kp;
        if(Math.abs(tgt.x-cam.x)*cam.z<.3) cam.x=tgt.x;
        if(Math.abs(tgt.y-cam.y)*cam.z<.3) cam.y=tgt.y;
      }
    }
    // candle flicker: small random swings in reach and warmth
    if(!reduceMotion){
      flickT-=dt;
      if(flickT<=0){ flickTo=1+(Math.random()-.5)*.07; flickT=50+Math.random()*130; }
      const nf=flick+(flickTo-flick)*.22; if(Math.abs(nf-flick)>.0004){ flick=nf; glowDirty=true; }
    }
    if(glowDirty&&darkOn){
      glow.style.transform=`translate3d(${glowX}px,${glowY}px,0) scale(${flick.toFixed(4)})`;
      glow.style.opacity=(.85+(flick-1)*5).toFixed(3);
      glowDirty=false;
    }
    // nothing to light behind the open viewer: the darkness keeps its last frame
    if(darkOn&&!ui.viewerOpen) drawDark(dt);
    if(hooks.shadows){
      const sk=`${cam.x.toFixed(2)}|${cam.y.toFixed(2)}|${cam.z.toFixed(4)}|${vw}|${vh}|${glowX}|${glowY}`;
      hooks.shadows({cam,vw,vh,lx:glowX,ly:glowY,changed:sk!==shadowKey}); shadowKey=sk;
    }
    const key=`${cam.x.toFixed(2)}|${cam.y.toFixed(2)}|${cam.z.toFixed(4)}|${vw}|${vh}`;
    if(key!==last){
      last=key;
      world.style.transform=`translate3d(${(vw/2-cam.x*cam.z).toFixed(2)}px,${(vh/2-cam.y*cam.z).toFixed(2)}px,0) scale(${cam.z.toFixed(4)})`;
      drawWall(vw/2-cam.x*cam.z, vh/2-cam.y*cam.z, cam.z);
      settle=0;
    } else if(window.__wallDirty){ drawWall(vw/2-cam.x*cam.z, vh/2-cam.y*cam.z, cam.z); }
    // once zoom has settled, re-rasterise the wall layer at the new scale so frames stay sharp
    // the wallpaper too: re-raster its tile at the settled zoom (drawWall scaled it meanwhile)
    if(settle===11 && wallZ>0 && wallZ!==cam.z){ wallZ=-1; drawWall(vw/2-cam.x*cam.z, vh/2-cam.y*cam.z, cam.z); }
    if(++settle===12 && Math.abs(cam.z-rasterZ)/cam.z>0.04){
      rasterZ=cam.z; world.style.willChange="auto";
      requestAnimationFrame(()=>{ world.style.willChange="transform"; });
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  addEventListener("resize",()=>{ fitZooms(); sizeWall(); sizeDark(); last=""; });

  const glow=document.querySelector(".glow"), dark=document.querySelector(".dark"), dctx=dark.getContext("2d");
  let glowX=innerWidth/2, glowY=innerHeight/2, glowDirty=true, flick=1, flickTo=1, flickT=0;
  // darkness: drawn at 1/4 resolution and stretched by CSS (gradients stay smooth); lights are cut out of it
  const DARK_RES=4;
  function sizeDark(){ dark.width=Math.ceil(innerWidth/DARK_RES); dark.height=Math.ceil(innerHeight/DARK_RES); }
  sizeDark();
  // cursor candle: [radius px, how much light] — light 1 = no darkness
  const HAND_LIGHT=[[0,1],[140,1],[280,.72],[470,.38],[700,.14],[980,.04],[1300,0]];
  // candles standing on shelves light their own patch of wall
  const CANDLES=candleFlames.map(pos=>({pos,f:1,to:1,t:0}));
  const flameWorld=c=>c.pos;
  function cutLight(x,y,stops,scale){
    const k=1/DARK_RES, R=stops[stops.length-1][0]*scale*k;
    // one bad light must not throw inside tick() – that would stop the camera loop for good
    if(!(R>0)||!Number.isFinite(x+y+R)) return;
    const g=dctx.createRadialGradient(x*k,y*k,0,x*k,y*k,R);
    stops.forEach(([px,a])=>g.addColorStop(Math.min(1,px*scale*k/R),`rgba(0,0,0,${a})`));
    dctx.fillStyle=g; dctx.fillRect(x*k-R,y*k-R,2*R,2*R);
  }
  function drawDark(dt){
    const W=dark.width, H=dark.height;
    dctx.globalCompositeOperation="source-over"; dctx.fillStyle="rgba(2,1,0,.97)"; dctx.fillRect(0,0,W,H);
    dctx.globalCompositeOperation="destination-out";
    cutLight(glowX,glowY,HAND_LIGHT,flick);
    CANDLES.forEach(c=>{
      if(!reduceMotion){ c.t-=dt; if(c.t<=0){ c.to=1+(Math.random()-.5)*.12; c.t=40+Math.random()*110; } c.f+=(c.to-c.f)*.25; }
      const [wx,wy,reach=340]=flameWorld(c), sx=vw/2+(wx-cam.x)*cam.z, sy=vh/2+(wy-cam.y)*cam.z, z=cam.z*c.f*reach/340;
      cutLight(sx,sy,[[0,.95],[30,.9],[90,.62],[170,.3],[260,.1],[340,0]],z);
    });
    dctx.globalCompositeOperation="source-over";
    if(hooks.dark) hooks.dark(dctx,1/DARK_RES,{cam,vw,vh,lx:glowX,ly:glowY});
  }
  addEventListener("pointermove",e=>{
    glowX=e.clientX; glowY=e.clientY; glowDirty=true;
  });

  /* ---- zoom: wheel / keys / pinch, always toward a screen point ---- */
  function zoomAt(newZ,sx,sy){
    newZ=clamp(newZ,zMin,zMax);
    // anchor from the current on-screen state, so repeated wheel ticks compound cleanly
    const wx=cam.x+(sx-vw/2)/cam.z, wy=cam.y+(sy-vh/2)/cam.z;
    anchor=null; inertia=false; cam.z=tgt.z=newZ;
    cam.x=tgt.x=wx-(sx-vw/2)/newZ; cam.y=tgt.y=wy-(sy-vh/2)/newZ;
    clampTarget(); cam.x=tgt.x; cam.y=tgt.y;
  }
  addEventListener("wheel",e=>{
    if(ui.viewerOpen) return;
    e.preventDefault();
    const d=e.deltaMode===1?e.deltaY*16:e.deltaY;
    zoomAt(tgt.z*Math.exp(-d*(e.ctrlKey?.006:.0013)),e.clientX,e.clientY);
  },{passive:false});
  function resetView(){
    anchor=null; inertia=false;
    // fitBox (admin): () => ({ box, m }) – show that world box whole between screen margins m (panels)
    const f=fitBox?.();
    if(f){
      const { box:b, m }=f, w=vw-m.l-m.r, h=vh-m.t-m.b;
      tgt.z=clamp(Math.min(w/(b.x1-b.x0),h/(b.y1-b.y0)),zMin,zMax);
      tgt.x=(b.x0+b.x1)/2-(m.l-m.r)/2/tgt.z; tgt.y=(b.y0+b.y1)/2-(m.t-m.b)/2/tgt.z;
      return;
    }
    tgt.z=zMin;
    const [x0,x1]=rangeX(zMin), [y0,y1]=rangeY(zMin); tgt.x=(x0+x1)/2; tgt.y=(y0+y1)/2;
  }

  /* ---- drag to pan (mouse, pen, touch) + pinch ---- */
  const ptrs=new Map(); let pinch=null;
  const DRAG_THRESHOLD=6;
  const stage=world.parentElement;
  stage.addEventListener("pointerdown",e=>{
    if(ui.viewerOpen) return;
    if(e.target.closest(".viewer")) return;
    if(e.pointerType==="mouse"&&e.button!==0) return;
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===1){
      Object.assign(drag,{active:true,id:e.pointerId,moved:false,sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,lt:performance.now(),vx:0,vy:0});
      inertia=false; anchor=null; tgt.x=cam.x; tgt.y=cam.y;
    } else if(ptrs.size===2){
      const [a,b]=[...ptrs.values()];
      pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:tgt.z}; drag.moved=true;
    }
  });
  addEventListener("pointermove",e=>{
    if(!ptrs.has(e.pointerId)) return;
    const p=ptrs.get(e.pointerId); p.x=e.clientX; p.y=e.clientY;
    if(ptrs.size===2&&pinch){
      const [a,b]=[...ptrs.values()];
      zoomAt(pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d,(a.x+b.x)/2,(a.y+b.y)/2);
      return;
    }
    if(!drag.active||e.pointerId!==drag.id) return;
    if(!drag.moved&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<DRAG_THRESHOLD) return;
    if(!drag.moved){ drag.moved=true; document.body.classList.add("dragging"); drag.lx=e.clientX; drag.ly=e.clientY; }
    const now=performance.now(), dt=Math.max(1,now-drag.lt);
    let dx=-(e.clientX-drag.lx)/cam.z, dy=-(e.clientY-drag.ly)/cam.z;
    // resistance past the edge (rubber band)
    tgt.x+=dx; tgt.y+=dy; clampTarget(); cam.x=tgt.x; cam.y=tgt.y;
    drag.vx=drag.vx*.6+(dx/dt)*.4; drag.vy=drag.vy*.6+(dy/dt)*.4;
    drag.lx=e.clientX; drag.ly=e.clientY; drag.lt=now;
  });
  function endPtr(e){
    if(!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if(ptrs.size<2) pinch=null;
    if(e.pointerId===drag.id){
      drag.active=false; document.body.classList.remove("dragging");
      // only fling if the pointer was still moving at release
      const idle=performance.now()-drag.lt;
      inertia=false; void idle;
      if(!inertia){ drag.vx=drag.vy=0; }
    }
    if(ptrs.size===1){
      // a pinch finger lifted: continue panning with the remaining finger
      const [id,p]=[...ptrs.entries()][0];
      Object.assign(drag,{active:true,id,lx:p.x,ly:p.y,lt:performance.now(),vx:0,vy:0});
    }
  }
  addEventListener("pointerup",endPtr); addEventListener("pointercancel",endPtr);
  // a drag that ends over a frame must not open it
  addEventListener("click",e=>{ if(drag.moved){ e.stopPropagation(); e.preventDefault(); drag.moved=false; } },true);

  /* ---- keyboard ---- */
  addEventListener("keydown",e=>{
    if(ui.viewerOpen) return;
    const step=140/cam.z;
    const k={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(k){ e.preventDefault(); anchor=null; inertia=false; tgt.x+=k[0]*step; tgt.y+=k[1]*step; }
    if(e.key==="+"||e.key==="=") zoomAt(tgt.z*1.2,vw/2,vh/2);
    if(e.key==="-") zoomAt(tgt.z/1.2,vw/2,vh/2);
    if(e.key==="0") resetView();
  });

  return {
    // move the view to a world point (keyboard focus on an exhibit)
    focusOn(x, y) { anchor=null; inertia=false; tgt.x=x; tgt.y=y; },
    // force a redraw on the next frame (after the viewer closes)
    invalidate() { last=""; },
    // screen px -> world px (the editor converts pointer positions with it)
    toWorld(sx, sy) { return { x: cam.x+(sx-vw/2)/cam.z, y: cam.y+(sy-vh/2)/cam.z }; },
    zoom() { return cam.z; },
    // new wall bounds after the layout changed (editor); the view is clamped on the next frame
    setWall(w) { WALL=w; },
    candles(list) { CANDLES.length=0; list.forEach(pos=>CANDLES.push({pos,f:1,to:1,t:0})); },
    // admin: darkness preview on/off, zoom controls, the farthest view
    setDark(v) { darkOn=!!v; if(!darkOn) dctx.clearRect(0,0,dark.width,dark.height); },
    zoomBy(f) { zoomAt(tgt.z*f,vw/2,vh/2); },
    fitAll() { resetView(); },
  };
}

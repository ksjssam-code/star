/* ✦ 별 탐구실 — Ⅷ-2. 우주 공용 시뮬레이션 (학생용 index.html · 교사용 teacher.html 공통)
   U2.Galaxy  : 우리은하 모형 (위·옆에서 본 모습, 태양계에서 본 밤하늘)
   U2.drawObject : 성단·성운 그림 (사진 대신 그린 모형)
   U2.Balloon : 풍선 모형 (붙임딱지 거리 재기)
   U2.Expansion : 우주 팽창 모형 (은하 사이 거리, 시간 되돌리기)            */
(function(){
'use strict';
const FONT='"Noto Sans KR",sans-serif';
function rng(seed){let s=seed>>>0||1;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};}
function gauss(r){let u=0,v=0;while(u===0)u=r();v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function setup(el){if(typeof el==='string')el=document.getElementById(el);if(!el)return null;const w=+el.dataset.w,h=+el.dataset.h,d=Math.max(2,window.devicePixelRatio||1);el.width=w*d;el.height=h*d;const x=el.getContext('2d');x.setTransform(d,0,0,d,0,0);return{c:el,x,w,h,d};}
function mk(o){return Object.assign({fs:1.3},o||{});}
function T(x,s,X,Y,col,size,align,weight,fs){x.fillStyle=col||'#eef1ff';x.font=(weight||500)+' '+Math.round((size||13)*(fs||1.3))+'px '+FONT;x.textAlign=align||'left';x.textBaseline='middle';x.fillText(s,X,Y);}
function TS(x,s,X,Y,col,size,align,weight,fs){x.save();x.shadowColor='#000';x.shadowBlur=6;T(x,s,X,Y,col,size,align,weight,fs);x.restore();}
function glow(x,X,Y,r,rgb,a){a=a==null?1:a;const g=x.createRadialGradient(X,Y,0,X,Y,r*3.2);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(.18,`rgba(${rgb},${a})`);g.addColorStop(.45,`rgba(${rgb},${.25*a})`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.beginPath();x.arc(X,Y,r*3.2,0,7);x.fill();}
function arrow(x,x1,y1,x2,y2,col,lw,head){x.strokeStyle=col;x.fillStyle=col;x.lineWidth=lw||3;x.beginPath();x.moveTo(x1,y1);x.lineTo(x2,y2);x.stroke();const a=Math.atan2(y2-y1,x2-x1),h=head||12;x.beginPath();x.moveTo(x2,y2);x.lineTo(x2-h*Math.cos(a-.42),y2-h*Math.sin(a-.42));x.lineTo(x2-h*Math.cos(a+.42),y2-h*Math.sin(a+.42));x.closePath();x.fill();x.lineWidth=1;}
/* value noise (구름 모양) */
function noise2(seed){const r=rng(seed),P=256,g=new Float32Array(P*P);for(let i=0;i<g.length;i++)g[i]=r();
 const at=(i,j)=>g[((j&255)*P)+(i&255)],sm=t=>t*t*(3-2*t);
 const n=(x,y)=>{const i=Math.floor(x),j=Math.floor(y),fx=sm(x-i),fy=sm(y-j);const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;};
 return(x,y,oct)=>{let s=0,amp=.5,f=1;for(let k=0;k<(oct||5);k++){s+=amp*n(x*f,y*f);f*=2;amp*=.5;}return s;};}

/* =================================================================== 지구 공전과 한밤중 하늘의 방향
   month: 1~12 (소수 가능). 7월 한밤중 = 은하 중심(궁수자리) 쪽, 1월 = 반대쪽(쌍둥이·황소자리 쪽),
   4월(봄) = 은하 원반 위쪽(처녀·사자자리 쪽), 10월(가을) = 원반 아래쪽.
   지구 공전 궤도면은 은하 원반에 약 60° 기울어져 있고, 두 면이 만나는 선이 거의 은하 중심 방향임. */
const TILT=60*Math.PI/180;
function night(month){const th=(month-7)*Math.PI/6,v=[Math.sin(th)*Math.cos(TILT),Math.cos(th),-Math.sin(th)*Math.sin(TILT)];
 const m=((Math.round(month)-1)%12+12)%12+1,se=m>=3&&m<=5?'봄':m>=6&&m<=8?'여름':m>=9&&m<=11?'가을':'겨울';
 return{th,v,l:Math.atan2(v[0],v[1])*180/Math.PI,b:Math.asin(v[2])*180/Math.PI,season:se,m};}
function mLabel(month){const m=((Math.round(month)-1)%12+12)%12+1;return m+'월';}

/* =================================================================== 우리은하 */
const KPITCH=Math.tan(19*Math.PI/180),R0=4500,BAR=0.393; // 막대 기울기 약 22.5°, 나선팔은 막대 끝에서 시작
function Galaxy(seed){
 const r=rng(seed||7),P=[];
 const add=(x,y,z,c,m,t)=>P.push({x,y,z,c,m,t});
 const rot=(u,v,a)=>[u*Math.cos(a)-v*Math.sin(a),u*Math.sin(a)+v*Math.cos(a)];
 // 중심부 팽대부
 for(let i=0;i<6500;i++){const x=gauss(r)*1150,y=gauss(r)*1150,z=gauss(r)*820;add(x,y,z,[255,206,140],1.7,'b');}
 // 막대
 for(let i=0;i<5500;i++){let u=gauss(r)*2300;if(Math.abs(u)>4600)u*=.5;const v=gauss(r)*620,z=gauss(r)*420;const[x,y]=rot(u,v,BAR);add(x,y,z,[255,216,155],1.4,'b');}
 // 나선팔 (주요 팔 2 + 작은 팔 2). 작은 팔 하나가 태양계를 지나도록 배치
 const offs=[BAR,BAR+Math.PI,BAR+Math.PI/2,BAR+1.5*Math.PI],wts=[1,1,.55,.55];
 const arm=(j,rr)=>{const th=Math.log(rr/R0)/KPITCH,ph=th+offs[j];return[rr*Math.cos(ph),rr*Math.sin(ph),ph];};
 for(let i=0;i<22000;i++){let j=Math.floor(r()*4);if(r()>wts[j])j=Math.floor(r()*2);const rr=R0+(-Math.log(1-r()*.985))*4200;if(rr>16500)continue;
  const[ax,ay,ph]=arm(j,rr),sc=gauss(r)*(330+rr*.045),z=gauss(r)*190;const x=ax+sc*Math.cos(ph+1.35)+gauss(r)*120,y=ay+sc*Math.sin(ph+1.35)+gauss(r)*120;
  const b=r();add(x,y,z,b<.55?[175,200,255]:b<.85?[225,230,255]:[255,235,210],.85,'a');}
 // 원반 (팔 사이)
 for(let i=0;i<9000;i++){const rr=-Math.log(1-r()*.97)*3600+800;if(rr>16000)continue;const ph=r()*2*Math.PI;add(rr*Math.cos(ph),rr*Math.sin(ph),gauss(r)*300,[235,225,210],.7,'d');}
 // 성운(붉은 기체 덩어리) · 산개 성단 · 구상 성단 — 분포 비교용
 const NEB=[],OC=[],GC=[];
 for(let i=0;i<260;i++){const j=Math.floor(r()*4),rr=R0+400+r()*11000;const[ax,ay,ph]=arm(j,rr),sc=gauss(r)*220;NEB.push({x:ax+sc*Math.cos(ph+1.35),y:ay+sc*Math.sin(ph+1.35),z:gauss(r)*90});}
 for(let i=0;i<150;i++){const j=Math.floor(r()*4),rr=R0+300+r()*11500;const[ax,ay,ph]=arm(j,rr),sc=gauss(r)*260;OC.push({x:ax+sc*Math.cos(ph+1.35),y:ay+sc*Math.sin(ph+1.35),z:gauss(r)*110});}
 for(let i=0;i<150;i++){let rr=Math.abs(gauss(r))*5200+300;if(rr>17000)rr*=.6;const ct=2*r()-1,ph=r()*2*Math.PI,st=Math.sqrt(1-ct*ct);GC.push({x:rr*st*Math.cos(ph),y:rr*st*Math.sin(ph),z:rr*ct});}
 NEB.forEach(n=>add(n.x,n.y,n.z,[255,110,140],1.6,'n'));
 const G={P,NEB,OC,GC,sunR:8500,_pano:{},_top:null,_side:null};

 /* ---- 위에서 본 모습 ---- */
 G.drawTop=function(C,o){o=mk(o);const{x,w,h}=C,cx=w/2,cy=h/2,s=(Math.min(w,h)*.47)/16000,fs=o.fs;
  const key=w+'x'+h;if(!G._top||G._top.key!==key){const oc=document.createElement('canvas');oc.width=w*C.d;oc.height=h*C.d;const ox=oc.getContext('2d');ox.setTransform(C.d,0,0,C.d,0,0);
   ox.fillStyle='#03050d';ox.fillRect(0,0,w,h);const rb=rng(91);for(let i=0;i<160;i++){ox.fillStyle=`rgba(200,210,255,${rb()*.35})`;ox.fillRect(rb()*w,rb()*h,1,1);}
   const gg=ox.createRadialGradient(cx,cy,0,cx,cy,4200*s);gg.addColorStop(0,'rgba(255,225,170,.55)');gg.addColorStop(1,'rgba(255,200,140,0)');ox.fillStyle=gg;ox.beginPath();ox.arc(cx,cy,4200*s,0,7);ox.fill();
   ox.globalCompositeOperation='lighter';
   P.forEach(p=>{if(p.t==='n')return;const X=cx+p.x*s,Y=cy-p.y*s;const a=p.t==='b'?.16:p.t==='a'?.2:.1;ox.fillStyle=`rgba(${p.c[0]},${p.c[1]},${p.c[2]},${a})`;const z=p.t==='b'?1.6:1.3;ox.fillRect(X,Y,z,z);});
   NEB.forEach(p=>{const X=cx+p.x*s,Y=cy-p.y*s;ox.fillStyle='rgba(255,90,130,.35)';ox.beginPath();ox.arc(X,Y,1.6,0,7);ox.fill();});
   ox.globalCompositeOperation='source-over';G._top={key,oc};}
  x.drawImage(G._top.oc,0,0,w,h);
  if(o.grid){x.strokeStyle='rgba(106,209,255,.28)';x.lineWidth=1;const st=5000*s;for(let k=-4;k<=4;k++){x.beginPath();x.moveTo(cx+k*st,0);x.lineTo(cx+k*st,h);x.stroke();x.beginPath();x.moveTo(0,cy+k*st);x.lineTo(w,cy+k*st);x.stroke();}
   x.fillStyle='rgba(5,9,19,.75)';x.fillRect(8,h-34,190,26);x.strokeStyle='#ffd166';x.lineWidth=2;x.beginPath();x.moveTo(16,h-21);x.lineTo(16+st,h-21);x.stroke();T(x,'1칸 = 5000 pc',22+st,h-21,'#ffd166',11,'left',700,fs);}
  if(o.show){const sh=o.show;
   if(sh.neb)NEB.forEach(p=>{if(p.__i===undefined)p.__i=0;const X=cx+p.x*s,Y=cy-p.y*s;x.fillStyle='#ff5a8c';x.beginPath();x.arc(X,Y,2.4,0,7);x.fill();});
   if(sh.oc)OC.forEach(p=>{const X=cx+p.x*s,Y=cy-p.y*s;x.fillStyle='#6ad1ff';x.beginPath();x.arc(X,Y,3,0,7);x.fill();});
   if(sh.gc)GC.forEach(p=>{const X=cx+p.x*s,Y=cy-p.y*s;x.strokeStyle='#ffd166';x.lineWidth=2;x.beginPath();x.arc(X,Y,3.2,0,7);x.stroke();});}
  const sy=cy+G.sunR*s;
  if(o.labels){x.setLineDash([5,5]);x.strokeStyle='rgba(255,209,102,.8)';x.lineWidth=1.5;x.beginPath();x.moveTo(cx-15000*s,cy+h*.44);x.lineTo(cx+15000*s,cy+h*.44);x.stroke();x.setLineDash([]);
   TS(x,'약 30000 pc',cx,cy+h*.44-12,'#ffd166',12,'center',900,fs);
   if(G.sunR>0){x.strokeStyle='rgba(255,255,255,.7)';x.setLineDash([4,4]);x.beginPath();x.moveTo(cx+6,cy);x.lineTo(cx+6,sy);x.stroke();x.setLineDash([]);TS(x,'약 8500 pc',cx+12,(cy+sy)/2,'#fff',11,'left',700,fs);}
   TS(x,'막대 구조',cx+2600*s,cy-2600*s-6,'#ffe3b0',11,'left',700,fs);TS(x,'나선팔',cx-11500*s,cy-7200*s,'#bcd4ff',12,'center',700,fs);}
  if(o.dir!=null){const a=o.dir*Math.PI/180,L=Math.min(w,h)*.3,ex=cx+Math.sin(a)*L,ey=sy-Math.cos(a)*L;const fov=(o.fov||90)*Math.PI/360;
   x.fillStyle='rgba(255,209,102,.14)';x.beginPath();x.moveTo(cx,sy);x.arc(cx,sy,L,-Math.PI/2+a-fov,-Math.PI/2+a+fov);x.closePath();x.fill();arrow(x,cx,sy,ex,ey,'#ffd166',3,14);}
  if(o.earth!=null){const n=night(o.earth),R=Math.min(w,h)*.085;
   x.strokeStyle='rgba(106,209,255,.75)';x.lineWidth=1.5;x.setLineDash([4,3]);x.beginPath();x.ellipse(cx,sy,R*Math.cos(TILT),R,0,0,7);x.stroke();x.setLineDash([]);
   const ex=cx+R*Math.cos(TILT)*Math.sin(n.th),ey=sy-R*Math.cos(n.th);
   const hz=Math.hypot(n.v[0],n.v[1]);let L=Math.min(w,h)*.26*hz;const ux=n.v[0]/(hz||1),uy=-n.v[1]/(hz||1);
   if(uy>0)L=Math.min(L,(h-14-ey)/uy);if(uy<0)L=Math.min(L,(ey-70)/-uy);if(ux>0)L=Math.min(L,(w-14-ex)/ux);if(ux<0)L=Math.min(L,(ex-14)/-ux);
   if(L>6&&hz>.2)arrow(x,ex,ey,ex+ux*L,ey+uy*L,'#ffd166',3,13);
   else{x.strokeStyle='#ffd166';x.lineWidth=2.5;x.beginPath();x.arc(ex,ey,9,0,7);x.stroke();x.lineWidth=1;}
   glow(x,cx,sy,4.5,'255,215,90');const ang=Math.atan2(ey-sy,ex-cx);x.fillStyle='#4aa8ff';x.beginPath();x.arc(ex,ey,5.5,0,7);x.fill();x.fillStyle='#08142a';x.beginPath();x.arc(ex,ey,5.5,ang-Math.PI/2,ang+Math.PI/2);x.fill();
   TS(x,'태양',cx-12,sy+16,'#ffd166',11,'right',900,fs);TS(x,'지구',ex+10,ey-12,'#8fd0ff',11,'left',900,fs);
   const tip=Math.abs(n.v[2])>.5?(n.v[2]>0?' · 원반 위쪽을 봄':' · 원반 아래쪽을 봄'):'';
   x.fillStyle='rgba(5,9,19,.82)';x.fillRect(8,8,w-16,50);T(x,mLabel(o.earth)+' ('+n.season+') 한밤중 · 화살표 = 밤하늘 방향'+tip,16,24,'#ffd166',11,'left',900,fs);
   T(x,'※ 지구 공전 궤도는 아주 크게 과장 (실제는 점보다 훨씬 작음)',16,46,'#9ba6d4',10,'left',500,fs);}
  else if(G.sunR>=0){glow(x,cx,sy,3.2,'255,225,120');TS(x,'태양계',cx+10,sy+14,'#ffd166',12,'left',900,fs);}
  if(o.center!==false)TS(x,'은하 중심',cx,cy-18,'#fff',11,'center',700,fs);
  if(o.title&&o.earth==null)TS(x,o.title,12,16,'#e9edff',12,'left',900,fs);};

 /* ---- 옆에서 본 모습 ---- */
 G.drawSide=function(C,o){o=mk(o);const{x,w,h}=C,cx=w/2,cy=h/2,s=(w*.47)/16000,zs=s*(o.zs||1),fs=o.fs;
  const key=w+'x'+h+(o.zs||1);if(!G._side||G._side.key!==key){const oc=document.createElement('canvas');oc.width=w*C.d;oc.height=h*C.d;const ox=oc.getContext('2d');ox.setTransform(C.d,0,0,C.d,0,0);
   ox.fillStyle='#03050d';ox.fillRect(0,0,w,h);const rb=rng(92);for(let i=0;i<120;i++){ox.fillStyle=`rgba(200,210,255,${rb()*.35})`;ox.fillRect(rb()*w,rb()*h,1,1);}
   const gg=ox.createRadialGradient(cx,cy,0,cx,cy,3800*s);gg.addColorStop(0,'rgba(255,225,170,.6)');gg.addColorStop(1,'rgba(255,200,140,0)');ox.fillStyle=gg;ox.save();ox.translate(cx,cy);ox.scale(1,.72);ox.beginPath();ox.arc(0,0,3800*s,0,7);ox.fill();ox.restore();
   ox.globalCompositeOperation='lighter';P.forEach(p=>{if(p.t==='n')return;const X=cx+p.x*s,Y=cy-p.z*zs;const a=p.t==='b'?.13:.1;ox.fillStyle=`rgba(${p.c[0]},${p.c[1]},${p.c[2]},${a})`;ox.fillRect(X,Y,1.3,1.3);});
   ox.globalCompositeOperation='source-over';ox.fillStyle='rgba(30,12,8,.55)';ox.fillRect(cx-15500*s,cy-1.2,31000*s,2.4);G._side={key,oc};}
  x.drawImage(G._side.oc,0,0,w,h);
  if(o.show){const sh=o.show;
   if(sh.neb)NEB.forEach(p=>{x.fillStyle='#ff5a8c';x.beginPath();x.arc(cx+p.x*s,cy-p.z*zs,2.2,0,7);x.fill();});
   if(sh.oc)OC.forEach(p=>{x.fillStyle='#6ad1ff';x.beginPath();x.arc(cx+p.x*s,cy-p.z*zs,2.8,0,7);x.fill();});
   if(sh.gc)GC.forEach(p=>{x.strokeStyle='#ffd166';x.lineWidth=2;x.beginPath();x.arc(cx+p.x*s,cy-p.z*zs,3.2,0,7);x.stroke();});}
  const sx=cx-G.sunR*s;
  if(o.dir!=null||o.up!=null){const L=Math.min(w,h)*.42,b=(o.up||0)*Math.PI/180,fw=Math.cos((o.dir||0)*Math.PI/180);// 옆모습: 은하 중심(오른쪽) 방향 성분만
   const dx=Math.cos(b)*fw,dy=Math.sin(b),n=Math.hypot(dx,dy)||1;arrow(x,sx,cy,sx+dx/n*L,cy-dy/n*L,'#ffd166',3,14);}
  if(o.earth!=null){const n=night(o.earth),R=h*.32,ex=sx+R*Math.cos(n.th),ey=cy+R*Math.sin(n.th)*Math.sin(TILT);
   x.strokeStyle='rgba(106,209,255,.75)';x.setLineDash([4,3]);x.lineWidth=1.5;x.beginPath();x.ellipse(sx,cy,R,R*Math.sin(TILT),0,0,7);x.stroke();x.setLineDash([]);
   const L=h*.42,vx=n.v[1],vy=-n.v[2];if(Math.hypot(vx,vy)>.15)arrow(x,ex,ey,ex+vx*L,ey+vy*L,'#ffd166',3,12);
   glow(x,sx,cy,4,'255,215,90');x.fillStyle='#4aa8ff';x.beginPath();x.arc(ex,ey,5,0,7);x.fill();TS(x,'지구',ex+8,ey-10,'#8fd0ff',11,'left',900,fs);
   TS(x,'← 바깥쪽',10,h-12,'#9ba6d4',10,'left',700,fs);TS(x,'은하 중심 쪽 →',w-10,h-12,'#9ba6d4',10,'right',700,fs);}
  else if(G.sunR>=0){glow(x,sx,cy,3,'255,225,120');TS(x,'태양계',sx,cy+20,'#ffd166',12,'center',900,fs);}
  if(o.labels){TS(x,'중심부가 볼록',cx,cy-1500*zs-26,'#ffe3b0',12,'center',900,fs);TS(x,'납작한 원반',cx+10500*s,cy-22,'#bcd4ff',12,'center',700,fs);}
  if(o.title)TS(x,o.title,12,16,'#e9edff',12,'left',900,fs);};

 /* ---- 태양계에서 본 하늘 (전천 파노라마) ---- */
 G.pano=function(){const R=G.sunR,k='r'+R;if(G._pano[k])return G._pano[k];
  const W=1440,H=720,N=W*H,Ir=new Float32Array(N),Ig=new Float32Array(N),Ib=new Float32Array(N),pts=[];
  const rj=rng(5150),NJ=8;
  P.forEach(p=>{const d0=Math.hypot(p.x,p.y+R,p.z);if(d0<1)return;
   if(d0<1600){const hz=Math.hypot(p.x,p.y+R);pts.push({l:Math.atan2(p.x,p.y+R),b:Math.atan2(p.z,hz),m:Math.min(1,600/d0)*p.m,c:p.c});}
   const js=p.t==='b'?320:260,jz=p.t==='b'?220:70;
   for(let k=0;k<NJ;k++){const dx=p.x+gauss(rj)*js,dy=p.y+R+gauss(rj)*js,dz=p.z+gauss(rj)*jz,hz=Math.hypot(dx,dy),d=Math.hypot(hz,dz);
    const l=Math.atan2(dx,dy),b=Math.atan2(dz,hz);
    let wt=p.m*1e8/NJ/Math.pow(Math.max(d,3400),2);if(Math.abs(b)<.02&&d>2400)wt*=.35;// 원반 가운데 먼지띠
    const u=((Math.floor((l/Math.PI+1)/2*W)%W)+W)%W,v=Math.floor((.5-b/Math.PI)*H);if(v<0||v>=H)continue;
    const i=v*W+u;Ir[i]+=wt*p.c[0];Ig[i]+=wt*p.c[1];Ib[i]+=wt*p.c[2];}});
  const blur=(A)=>{const t=new Float32Array(N);for(let pass=0;pass<2;pass++){for(let v=0;v<H;v++){let acc=0;const o=v*W,r=2;for(let u=-r;u<=r;u++)acc+=A[o+((u+W)%W)];for(let u=0;u<W;u++){t[o+u]=acc/(2*r+1);acc+=A[o+((u+r+1)%W)]-A[o+((u-r+W)%W)];}}
    for(let u=0;u<W;u++){let acc=0;const r=2;for(let v=-r;v<=r;v++)acc+=t[Math.min(H-1,Math.max(0,v))*W+u];for(let v=0;v<H;v++){A[v*W+u]=acc/(2*r+1);acc+=t[Math.min(H-1,v+r+1)*W+u]-t[Math.max(0,v-r)*W+u];}}}};
  blur(Ir);blur(Ig);blur(Ib);blur(Ir);blur(Ig);blur(Ib);
  const L=new Float32Array(N);for(let i=0;i<N;i++)L[i]=(Ir[i]+Ig[i]+Ib[i])/3;
  const srt=Array.from(L.filter((v,i)=>i%7===0)).sort((a,b)=>a-b),ref=srt[Math.floor(srt.length*.997)]||1;
  const img=new Uint8ClampedArray(N*4),kk=60/ref,den=Math.log(1+kk*ref*1.1);
  for(let i=0;i<N;i++){const I=L[i];let t=I>0?Math.log(1+kk*I)/den:0;t=Math.min(1,t)*.95;const s=I>0?t*215/I:0;
   img[i*4]=Math.min(255,Ir[i]*s+6);img[i*4+1]=Math.min(255,Ig[i]*s+8);img[i*4+2]=Math.min(255,Ib[i]*s+18);img[i*4+3]=255;}
  // 가까운 별 (하늘 전체에 고르게) + 가까운 은하 입자
  const rs=rng(77);for(let i=0;i<2600;i++){const z=2*rs()-1,l=(rs()*2-1)*Math.PI;pts.push({l,b:Math.asin(z),m:Math.pow(rs(),3)*.9+.08,c:rs()<.3?[255,215,180]:rs()<.5?[200,215,255]:[245,245,255]});}
  return G._pano[k]={W,H,img,pts};};
 G.drawSky=function(C,l0,b0,fov,o){o=mk(o);const{x,w,h}=C,pn=G.pano(),W=pn.W,H=pn.H,img=pn.img;
  const D=Math.min(2,C.d),cw=Math.round(w*D),ch=Math.round(h*D),out=x.createImageData(cw,ch),od=out.data;
  const L=l0*Math.PI/180,B=b0*Math.PI/180,tf=Math.tan(fov*Math.PI/360);
  const F=[Math.cos(B)*Math.sin(L),Math.cos(B)*Math.cos(L),Math.sin(B)],Rt=[Math.cos(L),-Math.sin(L),0],U=[-Math.sin(B)*Math.sin(L),-Math.sin(B)*Math.cos(L),Math.cos(B)];
  for(let py=0;py<ch;py++){const sy=-(py-ch/2)/(cw/2)*tf;for(let px=0;px<cw;px++){const sx=(px-cw/2)/(cw/2)*tf;
   let rx=F[0]+sx*Rt[0]+sy*U[0],ry=F[1]+sx*Rt[1]+sy*U[1],rz=F[2]+sx*Rt[2]+sy*U[2];const n=Math.hypot(rx,ry,rz);rx/=n;ry/=n;rz/=n;
   const l=Math.atan2(rx,ry),b=Math.asin(rz);const fu=(l/Math.PI+1)/2*W,fv=(.5-b/Math.PI)*H;let u=Math.floor(fu)%W,v=Math.min(H-1,Math.max(0,Math.floor(fv)));
   const si=(v*W+u)*4,di=(py*cw+px)*4;od[di]=img[si];od[di+1]=img[si+1];od[di+2]=img[si+2];od[di+3]=255;}}
  const tmp=document.createElement('canvas');tmp.width=cw;tmp.height=ch;tmp.getContext('2d').putImageData(out,0,0);x.drawImage(tmp,0,0,w,h);
  // 점 별
  const proj=(l,b)=>{const v=[Math.cos(b)*Math.sin(l),Math.cos(b)*Math.cos(l),Math.sin(b)];const f=v[0]*F[0]+v[1]*F[1]+v[2]*F[2];if(f<=.05)return null;
   const sx=(v[0]*Rt[0]+v[1]*Rt[1]+v[2]*Rt[2])/f,sy=(v[0]*U[0]+v[1]*U[1]+v[2]*U[2])/f;return[w/2+sx/tf*w/2,h/2-sy/tf*w/2];};
  pn.pts.forEach(p=>{const q=proj(p.l,p.b);if(!q||q[0]<0||q[0]>w||q[1]<0||q[1]>h)return;const a=Math.min(1,p.m);x.fillStyle=`rgba(${p.c[0]},${p.c[1]},${p.c[2]},${.35+.65*a})`;const r=.5+a*1.3;x.beginPath();x.arc(q[0],q[1],r,0,7);x.fill();if(a>.75)glow(x,q[0],q[1],1.2,p.c.join(','),.35);});
  if(o.mark!==false){const q=proj(0,0);if(q&&q[0]>0&&q[0]<w&&q[1]>0&&q[1]<h&&G.sunR>0){x.strokeStyle='rgba(255,209,102,.9)';x.lineWidth=1.5;x.beginPath();x.arc(q[0],q[1],16,0,7);x.stroke();TS(x,'은하 중심 쪽',q[0],q[1]+30,'#ffd166',11,'center',700,o.fs);}}
  if(o.title)TS(x,o.title,12,16,'#e9edff',12,'left',900,o.fs);};
 G.setSun=function(r){G.sunR=r;};
 return G;}

/* =================================================================== 성단·성운 그림 */
const OBJ={open:{n:'산개 성단'},glob:{n:'구상 성단'},emis:{n:'방출 성운'},refl:{n:'반사 성운'},dark:{n:'암흑 성운'}};
function drawObject(C,kind,seed,o){o=o||{};const{x,w,h}=C,r=rng(seed||3),cx=w/2,cy=h/2,S=Math.min(w,h);
 x.fillStyle='#02040a';x.fillRect(0,0,w,h);
 const bgS=(n,a)=>{for(let i=0;i<n;i++){x.fillStyle=`rgba(210,220,255,${(r()*.5+.15)*(a||1)})`;const z=r()*1.1+.3;x.beginPath();x.arc(r()*w,r()*h,z,0,7);x.fill();}};
 const cloud=(col,alpha,scale,thr,shape)=>{const nz=noise2(seed*13+7),D=2,img=x.createImageData(Math.ceil(w*D/2),Math.ceil(h*D/2)),d=img.data,iw=img.width,ih=img.height;
  for(let j=0;j<ih;j++)for(let i=0;i<iw;i++){const u=i/iw,v=j/ih;let val=nz(u*scale+seed,v*scale,5);let m=shape(u,v);let a=Math.max(0,(val-thr)*m)*alpha*2.4;a=Math.min(1,a);const k=(j*iw+i)*4;d[k]=col[0];d[k+1]=col[1];d[k+2]=col[2];d[k+3]=a*255;}
  const t=document.createElement('canvas');t.width=iw;t.height=ih;t.getContext('2d').putImageData(img,0,0);x.save();x.imageSmoothingEnabled=true;x.globalCompositeOperation='lighter';x.drawImage(t,0,0,w,h);x.restore();};
 const blob=(u,v,cu,cv,rad)=>Math.max(0,1-Math.hypot(u-cu,v-cv)/rad);
 if(kind==='open'){bgS(70,.7);const n=22+Math.floor(r()*14);for(let i=0;i<n;i++){const X=cx+gauss(r)*S*.2,Y=cy+gauss(r)*S*.17,m=r();const col=m<.75?'170,200,255':m<.9?'235,240,255':'255,210,160';glow(x,X,Y,1+m*m*3.4,col,.9);}}
 else if(kind==='glob'){bgS(40,.6);const g=x.createRadialGradient(cx,cy,0,cx,cy,S*.32);g.addColorStop(0,'rgba(255,230,180,.85)');g.addColorStop(.3,'rgba(255,210,150,.35)');g.addColorStop(1,'rgba(255,190,130,0)');x.fillStyle=g;x.beginPath();x.arc(cx,cy,S*.32,0,7);x.fill();
  for(let i=0;i<2600;i++){const rr=Math.abs(gauss(r))*S*.13*(r()<.2?1.8:1),a=r()*7;const X=cx+rr*Math.cos(a),Y=cy+rr*Math.sin(a),m=r();x.fillStyle=m<.55?'rgba(255,215,150,.75)':m<.85?'rgba(255,175,120,.7)':'rgba(240,240,255,.7)';x.fillRect(X,Y,m*1.6+.6,m*1.6+.6);}}
 else if(kind==='emis'){bgS(90,.6);const sh=o.shape==='ring'?(u,v)=>{const d=Math.hypot(u-.5,v-.5);return Math.max(0,1-Math.abs(d-.3)/.13)*1.3;}:(u,v)=>blob(u,v,.5,.5,.55)*1.25;
  cloud([255,70,100],.95,4,.36,sh);cloud([255,150,120],.5,7,.45,sh);glow(x,cx+(r()-.5)*S*.1,cy+(r()-.5)*S*.1,2.4,'190,215,255');}
 else if(kind==='refl'){bgS(90,.6);const sx=cx+(r()-.5)*S*.12,sy=cy+(r()-.5)*S*.12;cloud([90,140,255],.85,4,.3,(u,v)=>blob(u,v,sx/w,sy/h,.5)*1.3);
  const g=x.createRadialGradient(sx,sy,0,sx,sy,S*.3);g.addColorStop(0,'rgba(140,180,255,.45)');g.addColorStop(1,'rgba(100,150,255,0)');x.fillStyle=g;x.beginPath();x.arc(sx,sy,S*.3,0,7);x.fill();glow(x,sx,sy,3.6,'220,235,255');}
 else if(kind==='dark'){if(o.shape==='horse'){cloud([255,70,110],.75,3,.25,(u,v)=>1);}
  for(let i=0;i<900;i++){x.fillStyle=`rgba(225,225,255,${r()*.6+.2})`;const z=r()*1.2+.3;x.beginPath();x.arc(r()*w,r()*h,z,0,7);x.fill();}
  const nz=noise2(seed*5+1),img=x.createImageData(Math.ceil(w/2),Math.ceil(h/2)),d=img.data,iw=img.width,ih=img.height;
  for(let j=0;j<ih;j++)for(let i=0;i<iw;i++){const u=i/iw,v=j/ih;let m=o.shape==='horse'?((v>.5?1:0)*1+blob(u,v,.55,.42,.16)*2.2+blob(u,v,.48,.3,.08)*2):blob(u,v,.5,.5,.42)*1.7;const val=nz(u*4,v*4,5);let a=Math.min(1,Math.max(0,(m*(.5+val))-.45)*2.2);const k=(j*iw+i)*4;d[k]=4;d[k+1]=4;d[k+2]=8;d[k+3]=a*255;}
  const t=document.createElement('canvas');t.width=iw;t.height=ih;t.getContext('2d').putImageData(img,0,0);x.drawImage(t,0,0,w,h);}
 if(o.label)TS(x,o.label,8,h-12,'#eef1ff',10,'left',700,o.fs||1.3);}

/* =================================================================== 풍선 모형 */
function Balloon(C,o){o=mk(o);const fs=o.fs,r=rng(5);
 // 처음(반지름 8 cm) 붙임딱지 위치 (cm, 풍선 중심 기준)
 const S=[{n:'1',x:-3.2,y:-.6},{n:'2',x:-3.2+2.5*Math.cos(-.55),y:-.6+2.5*Math.sin(-.55)},{n:'3',x:-3.2+5*Math.cos(.62),y:-.6+5*Math.sin(.62)}];
 for(let i=0;i<9;i++){let a,b;do{a=(r()*2-1)*6.2;b=(r()*2-1)*6.2;}while(Math.hypot(a,b)>6.4||S.some(s=>Math.hypot(s.x-a,s.y-b)<1.3));S.push({n:'',x:a,y:b});}
 const st={R:8,pair:null,pairs:[]};
 const k=()=>st.R/8;
 st.dist=(a,b)=>{const A=S.find(s=>s.n===a),B=S.find(s=>s.n===b);return Math.round(Math.hypot(A.x-B.x,A.y-B.y)*k()*10)/10;};
 st.draw=function(){const{x,w,h}=C,cx=w*.42,cy=h*.47,ppc=(h*.40)/16;// 16 cm까지
  x.fillStyle='#050913';x.fillRect(0,0,w,h);
  const R=st.R*ppc;const g=x.createRadialGradient(cx-R*.35,cy-R*.4,R*.1,cx,cy,R*1.05);g.addColorStop(0,'#ffb3c4');g.addColorStop(.55,'#ff5c86');g.addColorStop(1,'#a3264f');
  x.fillStyle=g;x.beginPath();x.ellipse(cx,cy,R,R*1.06,0,0,7);x.fill();
  x.fillStyle='#a3264f';x.beginPath();x.moveTo(cx-6,cy+R*1.06-2);x.lineTo(cx+6,cy+R*1.06-2);x.lineTo(cx+9,cy+R*1.06+10);x.lineTo(cx-9,cy+R*1.06+10);x.closePath();x.fill();
  x.strokeStyle='#ccc';x.lineWidth=1.5;x.beginPath();x.moveTo(cx,cy+R*1.06+10);x.quadraticCurveTo(cx+18,cy+R*1.06+40,cx-6,h-6);x.stroke();
  const P=s=>[cx+s.x*k()*ppc,cy-s.y*k()*ppc];
  S.forEach(s=>{const[X,Y]=P(s);const sz=s.n?11:8;x.fillStyle=s.n?'#fff6cf':'#ffe9a8';x.strokeStyle='#5b4a00';x.lineWidth=1;x.beginPath();x.arc(X,Y,sz,0,7);x.fill();x.stroke();if(s.n)T(x,s.n,X,Y+1,'#1a1300',12,'center',900,fs);else{x.fillStyle='#d7a21a';x.beginPath();x.arc(X,Y,2.5,0,7);x.fill();}});
  st.pairs.forEach(([a,b],i)=>{const A=P(S.find(s=>s.n===a)),B=P(S.find(s=>s.n===b));const ang=Math.atan2(B[1]-A[1],B[0]-A[0]),len=Math.hypot(B[0]-A[0],B[1]-A[1]);
   x.save();x.translate(A[0],A[1]);x.rotate(ang);x.fillStyle='rgba(255,209,102,.92)';x.fillRect(0,-7,len,14);x.strokeStyle='#5b4a00';const cm=ppc*k();// 1 cm 눈금
   for(let t=0;t<=len+.5;t+=ppc*k()>18?cm/2:cm){x.beginPath();x.moveTo(t,-7);x.lineTo(t,-1);x.stroke();}x.restore();
   const nx=-Math.sin(ang),ny=Math.cos(ang),mx=(A[0]+B[0])/2+nx*24,my=(A[1]+B[1])/2+ny*24+11;const lab=a+'~'+b+' : '+st.dist(a,b).toFixed(1)+' cm';x.font=`900 ${Math.round(12*fs)}px ${FONT}`;const tw=x.measureText(lab).width;
   x.fillStyle='rgba(5,9,19,.88)';x.fillRect(mx-tw/2-6,my-30-i*0,tw+12,22);T(x,lab,mx,my-19,'#ffd166',12,'center',900,fs);});
  // 크기 표시
  const bx=w*.83;T(x,'풍선 크기',bx,22,'#9ba6d4',11,'center',700,fs);x.strokeStyle='#2a3666';x.lineWidth=10;x.lineCap='round';x.beginPath();x.moveTo(bx,44);x.lineTo(bx,h-40);x.stroke();
  const f=(st.R-8)/8;x.strokeStyle='#ff7a90';x.beginPath();x.moveTo(bx,h-40);x.lineTo(bx,h-40-(h-84)*f);x.stroke();x.lineCap='butt';x.lineWidth=1;T(x,(st.R/8).toFixed(2).replace(/\.?0+$/,'')+'배',bx,h-20,'#ff7a90',13,'center',900,fs);};
 st.setR=v=>{st.R=v;st.draw();};
 st.measure=(a,b)=>{const key=a+b;if(!st.pairs.some(p=>p[0]+p[1]===key))st.pairs.push([a,b]);st.draw();return st.dist(a,b);};
 st.clear=()=>{st.pairs=[];st.draw();};
 st.draw();return st;}

/* =================================================================== 우주 팽창 모형 */
function Expansion(C,o){o=mk(o);const fs=o.fs,r=rng(o.seed||21);
 const G=[];const NAMES='ABCDEFGH';let ni=0;
 for(let i=-4;i<=4;i++)for(let j=-3;j<=3;j++){const gx=i*1.25+(r()-.5)*.8,gy=j*1.25+(r()-.5)*.8;G.push({x:gx,y:gy,t:r()<.6?'s':'e',a:r()*6.28,s:.75+r()*.5,n:''});}
 // 우리은하(가운데 근처) + 측정용 은하 A~C
 G.sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y));G[0].n='우리은하';G[0].me=true;
 const pickN=(d)=>{let best=null;G.forEach(g=>{if(g.n)return;const dd=Math.hypot(g.x-G[0].x,g.y-G[0].y);if(!best||Math.abs(dd-d)<Math.abs(best.dd-d))best={g,dd};});return best.g;};
 [1.3,2.6,3.9].forEach((d,i)=>{const g=pickN(d);g.n=NAMES[i];});
 const st={a:1,a0:1,ref:G[0],ghost:false,lines:true,unit:40};
 const dist=(g,a)=>Math.round(Math.hypot(g.x-st.ref.x,g.y-st.ref.y)*a*10)/10;// 칸 수 (1칸 = 격자 한 칸)
 st.d=(n,a)=>{const g=G.find(z=>z.n===n);return g?dist(g,a==null?st.a:a):NaN;};
 st.draw=function(){const{x,w,h}=C,cx=w/2,cy=h/2,cell=h/8.5,sc=cell*1.0;
  x.fillStyle='#03050d';x.fillRect(0,0,w,h);
  // 고정된 자(눈금 격자) — 공간은 늘어나도 자는 그대로
  x.strokeStyle='rgba(106,209,255,.12)';x.lineWidth=1;for(let X=cx%cell;X<w;X+=cell){x.beginPath();x.moveTo(X,0);x.lineTo(X,h);x.stroke();}for(let Y=cy%cell;Y<h;Y+=cell){x.beginPath();x.moveTo(0,Y);x.lineTo(w,Y);x.stroke();}
  const pos=(g,a)=>[cx+(g.x-st.ref.x)*a*sc,cy-(g.y-st.ref.y)*a*sc];
  if(st.ghost&&st.a!==st.a0){G.forEach(g=>{const[X,Y]=pos(g,st.a0),[X2,Y2]=pos(g,st.a);if(g===st.ref)return;x.fillStyle='rgba(155,166,212,.35)';x.beginPath();x.arc(X,Y,3,0,7);x.fill();if(Math.hypot(X2-X,Y2-Y)>6)arrow(x,X,Y,X2,Y2,'rgba(255,209,102,.55)',1.5,7);});}
  if(st.lines)G.forEach(g=>{if(!g.n||g===st.ref)return;const[X,Y]=pos(g,st.a);x.setLineDash([5,5]);x.strokeStyle='rgba(255,209,102,.55)';x.beginPath();x.moveTo(cx,cy);x.lineTo(X,Y);x.stroke();x.setLineDash([]);
   const lab=dist(g,st.a).toFixed(1)+'칸';TS(x,lab,(cx+X)/2,(cy+Y)/2-10,'#ffd166',11,'center',900,fs);});
  const gs=Math.max(.35,Math.min(1,st.a));
  G.forEach(g=>{const[X,Y]=pos(g,st.a);if(X<-20||X>w+20||Y<-20||Y>h+20)return;const z=(g===st.ref?9:7)*g.s*gs;
   x.save();x.translate(X,Y);x.rotate(g.a);if(g.t==='s'){const gr=x.createRadialGradient(0,0,0,0,0,z*1.8);gr.addColorStop(0,'rgba(255,240,210,.95)');gr.addColorStop(.35,'rgba(200,215,255,.55)');gr.addColorStop(1,'rgba(150,170,255,0)');x.fillStyle=gr;x.scale(1,.55);x.beginPath();x.arc(0,0,z*1.8,0,7);x.fill();}
   else{const gr=x.createRadialGradient(0,0,0,0,0,z*1.5);gr.addColorStop(0,'rgba(255,225,180,.95)');gr.addColorStop(1,'rgba(255,200,150,0)');x.fillStyle=gr;x.scale(1,.75);x.beginPath();x.arc(0,0,z*1.5,0,7);x.fill();}x.restore();
   if(g===st.ref){x.strokeStyle='#ffd166';x.lineWidth=2;x.beginPath();x.arc(X,Y,z+8,0,7);x.stroke();x.lineWidth=1;}
   if(g.n)TS(x,g.n,X,Y+z+12,g===st.ref?'#ffd166':'#eef1ff',11,'center',900,fs);});
  T(x,'기준(나): '+(st.ref.n||'?'),10,16,'#ffd166',11,'left',900,fs);
  if(st.a<.2){const al=(.2-st.a)/.15;const g=x.createRadialGradient(cx,cy,0,cx,cy,60);g.addColorStop(0,`rgba(255,250,230,${Math.min(1,al)})`);g.addColorStop(1,'rgba(255,200,150,0)');x.fillStyle=g;x.beginPath();x.arc(cx,cy,60,0,7);x.fill();}};
 st.setA=v=>{st.a=v;st.draw();};
 st.setRef=n=>{const g=G.find(z=>z.n===n);if(g)st.ref=g;st.draw();};
 st.names=()=>G.filter(g=>g.n).map(g=>g.n);
 C.c.addEventListener('click',e=>{const b=C.c.getBoundingClientRect(),mx=(e.clientX-b.left)/b.width*C.w,my=(e.clientY-b.top)/b.height*C.h,cx=C.w/2,cy=C.h/2,sc=C.h/8.5;let best=null;
  G.forEach(g=>{if(!g.n)return;const X=cx+(g.x-st.ref.x)*st.a*sc,Y=cy-(g.y-st.ref.y)*st.a*sc,d=Math.hypot(X-mx,Y-my);if(d<26&&(!best||d<best.d))best={g,d};});if(best){st.ref=best.g;st.draw();if(o.onref)o.onref(best.g.n);}});
 st.draw();return st;}

/* =================================================================== 6차시 자료 (우주 기술 · 탐사 연표 · 목적지) */
const SPACE={
TK:[['🛰️','내비게이션 (위치 확인)',1,'인공위성을 이용한 위성 항법 시스템(GPS)으로 실시간 위치를 확인'],['⛑️','안전모',1,'열에 강하고 단단한 폴리카보네이트 — 우주 탐사 장비 소재'],['👕','기능성 운동복',1,'우주복 용도로 개발된 신소재가 기능성 옷감에 이용'],
  ['✏️','연필',0,'16세기 무렵부터 쓰인 필기도구 — 우주 탐사와 관계없음'],['🍲','전자레인지',1,'우주 비행선에서 음식을 조리하는 데 쓰이며 발전, 일상에 널리 쓰임 (교과서 301쪽)'],['🏥','자기 공명 영상(MRI)',1,'우주선의 영상 처리 기술에서 착안해 질병 진단에 이용'],
  ['👓','안경테 · 치아 교정기',1,'우주선 안테나용으로 개발된 형상 기억 합금'],['☂️','우산',0,'아주 오래전부터 쓰인 도구 — 우주 탐사와 관계없음'],['🚰','정수기',1,'우주선에서 오염된 물을 깨끗하게 만드는 장비 기술을 활용'],
  ['☀️','태양 전지',1,'우주에서 전기 에너지를 얻기 위해 쓰이며 크게 발전한 장치'],['🚲','자전거',0,'19세기에 발명된 탈것 — 우주 탐사와 관계없음'],['📡','위성 방송 · 일기 예보',1,'방송 통신 위성, 기상 위성 등 인공위성 이용']],
TL:[[1957,'스푸트니크 1호','로켓·인공위성','소련','인류 최초의 인공위성. 우주 탐사 시대를 열었음.','오늘날 통신·방송·기상·항법(GPS) 위성으로 이어짐'],
  [1969,'아폴로 11호','탐사선','미국','인류가 처음으로 달에 착륙함.','달 암석 표본으로 달의 기원 연구 · 탐사 과정의 기술이 산업으로 확산'],
  [1974,'매리너 10호','탐사선','미국','금성을 지나 수성에 근접하여 수성 표면을 처음으로 자세히 촬영.','태양에 가까운 행성의 환경 이해'],
  [1976,'바이킹 1호','탐사선','미국','화성 표면에 착륙하여 사진을 보내고 토양을 조사.','화성 환경과 생명체 가능성 연구의 출발점'],
  [1977,'보이저 1호','탐사선','미국','목성과 토성을 근접 탐사. 지금은 태양계 밖 성간 공간을 비행 중이며 ‘골든 레코드’를 싣고 있음.','가장 멀리 간 인공 물체 · 외행성에 대한 이해 확대'],
  [1990,'허블 우주 망원경','우주 망원경·정거장','미국·유럽','대기권 밖에서 별, 성단과 성운, 외부 은하 등을 선명하게 관측.','우주 팽창 등 우주에 대한 이해를 크게 넓힘'],
  [1992,'우리별 1호','우리나라','우리나라','우리나라 최초의 인공위성(과학 위성).','우리나라 위성 기술의 출발점'],
  [1997,'카시니호','탐사선','미국·유럽','1997년 발사. 13년 동안 토성을 탐사하고 2017년 토성 대기권으로 들어가 임무를 마침.','토성과 고리, 위성(타이탄·엔셀라두스) 이해'],
  [1998,'국제 우주 정거장(ISS)','우주 망원경·정거장','여러 나라','1998년부터 조립. 여러 나라가 협력하여 우주 탐사, 과학 연구, 기술 개발을 함.','국가 간 협력 · 우주 환경에서의 생활과 실험'],
  [2013,'나로호','우리나라','우리나라','우리나라 최초의 우주 발사체 (2013년 3차 발사 성공).','우주 발사체 기술 확보의 발판'],
  [2014,'필레','탐사 로봇','유럽','최초로 혜성에 착륙한 탐사 로봇. 수십억 년 된 얼음과 먼지에 대한 정보를 지구로 보냄.','태양계 초기 물질 연구'],
  [2015,'뉴호라이즌스호','탐사선','미국','2006년 발사. 2015년 명왕성을 처음으로 가까이에서 촬영.','태양계 끝 천체의 모습 확인'],
  [2021,'퍼서비어런스','탐사 로봇','미국','화성에 착륙하여 암석과 토양을 조사하고 샘플을 채취.','화성의 과거 환경과 생명체 흔적 연구'],
  [2021,'누리호','우리나라','우리나라','우리 기술로 만든 한국형 우주 발사체. 2021년 첫 발사, 2022년 2차 발사에서 위성을 궤도에 올림.','스스로 위성을 쏘아 올릴 수 있는 나라가 됨'],
  [2021,'제임스 웹 우주 망원경','우주 망원경·정거장','미국·유럽·캐나다','적외선으로 허블보다 더 멀리 있는 천체를 관측.','초기 우주와 별·행성의 탄생 연구'],
  [2022,'다누리호','우리나라','우리나라','2022년 8월 발사, 12월 달 궤도 진입. 우리나라가 세계 7번째 달 탐사국이 됨.','달 표면 촬영 · 달 자원과 착륙 후보지 조사'],
  [2032,'달 착륙선 (계획)','우리나라','우리나라','2032년을 목표로 우리나라 달 착륙선을 보낼 계획.','우주 탐사 확대']],
DS:[['🌕','달','약 38만 km','약 3일','약 1.3초','지구의 약 1/6','약 −170 ~ 120 ℃','거의 없음','남극의 영구 그늘 지역에 얼음이 있을 가능성 · 낮과 밤이 각각 약 2주'],
  ['🔴','화성','약 5600만 ~ 4억 km','약 7개월','약 3 ~ 22분','지구의 약 0.38배','평균 약 −60 ℃','아주 옅은 이산화 탄소','극지방의 얼음 · 큰 모래 폭풍 · 하루 길이가 지구와 비슷'],
  ['🧊','유로파 (목성의 위성)','약 6억 ~ 10억 km','약 5 ~ 6년','약 33 ~ 54분','지구의 약 0.13배','약 −160 ℃ 이하','거의 없음','얼음 표면 아래에 바다가 있을 것으로 예상 · 목성의 강한 방사선'],
  ['🟠','타이탄 (토성의 위성)','약 12억 ~ 16억 km','약 7년','약 1시간 10분 ~ 1시간 30분','지구의 약 0.14배','약 −180 ℃','짙은 질소 대기','메테인 호수와 비 · 두꺼운 대기 덕분에 비행 탐사 가능'],
  ['🛰️','국제 우주 정거장','지상 약 400 km','약 3시간 ~ 2일','거의 없음','미세 중력 (둥둥 뜸)','햇빛 쪽 매우 뜨겁고 그늘 쪽 매우 차가움','없음 (정거장 안은 공기 공급)','약 90분마다 지구를 한 바퀴 · 우주 환경 실험']]};

window.U2={night,mLabel,rng,gauss,setup,Galaxy,drawObject,OBJ,Balloon,Expansion,SPACE,glow,arrow,T,TS};
})();

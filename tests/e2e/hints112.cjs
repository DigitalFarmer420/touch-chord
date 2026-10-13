const APPV=require('fs').readFileSync(require('path').resolve(__dirname,'../../js/version.js'),'utf8').match(/APP_VERSION = "([^"]+)"/)[1];   // CI: version from js/version.js
// v112 Play along hints: every trigger (a b c d e), the 2 s pill, 1 per 4 s, no repeat until an advance, e once per song,
// never during Play / with Play along off / with Show hints off (saved, default on), taps still sound, Kids grayed key = d.
const { chromium } = require('playwright-core');const fs=require('fs');
const U=(process.env.BASE||'http://localhost:8080/index.html');const J=JSON.stringify;const [W,H]=(process.argv[2]||'360x780').split('x').map(Number);
const T={a:"Try the marked key next",b:"Tap the dot chord next",c:"Let go of the chord button to follow the song",d:"Tap the dot chord next",e:"Lost? Tap Next to hear the next chord",ek:"Tap the dot chord next"};
const R={size:W+'x'+H,fails:[],count:{},seen:[]};const F=(c,m)=>{R.count[c?'ok':'FAIL']=(R.count[c?'ok':'FAIL']||0)+1;if(!c)R.fails.push(m)};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined,args:['--autoplay-policy=no-user-gesture-required']});
 const mk=async(style,extra)=>{const ctx=await b.newContext({viewport:{width:W,height:H},hasTouch:true,isMobile:true});const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(''+e));
  await p.goto(U+'?test=1');await p.evaluate(([st,ex])=>localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:Object.assign({simple:false,style:st,layout:'octave'},ex||{})})),[style,extra]);await p.reload();await p.waitForTimeout(1200);
  p.cdp=await ctx.newCDPSession(p);p.ctx=ctx;return p;};
 const now=p=>p.evaluate(()=>ChordAudio.ctx?ChordAudio.ctx.currentTime:0);
 const hint=p=>p.evaluate(()=>{const e=document.getElementById('paHint'),q=e.getBoundingClientRect(),k=document.getElementById('pads').getBoundingClientRect();return {vis:!e.hidden&&e.classList.contains('on'),text:e.textContent,n:__paHint.shown.length,last:__paHint.shown[__paHint.shown.length-1]||null,top:q.top,bottom:q.bottom,left:q.left,right:q.right,kbTop:k.top,kbH:k.height,W:innerWidth}});
 const sounded=(p,t0)=>p.evaluate(t0=>(ChordAudio.voices||[]).filter(v=>v.startTime!=null&&v.startTime>=t0-0.005).length,t0);
 const touchAt=async(p,pt,hold=90)=>{await p.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pt.x,y:pt.y}]});await p.waitForTimeout(hold);await p.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(80);};
 const keyPt=(p,pred)=>p.evaluate(pred=>{const f=new Function('e','return '+pred);const k=[...document.querySelectorAll('#pads .pad')].find(f);if(!k)return null;const q=k.getBoundingClientRect();const bl=!!k.closest('.blacks');return {x:q.x+q.width/2,y:q.y+q.height*(bl?0.5:0.88),m:+k.dataset.midi}},pred);
 const elPt=(p,sel)=>p.evaluate(sel=>{const e=typeof sel==='string'?document.querySelector(sel):null;if(!e)return null;const q=e.getBoundingClientRect();return {x:q.x+q.width/2,y:q.y+q.height/2}},sel);
 const chipPt=(p,marked)=>p.evaluate(marked=>{const c=window.__nx&&__nx();const els=[...document.querySelectorAll('#suggest .ss-chip')].filter(e=>e.getBoundingClientRect().width>0&&!e.classList.contains('ss-kidpad')&&!e.classList.contains('borrowed'));
  const e=els.find(e=>marked?(c&&e===c.el):(!(c&&e===c.el)&&!e.classList.contains('nxdot')));if(!e)return null;const q=e.getBoundingClientRect();return {x:q.x+q.width/2,y:q.y+q.height/2}},marked);
 const nonRoot="e.dataset.midi&&!e.classList.contains('nx-root')&&!e.classList.contains('nokey')&&((+e.dataset.midi)%12)!==((window.__nx&&__nx()?__nx().item.rootPc:-1)%12)";
 const root="e.classList.contains('nx-root')";
 const overlap=p=>p.evaluate(()=>{const e=document.getElementById('paHint');if(e.hidden)return [];const q=e.getBoundingClientRect();return [...document.querySelectorAll('#pads .pad, #suggest button, #suggest .ss-chip, #suggest .ss-note, #suggest .ss-kidpad, #palette button, button, input, select, [role=button], #styles, .now-card, #symbol, #tones, #nowMix')].filter(b=>!b.closest('#paHint, #tour')).map(b=>[b,b.getBoundingClientRect()]).concat([...document.querySelectorAll('#kidsLyr .sb-row')].flatMap(r=>{const g=document.createRange();g.selectNodeContents(r);return [...g.getClientRects()].map(q=>[r,q])})).filter(([b,r])=>r.width>0&&r.height>0&&q.left<r.right&&q.right>r.left&&q.top<r.bottom&&q.bottom>r.top).map(([b])=>(b.textContent||'').trim().slice(0,8)+'.'+b.className.split(' ')[0])});
 const topChk=p=>p.evaluate(()=>{const e=document.getElementById('paHint');if(e.hidden)return true;const q=e.getBoundingClientRect();return q.top<=innerHeight*0.45&&q.top>=0;});
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 // ---------- outside Kids (Pop, C, Full mode, Octave keys) ----------
 {const p=await mk('pop');await p.evaluate(()=>{__applySongKey('C','major');__progApi.set(0)});await p.waitForTimeout(200);await p.tap('#prog .pg-step');await p.waitForTimeout(400);
  // a: non-root key -> pill, text, above the keyboard, the marked key pulses, the tap sounds; hides at 2 s
  let t0=await now(p);let pt=await keyPt(p,nonRoot);await touchAt(p,pt);let h=await hint(p);const burst=await p.evaluate(()=>{const k=document.querySelector('#pads .pad.nx-root');return k&&k.classList.contains('nxb')});
  F(h.vis&&h.text===T.a,`a: ${J(h)}`);F(h.left>=0&&h.right<=h.W&&h.top>=0&&h.bottom<=H,`a: pill off screen ${J(h)}`);F(!(await overlap(p)).length,`a: pill overlaps ${J(await overlap(p))}`);F(await topChk(p),'not in the top region: '+`a: pill overlaps ${J(await overlap(p))}`);F(burst,'a: marked key did not pulse');F(await sounded(p,t0)>0,'a: tap silent');R.seen.push('a');
  await p.screenshot({path:`${process.env.SHOTS||'/tmp/tc-shots'}/hint-a-${W}x${H}.png`});
  await p.waitForTimeout(1500);F((await hint(p)).vis,'a: gone before 2 s');await p.waitForTimeout(700);F(!(await hint(p)).vis,'a: still up after 2.2 s');
  // rate: a chip miss (b) right after -> skipped (rate); misses so far 2
  t0=await now(p);pt=await chipPt(p,false);await touchAt(p,pt);h=await hint(p);F(!h.vis&&h.n===1,`rate: b shown within 4 s ${J(h)}`);F(await sounded(p,t0)>0,'b: chip silent');
  F(await p.evaluate(()=>__paHint.skipped.slice(-1)[0].why)==='rate','rate: not logged as rate');
  // 3rd miss at > 4 s -> e (Lost?) once per song
  await wait(2700);pt=await keyPt(p,nonRoot);await touchAt(p,pt);h=await hint(p);F(h.vis&&h.text===T.e,`e: 3rd miss ${J(h)}`);R.seen.push('e');
  // b after another 4 s (4th miss: not e again)
  await wait(4100);pt=await chipPt(p,false);await touchAt(p,pt);h=await hint(p);F(h.vis&&h.text===T.b&&h.last.id==='b',`b: ${J(h)}`);R.seen.push('b');
  // repeat: a again (> 4 s) -> not shown (no advance since)
  await wait(4100);pt=await keyPt(p,nonRoot);await touchAt(p,pt);h=await hint(p);F(!h.vis,`repeat: a shown twice without an advance ${J(h)}`);F(await p.evaluate(()=>__paHint.skipped.slice(-1)[0].why)==='repeat','repeat: not logged');
  // advance with the root key -> no hint, then (> 4 s) a again shows
  const n0=(await hint(p)).n;pt=await keyPt(p,root);const adv0=await p.evaluate(()=>__playAlong.taps.length);await touchAt(p,pt);F(await p.evaluate(a=>__playAlong.taps.length-a,adv0)===1,'advance: root key did not advance');F((await hint(p)).n===n0,'advance: a hint on an advance');
  await wait(4100);pt=await keyPt(p,nonRoot);await touchAt(p,pt);h=await hint(p);F(h.vis&&h.text===T.a,`a after advance: ${J(h)}`);
  // e once per song: 3 more misses spaced > 4 s after an advance -> no e; a new song -> e again
  pt=await keyPt(p,root);await touchAt(p,pt);await wait(4100);
  for(let i=0;i<3;i++){pt=await chipPt(p,false);await touchAt(p,pt);await wait(i<2?150:0);}h=await hint(p);F(h.text!==T.e||!h.vis,'e twice in one song');
  await p.evaluate(()=>__progApi.set(1));await p.waitForTimeout(200);await p.tap('#prog .pg-step');await p.waitForTimeout(300);await wait(4100);
  pt=await keyPt(p,nonRoot);await touchAt(p,pt);await wait(4100);pt=await chipPt(p,false);await touchAt(p,pt);await wait(4100);pt=await keyPt(p,nonRoot);await touchAt(p,pt);
  h=await hint(p);F(h.vis&&h.text===T.e,`e on a new song (3rd miss, each > 4 s apart): ${J(h)}`);
  pt=await keyPt(p,root);await touchAt(p,pt);   // an advance ends the miss run
  // c: hold a chord-table button, tap a key -> c; the key still sounds (the held chord)
  await wait(4100);const pb=await elPt(p,'#palette button');pt=await keyPt(p,root);t0=await now(p);
  await p.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pb.x,y:pb.y,id:1}]});await p.waitForTimeout(120);
  await p.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pb.x,y:pb.y,id:1},{x:pt.x,y:pt.y,id:2}]});await p.waitForTimeout(120);h=await hint(p);
  await p.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(150);
  F(h.vis&&h.text===T.c,`c: ${J(h)}`);F(await sounded(p,t0)>0,'c: silent');R.seen.push('c');
  // never during Play: Play song, then key + chip taps -> no hint, no miss; pill hidden when Play starts
  await wait(4100);const m0=await p.evaluate(()=>__paHint.misses);await p.tap('#prog .pg-song');await p.waitForTimeout(400);
  for(let i=0;i<3;i++){pt=await keyPt(p,"e.dataset.midi&&!e.classList.contains('nokey')");await touchAt(p,pt);}pt=await chipPt(p,false);if(pt)await touchAt(p,pt);
  h=await hint(p);F(!h.vis&&(await p.evaluate(()=>__paHint.misses))===m0,`during Play: ${J(h)}`);await p.tap('#prog .pg-song');await p.waitForTimeout(300);
  // Play along off -> none; Show hints off -> none (and saved)
  await p.evaluate(()=>document.getElementById('playAlongBtn').click());await wait(4100);pt=await keyPt(p,nonRoot);t0=await now(p);await touchAt(p,pt);h=await hint(p);F(!h.vis,'Play along off: hint');F(await sounded(p,t0)>0,'PA off: silent');
  await p.evaluate(()=>document.getElementById('playAlongBtn').click());
  await p.evaluate(()=>document.getElementById('paHintsBtn').click());await p.tap('#prog .pg-step');await p.waitForTimeout(300);await wait(4100);
  pt=await keyPt(p,nonRoot);await touchAt(p,pt);pt=await chipPt(p,false);await touchAt(p,pt);h=await hint(p);F(!h.vis,'Show hints off: hint');
  await p.waitForTimeout(500);await p.reload();await p.waitForTimeout(1200);F(await p.evaluate(()=>document.getElementById('paHintsBtn').getAttribute('aria-checked'))==='false','Show hints off not saved');
  F(!p.errs.length,'errs '+J(p.errs));await p.ctx.close();}
 // Show hints default on (fresh), placed under Play along in Config
 {const ctx=await b.newContext({viewport:{width:W,height:H},hasTouch:true,isMobile:true});const p=await ctx.newPage();await p.goto(U+'?test=1');await p.waitForTimeout(1000);
  const r=await p.evaluate(()=>{document.getElementById('configBtn').click();const a=document.getElementById('playAlongBtn').getBoundingClientRect(),h=document.getElementById('paHintsBtn');const q=h.getBoundingClientRect();return {on:h.getAttribute('aria-checked'),below:q.top>=a.bottom-1,vis:q.width>0&&q.bottom<=innerHeight}});
  F(r.on==='true'&&r.below&&r.vis,`Show hints default/position ${J(r)}`);if(W===360)await p.screenshot({path:`${process.env.SHOTS||'/tmp/tc-shots'}/config-showhints-${W}x${H}.png`});await ctx.close();}
 // Simple mode: chip miss -> b
 {const p=await mk('pop',{simple:true});await p.evaluate(()=>{__applySongKey('C','major');__progApi.set(0)});await p.waitForTimeout(200);await p.tap('#prog .pg-step');await p.waitForTimeout(400);
  const pt=await chipPt(p,false);if(pt){await touchAt(p,pt);const h=await hint(p);F(h.vis&&h.text===T.b,`Simple b: ${J(h)}`);}else F(0,'Simple: no chip');await p.ctx.close();}
 // ---------- Kids ----------
 {const p=await mk('kids');await p.evaluate(()=>{__applySongKey('C','major');__progApi.set(0)});await p.waitForTimeout(300);
  // d: non-gold pad (sounds)
  let pt=await p.evaluate(()=>{const e=[...document.querySelectorAll('#suggest .ss-kidpad')].find(e=>!e.classList.contains('nx-root'));const q=e.getBoundingClientRect();return {x:q.x+q.width/2,y:q.y+q.height/2}});
  let t0=await now(p);await touchAt(p,pt);let h=await hint(p);F(h.vis&&h.text===T.d&&h.last.id==='d',`Kids d pad: ${J(h)}`);F(await sounded(p,t0)>0,'Kids d pad silent');R.seen.push('d');
  await p.screenshot({path:`${process.env.SHOTS||'/tmp/tc-shots'}/hint-d-kids-${W}x${H}.png`});
  // advance with the gold pad, then a GRAYED key (inert, v111 K) counts as a miss -> d, and stays silent
  pt=await elPt(p,'#suggest .ss-kidpad.nx-root');await touchAt(p,pt);await wait(4100);
  pt=await keyPt(p,"e.classList.contains('nokey')");t0=await now(p);await touchAt(p,pt);h=await hint(p);F(h.vis&&h.text===T.d,`Kids grayed key: ${J(h)}`);F(await sounded(p,t0)===0,'grayed key sounded');
  // non-gold in-key key: miss 2 (repeat d blocked), miss 3 at > 4 s -> ek
  pt=await keyPt(p,"!e.classList.contains('nokey')&&!e.classList.contains('nx-root')&&((+e.dataset.midi)%12)!==((+document.querySelector('#pads .pad.nx-root').dataset.midi)%12)");await touchAt(p,pt);
  await wait(4100);await touchAt(p,pt);h=await hint(p);F(h.vis&&h.text===T.ek&&h.last.id==='ek',`Kids e: ${J(h)}`);R.seen.push('ek');
  // gold key tap = advance, no hint
  const n0=(await hint(p)).n;await wait(4100);pt=await keyPt(p,root);await touchAt(p,pt);F((await hint(p)).n===n0,'Kids gold key gave a hint');
  // Kids during Play: none
  await p.tap('#prog .pg-song');await p.waitForTimeout(400);pt=await p.evaluate(()=>{const e=[...document.querySelectorAll('#suggest .ss-kidpad')][3];const q=e.getBoundingClientRect();return {x:q.x+q.width/2,y:q.y+q.height/2}});await touchAt(p,pt);F(!(await hint(p)).vis,'Kids hint during Play');
  await p.tap('#prog .pg-song');F(!p.errs.length,'errs '+J(p.errs));await p.ctx.close();}
 await b.close();fs.writeFileSync((process.env.OUT||__dirname)+`/hints112-${W}x${H}.json`,J(R,null,1));console.log(J({size:R.size,count:R.count,seen:R.seen,fails:R.fails.slice(0,15)}));})().catch(e=>{console.error(e);process.exit(1)});

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
 const T2={k:"That note isn't in this song's key",kc:"That chord isn't in this song's key"};const SH=(process.env.SHOTS||'/tmp/tc-shots')+'/'+(process.env.TAG||'after')+'-';
 const shot=async(p,n)=>{await p.screenshot({path:SH+n+`-${W}x${H}.png`});};
 const setup=async(p)=>{await p.evaluate(()=>{__applySongKey('C','major');__progApi.set(0)});await p.waitForTimeout(200);await p.tap('#prog .pg-step');await p.waitForTimeout(400);};
 // M1: Pop, C, Full Range off, tap C# -> plain out-of-key text; no overlap
 {const p=await mk('pop');await setup(p);
  const ak=await p.evaluate(()=>document.getElementById('allKeys').classList.contains('on'));F(!ak,'M1: Full Range is on');
  let pt=await keyPt(p,"(+e.dataset.midi)%12===1");await touchAt(p,pt);let h=await hint(p);
  F(h.vis&&h.text===T2.k,`M1 key C#: ${J(h)}`);F(T2.k.split(' ').length<=7,'M1 >7 words');F(!(await overlap(p)).length,`M1 overlap ${J(await overlap(p))}`);F(await topChk(p),'not in the top region: '+`M1 overlap ${J(await overlap(p))}`);await shot(p,'m1-pop-csharp');
  // borrowed chip -> chord text (> 4 s later)
  await wait(4100);pt=await p.evaluate(()=>{const e=[...document.querySelectorAll('#suggest .ss-chip.borrowed')].find(e=>e.getBoundingClientRect().width>0);if(!e)return null;const q=e.getBoundingClientRect();return {x:q.x+q.width/2,y:q.y+q.height/2}});
  if(pt){await touchAt(p,pt);h=await hint(p);F(h.vis&&h.text===T2.kc,`M1 chip: ${J(h)}`);F(!(await overlap(p)).length,`M1 chip overlap ${J(await overlap(p))}`);F(await topChk(p),'not in the top region: '+`M1 chip overlap ${J(await overlap(p))}`);}else F(false,'M1: no borrowed chip');
  // a still used for an in-key non-root key (after an advance ends the miss run)
  pt=await keyPt(p,root);await touchAt(p,pt);await wait(4100);pt=await keyPt(p,nonRoot);await touchAt(p,pt);h=await hint(p);F(h.vis&&h.text===T.a,`M1: a for in-key key ${J(h)}`);F(!(await overlap(p)).length,`a overlap ${J(await overlap(p))}`);F(await topChk(p),'not in the top region: '+`a overlap ${J(await overlap(p))}`);await shot(p,'a-pop');
  F(!p.errs.length,'errs '+p.errs);await p.ctx.close();}
 // L2: 2 misses (no Lost yet), then a style change / a song change: the first miss there is not "Lost?"
 for(const how of ['style','song']){const p=await mk('pop');await setup(p);
  let pt=await keyPt(p,nonRoot);await touchAt(p,pt);await wait(4100);pt=await chipPt(p,false);await touchAt(p,pt);let h=await hint(p);F(h.vis&&h.text!==T.e,`L2 ${how}: setup ${J(h)}`);
  if(how==='style')await p.tap('#styles button[data-style="jazz"]');else await p.tap('#prog .pg-next');await p.waitForTimeout(500);await wait(4100);
  pt=await keyPt(p,nonRoot);await touchAt(p,pt);h=await hint(p);F(h.vis&&h.text!==T.e,`L2 ${how} change: first miss shows ${J(h)}`);
  F(!p.errs.length,'errs '+p.errs);await p.ctx.close();}
 // M2: Kids non-gold pad and key -> no overlap with pads or keys
 {const p=await mk('kids');await p.waitForTimeout(300);
  let pt=await p.evaluate(()=>{const e=[...document.querySelectorAll('#suggest .ss-kidpad')].find(e=>!e.classList.contains('nx-root')&&e.getBoundingClientRect().width>0);const q=e.getBoundingClientRect();return {x:q.x+q.width/2,y:q.y+q.height/2}});
  await touchAt(p,pt);let h=await hint(p);F(h.vis&&h.text===T.d,`M2 kids pad: ${J(h)}`);F(!(await overlap(p)).length,`M2 kids overlap ${J(await overlap(p))}`);F(await topChk(p),'not in the top region: '+`M2 kids overlap ${J(await overlap(p))}`);await shot(p,'m2-kids');
  await wait(4100);await p.evaluate(()=>__paHint&&0);pt=await keyPt(p,"e.dataset.midi&&!e.classList.contains('nx-root')&&!e.classList.contains('nokey')");
  if(pt){await p.evaluate(()=>{});await touchAt(p,pt);}await p.waitForTimeout(100);F(!(await overlap(p)).length,`M2 kids key overlap ${J(await overlap(p))}`);F(await topChk(p),'not in the top region: '+`M2 kids key overlap ${J(await overlap(p))}`);
  F(!p.errs.length,'errs '+p.errs);await p.ctx.close();}
 // L1: Simple -> chip miss -> no overlap with chips (incl. Gsus4)
 {const p=await mk('pop',{simple:true});await setup(p);
  const pt=await chipPt(p,false);await touchAt(p,pt);const h=await hint(p);F(h.vis&&h.text===T.b,`L1 simple b: ${J(h)}`);F(!(await overlap(p)).length,`L1 overlap ${J(await overlap(p))}`);F(await topChk(p),'not in the top region: '+`L1 overlap ${J(await overlap(p))}`);await shot(p,'l1-simple');
  F(!p.errs.length,'errs '+p.errs);await p.ctx.close();}
 // v112.2: every style (Full; Kids uses its pads) and Simple: pill vs every button, input, lyric line, key, chip
 const styles=['pop','kids','jazz','rnb','ballad','reggae','funk','yogaDeep','country'];
 for(const simple of [false,true])for(const st of styles){const p=await mk(st,{simple});await p.waitForTimeout(300);
  const ok=await p.evaluate(()=>[...document.querySelectorAll('#styles button')].map(b=>b.dataset.style));if(!ok.includes(st)){F(false,'no style '+st+' '+ok);await p.ctx.close();continue;}
  let pt;
  if(st==='kids'){pt=await p.evaluate(()=>{const e=[...document.querySelectorAll('#suggest .ss-kidpad')].find(e=>!e.classList.contains('nx-root')&&e.getBoundingClientRect().width>0);if(!e)return null;const q=e.getBoundingClientRect();return {x:q.x+q.width/2,y:q.y+q.height/2}});}
  else{await p.evaluate(()=>{__applySongKey('C','major');__progApi.set(0)});await p.waitForTimeout(200);await p.tap('#prog .pg-step');await p.waitForTimeout(400);pt=simple?await chipPt(p,false):await keyPt(p,nonRoot);}
  if(!pt){F(false,`${st} simple=${simple}: no tap target`);await p.ctx.close();continue;}
  await touchAt(p,pt);const h=await hint(p);const ov=await overlap(p);const tag=`${st}${simple?'-simple':''}`;
  F(h.vis,`${tag}: no hint ${J(h)}`);F(!ov.length,`${tag}: overlap ${J(ov)} ${J(h)}`);F(h.top<=H*0.45,`${tag}: not in the top region ${J(h)}`);F(h.top>=0&&h.bottom<=H&&h.left>=0&&h.right<=W,`${tag}: off screen ${J(h)}`);
  if(['kids','pop'].includes(st))await shot(p,'1122-'+tag);
  F(!p.errs.length,'errs '+p.errs);await p.ctx.close();}
 await b.close();fs.writeFileSync((process.env.OUT||__dirname)+`/hints1121-${W}x${H}-${process.env.TAG||'after'}.json`,J(R,null,1));console.log(J({size:R.size,count:R.count,fails:R.fails}));})();

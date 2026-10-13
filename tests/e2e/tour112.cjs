const APPV=require('fs').readFileSync(require('path').resolve(__dirname,'../../js/version.js'),'utf8').match(/APP_VERSION = "([^"]+)"/)[1];   // CI: version from js/version.js
// v112 tour: first launch only (fresh storage, Kids + Twinkle), 6 steps exact text, spotlight on each target, card inside
// the screen and not over the spotlight, Next / Skip / Done, saved as done, replay from Config > Help > Tour (from Pop too),
// Escape = Skip, saved settings = no tour, both sizes. Screenshots of every step.
const { chromium } = require('playwright-core');const fs=require('fs');
const U=(process.env.BASE||'http://localhost:8080/index.html');const J=JSON.stringify;
const TXT=["Hi! Let's play Twinkle Twinkle Little Star.","Tap the gold pad to play the next chord.","Or tap the gold key on the piano. This works too.","The words light up as you go.","Tap Play to hear the whole song.","Pick another song here. There are 10!"];
const SEL=[null,'#suggest .ss-kidpad.nx-root','#pads .pad.nx-root','#kidsLyr','#prog .pg-song','#prog .pg-sel'];
const R={fails:[],count:{}};const F=(c,m)=>{R.count[c?'ok':'FAIL']=(R.count[c?'ok':'FAIL']||0)+1;if(!c)R.fails.push(m)};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined,});
for(const [W,H] of [[360,780],[780,360]]){const sz=W+'x'+H;
 const mk=async()=>{const ctx=await b.newContext({viewport:{width:W,height:H},hasTouch:true,isMobile:true,deviceScaleFactor:2});const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(''+e));p.on('console',m=>{if(m.type()==='error')p.errs.push(m.text())});return {ctx,p};};
 const st=p=>p.evaluate(SEL=>{const box=document.getElementById('tour');const i=window.__tour.step();const card=box.querySelector('.tour-card').getBoundingClientRect(),hole=box.querySelector('.tour-hole'),hr=hole.getBoundingClientRect();
  const t=i>=0&&SEL[i]?document.querySelector(SEL[i]):null,tr=t?t.getBoundingClientRect():null;
  return {open:!box.hidden,i,text:document.getElementById('tourText').textContent,step:box.querySelector('.tour-step').textContent,next:box.querySelector('.tour-next').textContent,skip:!box.querySelector('.tour-skip').hidden,
   card:[card.left,card.top,card.right,card.bottom],hole:hole.hidden?null:[hr.left,hr.top,hr.right,hr.bottom],tgt:tr?[tr.left,tr.top,tr.right,tr.bottom]:null,num:box.querySelector('.tour-num').hidden?null:box.querySelector('.tour-num').textContent,
   done:window.__tour.done(),style:(document.querySelector('#styles button.on')||{}).textContent,song:(document.querySelector('#prog .pg-t')||{}).textContent,W:innerWidth,H:innerHeight,
   goldKeyIn:(()=>{const g=document.querySelector('#pads .pad.nx-root');if(!g)return null;const q=g.getBoundingClientRect(),P=document.getElementById('pads').getBoundingClientRect();return q.left>=P.left-1&&q.right<=P.right+1})()}},SEL);
 const check=(s,k,tag)=>{F(s.open&&s.i===k,`${tag} step ${k+1} open ${s.open} i ${s.i}`);F(s.text===TXT[k],`${tag} step ${k+1} text "${s.text}"`);F(s.step===`${k+1} / 6`,`${tag} counter ${s.step}`);
  F(s.next===(k===5?'Done':'Next'),`${tag} step ${k+1} button ${s.next}`);F(k===5||s.skip,`${tag} step ${k+1} no Skip`);
  const c=s.card;F(c[0]>=0&&c[1]>=0&&c[2]<=s.W&&c[3]<=s.H,`${tag} step ${k+1} card off screen ${J(c)}`);
  if(SEL[k]){F(!!s.tgt&&!!s.hole,`${tag} step ${k+1} no target/hole`);if(s.tgt&&s.hole){const h=s.hole,t=s.tgt;F(h[0]<=t[0]+1&&h[1]<=Math.max(t[1],2)+1&&h[2]>=Math.min(t[2],s.W-2)-1&&h[3]>=Math.min(t[3],s.H-2)-1,`${tag} step ${k+1} hole ${J(h)} misses target ${J(t)}`);
    const ov=!(c[2]<=h[0]||c[0]>=h[2]||c[3]<=h[1]||c[1]>=h[3]);F(!ov,`${tag} step ${k+1} card ${J(c)} overlaps spotlight ${J(h)}`);F(s.num===String(k+1),`${tag} step ${k+1} marker ${s.num}`);}}
  else F(!s.hole,`${tag} step 1 should be whole screen`);
  if(k===2)F(s.goldKeyIn===true,`${tag} gold key not in the keyboard view`);};
 // 1) fresh: auto tour, Next x5, Done; screenshots
 {const {ctx,p}=await mk();await p.goto(U+'?test=1&tour=1');await p.waitForTimeout(1600);
  for(let k=0;k<6;k++){const s=await st(p);check(s,k,sz+' fresh');if(k===0)F(s.style==='Kids'&&/Twinkle/.test(s.song),`${sz} fresh not Kids Twinkle ${s.style} ${s.song}`);
   await p.screenshot({path:`${process.env.SHOTS||'/tmp/tc-shots'}/tour-${sz}-step${k+1}.png`});await p.click('#tour .tour-next');await p.waitForTimeout(250);}
  let s=await st(p);F(!s.open&&s.done,`${sz} Done: open ${s.open} done ${s.done}`);
  await p.reload();await p.waitForTimeout(1600);s=await st(p);F(!s.open,`${sz} tour again after Done + reload`);
  // replay from Pop via Config > Help > Tour
  await p.evaluate(()=>document.querySelector('#styles button[data-style="pop"]').click());await p.waitForTimeout(400);
  await p.click('#configBtn');await p.waitForTimeout(250);const vis=await p.evaluate(()=>{const t=document.getElementById('tourBtn').getBoundingClientRect();return t.width>0&&t.bottom<=innerHeight});F(vis,`${sz} Help > Tour not visible in the gear menu`);
  if(W===360)await p.screenshot({path:`${process.env.SHOTS||'/tmp/tc-shots'}/gear-help-tour-${sz}.png`});
  await p.click('#tourBtn');await p.waitForTimeout(600);s=await st(p);check(s,0,sz+' replay');F(s.style==='Kids'&&/Twinkle/.test(s.song),`${sz} replay not in Kids Twinkle: ${s.style} ${s.song}`);
  for(let k=0;k<5;k++){await p.click('#tour .tour-next');await p.waitForTimeout(250);check(await st(p),k+1,sz+' replay');}
  await p.click('#tour .tour-next');await p.waitForTimeout(200);s=await st(p);F(!s.open,`${sz} replay Done left it open`);
  F(!p.errs.length,`${sz} errs ${J(p.errs)}`);await ctx.close();}
 // 2) Skip at step 3, saved; Escape skip on a replay
 {const {ctx,p}=await mk();await p.goto(U+'?test=1&tour=1');await p.waitForTimeout(1600);await p.click('#tour .tour-next');await p.waitForTimeout(150);await p.click('#tour .tour-next');await p.waitForTimeout(150);
  let s=await st(p);check(s,2,sz+' skip');await p.click('#tour .tour-skip');await p.waitForTimeout(150);s=await st(p);F(!s.open&&s.done,`${sz} Skip: open ${s.open} done ${s.done}`);
  await p.reload();await p.waitForTimeout(1600);s=await st(p);F(!s.open,`${sz} tour again after Skip`);
  await p.evaluate(()=>window.__tour.start(true));await p.waitForTimeout(300);await p.keyboard.press('Escape');await p.waitForTimeout(150);s=await st(p);F(!s.open,`${sz} Escape did not skip`);
  // the tour blocks taps underneath: a tap on the gold pad during the tour does not advance
  await p.evaluate(()=>window.__tour.start(true));await p.waitForTimeout(300);await p.click('#tour .tour-next');await p.waitForTimeout(200);
  const pos0=await p.evaluate(()=>__magic.state.pos);const gp=await p.evaluate(()=>{const q=document.querySelector('#suggest .ss-kidpad.nx-root').getBoundingClientRect();return {x:q.x+q.width/2,y:q.y+q.height/2}});
  await p.mouse.click(gp.x,gp.y);await p.waitForTimeout(200);F(await p.evaluate(()=>__magic.state.pos)===pos0,`${sz} a tap reached the app under the tour`);
  F(!p.errs.length,`${sz} errs ${J(p.errs)}`);await ctx.close();}
 // 3) saved settings, tour never done: no tour (only the fresh first load runs it)
 {const {ctx,p}=await mk();await p.goto(U+'?test=1');await p.evaluate(()=>{localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:{simple:false,style:'pop'}}));localStorage.removeItem('touchChord.tour.v1')});
  await p.goto(U+'?test=1&tour=1');await p.waitForTimeout(1600);const s=await st(p);F(!s.open,`${sz} saved settings: tour opened`);F(!s.done,`${sz} saved settings: marked done`);await ctx.close();}
 // 4) without ?test=1 (the real app) a fresh load runs it too
 {const {ctx,p}=await mk();await p.goto(U);await p.waitForTimeout(1600);F(await p.evaluate(()=>!document.getElementById('tour').hidden),`${sz} real fresh load: no tour`);await ctx.close();}
}
await b.close();fs.writeFileSync((process.env.OUT||__dirname)+'/tour112.json',J(R,null,1));console.log(J({count:R.count,fails:R.fails.slice(0,20)}));})().catch(e=>{console.error(e);process.exit(1)});

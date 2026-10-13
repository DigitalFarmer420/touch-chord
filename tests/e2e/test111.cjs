const APPV=require('fs').readFileSync(require('path').resolve(__dirname,'../../js/version.js'),'utf8').match(/APP_VERSION = "([^"]+)"/)[1];   // CI: version from js/version.js
// v111: Kids = 10 songs, London Bridge + Hey Diddle Diddle replace Wheels on the Bus + If You're Happy (saved state -> Twinkle).
// v109 final: Kids = 10 songs (4 kept + 6 new); per tap: step, lyric syllable, gold key/pad = sounded note.
// v109: Ballad = 3 presets (All I Ask removed); Kids = 4 songs (Sunny Day, Lullaby, Silly Walk, Spooky, Rainy Day removed),
// each plays with Play song and tap-along through every note with its lyrics; Minor in Kids falls back to the song key;
// old saved state (Kids in a minor key, Ballad) loads safely. 360x780 + 780x360.
const { chromium } = require('playwright-core');const fs=require('fs');
const URL=process.env.URL||(process.env.BASE||'http://localhost:8080/index.html');const SH=(process.env.SHOTS||'/tmp/tc-shots')+'/s111/';
const R={fails:[],info:{}};const F=(c,m)=>{if(!c)R.fails.push(m)};
const KIDS=["Kids Twinkle","Kids Mary's Lamb","Kids Row Your Boat","Kids Hot Cross Buns","Kids Old MacDonald","Kids Itsy Bitsy Spider","Kids London Bridge","Kids Hey Diddle Diddle","Kids Head Shoulders Knees and Toes","Kids Baa Baa Black Sheep","Kids Hickory Dickory Dock"],BAL=['Ballad Classic','Ballad Hymn','Ballad Big Finish'];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined,args:['--autoplay-policy=no-user-gesture-required']});
for(const [w,h] of [[360,780],[780,360]]){const tag=`${w}x${h}`;
 const mk=async(init)=>{const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true,deviceScaleFactor:2});if(init)await ctx.addInitScript(init);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(''+e));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});await p.goto(URL+'?test=1');await p.waitForTimeout(900);const cdp=await ctx.newCDPSession(p);return {ctx,p,errs,cdp};};
 const names=p=>p.evaluate(()=>__prog.list.map(x=>x.name));const cur=p=>p.evaluate(()=>__prog.list[__prog.idx]&&__prog.list[__prog.idx].name);
 const style=(p,s)=>p.evaluate(s=>document.querySelector(`#styles button[data-style="${s}"]`).click(),s);
 const HOOK=`(()=>{window.__pc=[];const iv=setInterval(()=>{const A=window.ChordAudio;if(!A||A.__h)return;A.__h=1;clearInterval(iv);const o=A.playChord;A.playChord=function(g,mm,op){__pc.push({g,mid:(mm||[]).slice()});return o.apply(this,arguments)};},20);})();`;
 for(const mode of ['full','simple','fullkb']){const {ctx,p,errs,cdp}=await mk(HOOK+(mode==='fullkb'?`try{localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:{simple:false,layout:'full'}}));}catch(e){}`:''));
  if(mode==='simple'){await p.click('#simpleBtn');await p.waitForTimeout(400);}
  F(await p.evaluate(()=>document.getElementById('appVersion').textContent)==='Version '+APPV,`${tag} version`);
  // Ballad
  await style(p,'ballad');await p.waitForTimeout(500);
  let n=await names(p);F(JSON.stringify(n)===JSON.stringify(BAL),`${tag} ${mode} ballad list ${JSON.stringify(n)}`);
  const seen=[];for(let i=0;i<4;i++){seen.push(await cur(p));await p.click('#prog .pg-next');await p.waitForTimeout(250);}
  F(JSON.stringify(seen)===JSON.stringify([...BAL,BAL[0]]),`${tag} ${mode} ballad cycle ${JSON.stringify(seen)}`);
  for(let i=0;i<3;i++){await p.evaluate(i=>__progApi.set(i),i);await p.click('.pg-song');await p.waitForTimeout(1300);const s=await p.evaluate(()=>({playing:__prog.playing,cur:__prog.cur,name:__prog.list[__prog.idx].name}));await p.click('.pg-song');await p.waitForTimeout(200);
   F(s.playing&&s.cur>=0&&s.name===BAL[i],`${tag} ${mode} play ${BAL[i]} ${JSON.stringify(s)}`);}
  await p.evaluate(()=>{__prog.idx=3;});await p.evaluate(()=>__applySongKey('D','major'));await p.waitForTimeout(300);F(await cur(p)==='Ballad Classic',`${tag} ${mode} stale ballad idx 3`);
  await p.evaluate(()=>__applySongKey('A','minor'));await p.waitForTimeout(300);n=await names(p);F(n.length===3,`${tag} ${mode} ballad minor ${n}`);
  await p.evaluate(()=>__progApi.set(0));await p.screenshot({path:SH+`ballad-${mode}-${tag}.png`});
  // Kids
  await style(p,'kids');await p.waitForTimeout(700);
  n=await names(p);F(JSON.stringify(n)===JSON.stringify(KIDS),`${tag} ${mode} kids list ${JSON.stringify(n)}`);
  const ks=[];for(let i=0;i<KIDS.length+1;i++){ks.push(await cur(p));await p.click('#prog .pg-next');await p.waitForTimeout(300);}
  F(JSON.stringify(ks)===JSON.stringify([...KIDS,KIDS[0]]),`${tag} ${mode} kids cycle ${JSON.stringify(ks)}`);
  for(let i=0;i<KIDS.length;i++){await p.evaluate(i=>__progApi.set(i),i);await p.waitForTimeout(400);
   const info=await p.evaluate(()=>({name:__prog.list[__prog.idx].name,n:__prog.steps.length,key:__prog.key&&__prog.key.mode}));
   // tap-along: the gold pad, every note, then one more = wrap
   const steps=[];const words=new Set();
   for(let k=0;k<=info.n;k++){const r=await p.evaluate(full=>{const pad=document.querySelector('#suggest .ss-kidpad.nx-root'),key=document.querySelector('#pads .pad.nx-root');const e=full?key:pad;if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,keyMidi:key?+key.dataset.midi:null,padPc:pad&&pad._tc?pad._tc.item.rootPc:null,n0:__pc.length};},mode!=='simple');
    if(!r){F(false,`${tag} ${mode} ${info.name} no gold pad at ${k}`);break;}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(60);
    const t=await p.evaluate(n0=>{const T=__kidsTap.taps;const l=T[T.length-1];const ly=[...document.querySelectorAll('[class*=kid][class*=ly], #kidsLyr, .kids-lyr')].map(e=>e.innerText).join('|');
      const on=[...document.querySelectorAll('#kidsLyr .kl-on')].map(e=>e.textContent);const snd=__pc.slice(n0).filter(x=>x.mid.length===1).pop();
      const st=l?l.step:-1,L=__kidsLyr.data()[__prog.list[__prog.idx].name];let want=null;L.forEach(ln=>ln.markers.forEach((m,j)=>{if(m.chordIndex===st){const seg=ln.text.slice(m.charIndex,j+1<ln.markers.length?ln.markers[j+1].charIndex:ln.text.length);want=seg.match(/^([^\s,.!?;:]*)/)[1];}}));
      const it=__prog.steps[st]&&__prog.steps[st].item;return {lay:document.querySelectorAll('#pads .pad').length>20?'full':'win',step:st,pos:__magic.state.pos,ly,on,want,snd:snd?snd.mid[0]:null,exp:it?60+it.mel:null,n:__pc.length};},r.n0);
    steps.push(t.step);if(t.ly)words.add(t.ly);
    if(k<info.n){F(t.on.length===1&&t.on[0]===t.want,`${tag} ${mode} ${info.name} step ${k} lyric ${JSON.stringify(t.on)} want ${t.want}`);
     F(t.snd!=null&&(t.snd%12+12)%12===((r.padPc%12)+12)%12,`${tag} ${mode} ${info.name} step ${k} sounded ${t.snd} gold pad pc ${r.padPc}`);
     if(mode!=='simple'){F(t.snd===r.keyMidi,`${tag} ${mode} ${info.name} step ${k} sounded ${t.snd} gold key ${r.keyMidi}`);}
     if(mode==='fullkb'){F(t.lay==='full',`${tag} ${mode} layout ${t.lay}`);F(t.snd===r.keyMidi,`${tag} ${mode} ${info.name} step ${k} sounded ${t.snd} gold key ${r.keyMidi}`);F(t.snd===t.exp,`${tag} ${mode} ${info.name} step ${k} sounded ${t.snd} expected ${t.exp}`);}
     else F(t.snd!=null&&(t.snd-t.exp)%12===0,`${tag} ${mode} ${info.name} step ${k} sounded ${t.snd} pc vs ${t.exp}`);
     R.sylls=(R.sylls||0)+1;}}
   const ok=steps.slice(0,info.n).every((s,i)=>s===i)&&steps[info.n]===0;
   F(ok,`${tag} ${mode} ${info.name} tap-along steps ${JSON.stringify(steps)}`);F(words.size>=2,`${tag} ${mode} ${info.name} lyrics did not move (${words.size})`);
   // Play song: runs and advances
   await p.click('.pg-song');await p.waitForTimeout(400);const a=await p.evaluate(()=>__prog.cur);await p.waitForTimeout(2200);const c=await p.evaluate(()=>({cur:__prog.cur,playing:__prog.playing}));await p.click('.pg-song');await p.waitForTimeout(250);
   F(c.playing&&c.cur>a,`${tag} ${mode} ${info.name} play ${JSON.stringify([a,c])}`);
   R.info[`${tag} ${mode} ${info.name}`]={steps:info.n,lyricStates:words.size,play:[a,c.cur]};}
  await p.screenshot({path:SH+`kids-${mode}-${tag}.png`});
  // Minor in Kids -> back to the song's key, 4 songs
  await p.evaluate(()=>__applySongKey('E','minor'));await p.waitForTimeout(400);
  const km=await p.evaluate(()=>({n:__prog.list.length,mode:__prog.key.mode,name:__prog.list[__prog.idx].name}));F(km.n===11&&km.mode==='major',`${tag} ${mode} kids minor fallback ${JSON.stringify(km)}`);
  F(!errs.length,`${tag} ${mode} errs ${errs}`);await ctx.close();}
 // old saved states: Kids with a minor key (Spooky / Rainy Day were the minor Kids songs); Ballad
 for(const [lab,set] of [['kids-minor',{simple:false,style:'kids',keyMode:true,keyRoot:9,keyScale:'minor',lockKey:{pc:9,mode:'minor'},prog:'Kids Spooky'}],['ballad',{simple:false,style:'ballad',prog:3,progName:'Ballad All I Ask'}],['kids-wheels',{simple:false,style:'kids',prog:5,progName:'Kids Wheels on the Bus'}],['kids-happy',{simple:true,style:'kids',prog:6,progName:"Kids If You're Happy"}]]){
  const init=`try{localStorage.setItem('touchChord.settings.v1',${JSON.stringify(JSON.stringify({v:1,settings:set}))});}catch(e){}`;
  const {ctx,p,errs}=await mk(init);await p.waitForTimeout(300);
  const s=await p.evaluate(()=>({style:(document.querySelector('#styles button.on')||{dataset:{}}).dataset.style,names:__prog.list.map(x=>x.name),name:__prog.list[__prog.idx]&&__prog.list[__prog.idx].name,mode:__prog.key&&__prog.key.mode}));
  R.info[`${tag} saved ${lab}`]=s;
  if(lab==='ballad')F(s.name==='Ballad Classic'&&s.names.length===3,`${tag} saved ballad ${JSON.stringify(s)}`);
  else F(s.names.length===11&&s.name==='Kids Twinkle'&&s.mode==='major'&&!s.names.some(n=>/Wheels|Happy/.test(n)),`${tag} saved ${lab} ${JSON.stringify(s)}`);
  await p.click('.pg-song');await p.waitForTimeout(1200);F(await p.evaluate(()=>__prog.playing&&__prog.cur>=0),`${tag} saved ${lab} does not play`);await p.click('.pg-song');
  F(!errs.length,`${tag} saved ${lab} errs ${errs}`);await ctx.close();}
}
await b.close();fs.writeFileSync((process.env.OUT||__dirname)+'/test111.json',JSON.stringify(R,null,1));console.log(JSON.stringify(R.fails,null,1),R.fails.length);})();

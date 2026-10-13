const APPV=require('fs').readFileSync(require('path').resolve(__dirname,'../../js/version.js'),'utf8').match(/APP_VERSION = "([^"]+)"/)[1];   // CI: version from js/version.js
// v109: does each Kids lyric line fit its row (no ellipsis), per song, 360x780 / 780x360, Full + Simple.
const { chromium } = require('playwright-core');const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined,});const out={};
for(const [w,h] of [[360,780],[780,360]])for(const simple of [false,true]){const tag=`${w}x${h}-${simple?'simple':'full'}`;const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true});await ctx.addInitScript(`try{localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:{simple:${simple}}}))}catch(e){}`);const p=await ctx.newPage();await p.goto((process.env.BASE||'http://localhost:8080/index.html')+'?test=1');await p.waitForTimeout(900);
await p.evaluate(()=>document.querySelector('#styles button[data-style="kids"]').click());await p.waitForTimeout(500);
out[tag]=await p.evaluate(async()=>{const res={};for(let i=0;i<__prog.list.length;i++){__progApi.set(i);await new Promise(r=>setTimeout(r,80));const bad=new Set();for(let s=0;s<__prog.steps.length;s++){__progApi.next();await new Promise(r=>setTimeout(r,s%6===0?340:5));const r1=[...document.querySelectorAll('#kidsLyr .sb-row.r1')].pop();if(r1&&r1.scrollWidth>r1.clientWidth+1)bad.add(r1.textContent);}res[__prog.list[i].name]=[...bad];}__progApi.stop();return res;});
await ctx.close();}
await b.close();fs.writeFileSync((process.env.OUT||__dirname)+'/lyrfit111.json',JSON.stringify(out,null,1));for(const t in out){console.log(t,JSON.stringify(Object.fromEntries(Object.entries(out[t]).filter(([k,v])=>v.length))));}})();

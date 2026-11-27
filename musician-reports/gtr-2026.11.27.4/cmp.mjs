import "/workspace/chord-touch/jam-2026.11.27.2/site/tests/unit/dom-stub.js";
import { resolveVoicings } from "/workspace/chord-touch/jam-2026.11.27.2/site/js/instruments/resolve.js?v=2026.11.27.4-20df938";
import { resolveChord, checkShape } from "/workspace/tc-guitar-shapes/resolve.mjs";
import fs from "node:fs";
const J=JSON.parse(fs.readFileSync("/workspace/tc-guitar-shapes/shapes.json"));
const N=["C","Db","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
const fmt=f=>f.map(x=>x==null||x<0?"x":x>9?`(${x})`:x).join("");
const S={cases:0,appOk:0,appBad:[],appSimpl:[],appEmpty:[],first:0,contains:0,diff:[]};
for(const q of J.qualities){ if(q.aliasOf) continue;
 for(let r=0;r<12;r++){ S.cases++;
  const mine=resolveChord({quality:q.key,rootPc:r,type:q.type,ext:q.ext||{},bassPc:null});
  let app; try{app=resolveVoicings("guitar",{rootPc:r,type:q.type,extensions:q.ext||{}});}catch(e){app=[];}
  const tag=N[r]+q.key;
  if(!app.length){S.appEmpty.push(tag);continue;}
  const a0=app[0]; const c=checkShape({frets:a0.frets.map(x=>x==null?-1:x),fingers:a0.fingers,barre:null},r,q.type,q.ext||{},null);
  if(c.ok) S.appOk++; else S.appBad.push(tag+" "+fmt(a0.frets)+" :: "+c.issues.join("; "));
  if(a0.simplified) S.appSimpl.push(tag+" "+fmt(a0.frets)+" drop "+a0.dropped.join(","));
  if(mine.ok){ const m=fmt(mine.shape.frets);
   if(fmt(a0.frets)===m) S.first++; else S.diff.push(`${tag.padEnd(12)} mine ${m.padEnd(14)} app ${fmt(a0.frets).padEnd(14)} ${a0.shapeName}`);
   if(app.some(v=>fmt(v.frets)===m)) S.contains++;}
 }}
console.log(`cases ${S.cases}; app first voicing correct ${S.appOk}; empty ${S.appEmpty.length}; simplified ${S.appSimpl.length}; app first == my pick ${S.first}; my pick in app list ${S.contains}`);
console.log("EMPTY:",S.appEmpty.join(" "));console.log("BAD:\n"+S.appBad.join("\n"));console.log("SIMPL:\n"+S.appSimpl.join("\n"));
fs.writeFileSync("diff.txt",S.diff.join("\n")+"\n");
// inner-muted strings (can't strum) and frets above 12 in app first voicing
const inner=[], byQ={};
for(const q of J.qualities){ if(q.aliasOf) continue; for(let r=0;r<12;r++){
 const a0=resolveVoicings("guitar",{rootPc:r,type:q.type,extensions:q.ext||{}})[0]; const f=a0.frets;
 const s=f.findIndex(x=>x!=null), e=f.length-1-[...f].reverse().findIndex(x=>x!=null);
 if(f.slice(s,e+1).some(x=>x==null)){inner.push(N[r]+q.key+" "+fmt(f)); byQ[q.key]=(byQ[q.key]||0)+1;}}}
console.log("INNER-MUTED first voicings:",inner.length); console.log(JSON.stringify(byQ));
fs.writeFileSync("inner-muted.txt",inner.join("\n")+"\n");

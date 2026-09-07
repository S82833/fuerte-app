import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('lib/demo-state.ts','utf8');
const load=async(text,id)=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText+`\n// ${id}`).toString('base64'));
const now=new Date(2026,8,7,13,15,0);
const checks=[
 {name:'Calendario con siete días y lunes como inicio',mutation:s=>s.replace('length:7','length:6'),check:m=>{const week=m.daysAroundToday(now);assert.equal(week.length,7);assert.equal(week[0].key,'2026-09-07');assert.equal(week[6].key,'2026-09-13');}},
 {name:'Una toma confirmada no se duplica ni se cambia por un problema',mutation:s=>s.replace("if(s.doses[key]?.status==='given')return s;",''),check:m=>{const state=m.recordDose(m.initialState(now),'given',undefined,now);assert.strictEqual(m.recordDose(state,'given',undefined,now),state);assert.strictEqual(m.recordDose(state,'issue','Vomitó',now),state);}},
 {name:'Los problemas requieren un motivo',mutation:s=>s.replace("if(status==='issue'&&!reason?.trim())throw new Error('Elige un motivo');",''),check:m=>{assert.throws(()=>m.recordDose(m.initialState(now),'issue',' ',now),/motivo/);}},
 {name:'Estado incompatible se rechaza sin sobrescribirlo',mutation:s=>s.replace('s.version!==1||',''),check:m=>{assert.throws(()=>m.parseState(JSON.stringify({...m.initialState(now),version:99})),/válido/);}},
 {name:'Visitas y entregas sobreviven a la serialización',mutation:s=>s.replace('visits:[{...visit,id:crypto.randomUUID(),at:now.toISOString()},...s.visits]','visits:s.visits'),check:m=>{const saved=m.addVisit(m.initialState(now),{patient:'gael',kind:'refill',note:'Entrega de ejemplo'},now);const restored=m.parseState(JSON.stringify(saved));assert.equal(restored.visits[0].note,'Entrega de ejemplo');assert.deepEqual(restored.refills,['gael']);}},
 {name:'Cambiar de día permite registrar la siguiente toma',mutation:s=>s.replace('const key=dateKey(now);',"const key=Object.keys(s.doses).find(k=>s.doses[k].status==='given')||dateKey(now);"),check:m=>{const state=m.recordDose({version:1,doses:{},visits:[],refills:[]},'given',undefined,now);const nextDay=new Date(2026,8,8,13,15);const next=m.recordDose(state,'given',undefined,nextDay);assert.equal(Object.keys(next.doses).length,2);assert.equal(next.doses['2026-09-08'].status,'given');}}
];
for(let i=0;i<checks.length;i++){const c=checks[i];const mutated=c.mutation(source);assert.notEqual(mutated,source,'Mutation must change code');let failed=false;try{c.check(await load(mutated,`mutant-${i}`));}catch{failed=true;}assert.ok(failed,`Mutation survived: ${c.name}`);console.log(`RED (mutación detectada): ${c.name}`);c.check(await load(source,`original-${i}`));console.log(`GREEN: ${c.name}`);}
console.log(`${checks.length}/${checks.length} comprobaciones; ${checks.length}/${checks.length} mutaciones detectadas.`);

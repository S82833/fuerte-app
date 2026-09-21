const payload={context:{patient:{birthDate:'2024-01-01',prescribedTreatment:'Pauta de prueba indicada por profesional'},records:[{kind:'dose',occurred:'2026-09-20',body:'Dosis registrada'}],totalRecords:1,summary:[],historyIsPartial:false,messages:[]},message:'Que dosis tengo registradas?'};
const response=await fetch('http://ai:3501/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(100000)});
console.log(response.status,await response.text());

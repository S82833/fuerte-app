export async function api<T=unknown>(path:string,body?:unknown,method='POST',key?:string):Promise<T>{
  const response=await fetch('/api/v1'+path,{method:body===undefined?'GET':method,headers:body===undefined?{}:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json() as {error?:{message?:string}};
  if(!response.ok)throw new Error(data.error?.message||'No pudimos completar la operación.');
  return data as T;
}

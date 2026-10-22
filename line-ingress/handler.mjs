/** Minimal independent ingress adapter, NOT deployed; no DO, DB, queue or sender.
 * Bind handle(request, config, fetch) to a separately approved HTTPS platform.
 */
const encoder=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
async function mac(secret,bytes) {
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return b64(await crypto.subtle.sign('HMAC',key,bytes));
}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function boundedBody(stream,limit) {
 if(!stream)return new Uint8Array();
 const reader=stream.getReader(),parts=[];let size=0;
 try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Body too large');parts.push(value);}}
 catch(e){await reader.cancel();throw e;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;
}
export async function handle(request,config,fetcher=fetch) {
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 try {
  if(!config?.lineSecret||!config.originSecret||config.originSecret.length<32||!config.audience||!config.channel)throw Error('Configuration');
  const target=new URL(config.gasUrl);
  if(target.protocol!=='https:'||target.hostname!=='script.google.com'||target.username||target.password||target.search||target.hash||!/^\/macros\/s\/[\w-]+\/exec$/.test(target.pathname))throw Error('Target');
  const signature=request.headers.get('x-line-signature');
  if(!signature||!/[A-Za-z0-9+/]{43}=$/.test(signature)||signature.length!==44)return new Response('Unauthorized',{status:401});
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return new Response('Unsupported media type',{status:415});
  if(Number(request.headers.get('content-length'))>40000)return new Response('Body too large',{status:413});
  const bytes=await boundedBody(request.body,40000);
  if(!equal(signature,await mac(config.lineSecret,bytes)))return new Response('Unauthorized',{status:401});
  const payload=new TextDecoder('utf-8',{fatal:true}).decode(bytes),body=JSON.parse(payload);
  if(body.destination!==config.channel||!Array.isArray(body.events)||body.events.length>32)return new Response('Invalid batch',{status:400});
  const envelope={v:1,aud:config.audience,channel:config.channel,issuedAt:Date.now(),nonce:crypto.randomUUID(),payload};
  envelope.mac=await mac(config.originSecret,encoder.encode('PK_REQUEST_V1\n'+JSON.stringify([envelope.v,envelope.aud,envelope.channel,envelope.issuedAt,envelope.nonce,envelope.payload])));
  // One forward only; no automatic application retry on uncertain delivery.
  const signal=AbortSignal.timeout(8000);
  let response=await fetcher(target.href,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(envelope),redirect:'manual',signal});
  if([302,303].includes(response.status)){
   const redirect=new URL(response.headers.get('location'));
   if(redirect.protocol!=='https:'||redirect.hostname!=='script.googleusercontent.com'||redirect.username||redirect.password)throw Error('Redirect');
   response=await fetcher(redirect.href,{method:'GET',redirect:'error',signal});
  }
  if(response.status!==200)throw Error('Origin unavailable');
  const ack=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedBody(response.body,2048)));
  const expected=await mac(config.originSecret,encoder.encode('PK_ACK_V1\n'+JSON.stringify([ack.v,ack.nonce,ack.status])));
  if(ack.v!==1||ack.nonce!==envelope.nonce||!equal(ack.mac,expected)||ack.status!=='accepted')throw Error('Invalid acknowledgement');
  return new Response('OK',{status:200});
 }catch(error){return new Response('Temporarily unavailable',{status:503});}
}

import crypto from 'node:crypto';
export const secret='SYNTHETIC_ONLY_0123456789_abcdefghijklmnopqrstuvwxyz';
export function configure(c,props) {
 Object.assign(props,{PK_ORIGIN_SECRET:secret,PK_ORIGIN_AUDIENCE:'synthetic-gas',PK_LINE_CHANNEL:'synthetic-channel'});
 c.Utilities.computeHmacSha256Signature=(text,key)=>Array.from(crypto.createHmac('sha256',key).update(text).digest());
 c.Utilities.base64Encode=bytes=>Buffer.from(bytes.map(b=>b&255)).toString('base64');
}
export function signed(c,body,overrides={}) {
 if(typeof body!=='string')body={destination:'synthetic-channel',...body};
 const env={v:1,aud:'synthetic-gas',channel:'synthetic-channel',issuedAt:c.Date?.now?.()??Date.now(),nonce:crypto.randomUUID(),payload:typeof body==='string'?body:JSON.stringify(body),...overrides};
 env.mac=crypto.createHmac('sha256',secret).update('PK_REQUEST_V1\n'+JSON.stringify([env.v,env.aud,env.channel,env.issuedAt,env.nonce,env.payload])).digest('base64');
 return {postData:{contents:JSON.stringify(env)}};
}
export function trustedDriver(c,props) {
 configure(c,props);
 const origin=c.doPost;let serial=0;
 c.originDoPost=origin;
 c.doPost=e=>{
  if(!e?.postData)return {value:JSON.parse(origin(e).value).status};
  let b=JSON.parse(e.postData.contents);
  if(b.events)for(const ev of b.events){ev.webhookEventId??='fixture-'+(++serial);ev.timestamp??=c.Date?.now?.()??Date.now();}
  const result=origin(signed(c,b));
  const ack=JSON.parse(result.value);
  return {value:ack.status==='accepted'?'OK':ack.status,setMimeType(){return this;}};
 };
}

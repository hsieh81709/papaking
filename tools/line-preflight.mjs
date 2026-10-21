/** Offline, conservative checks for PapaKing-generated messages only.
 * Not LINE's official validator, not a complete Flex schema. No network calls.
 */
export function validateMessages(messages) {
  const errors=[];
  const check=(ok,path,reason)=>{if(!ok)errors.push(`${path}: ${reason}`);};
  const str=(s,n,p)=>check(typeof s==='string'&&s.length>0&&s.length<=n,p,`nonempty string <= ${n} UTF-16 units`);
  function action(a,p) {
    if(!a||typeof a!=='object'){errors.push(`${p}: missing action`);return;}
    str(a.label,20,p+'.label');
    if(a.type==='uri') {
      str(a.uri,1000,p+'.uri');
      try{check(new URL(a.uri).protocol==='https:',p+'.uri','HTTPS required by this local profile');}catch{errors.push(p+'.uri: invalid URL');}
    } else if(a.type==='message')str(a.text,300,p+'.text');
    else check(a.type==='location',p+'.type','unsupported action in local profile');
  }
  function component(c,p) {
    if(!c||typeof c!=='object'){errors.push(p+': missing component');return;}
    if(c.type==='text')str(c.text,2000,p+'.text');
    else if(c.type==='box') {
      check(['vertical','horizontal','baseline'].includes(c.layout),p+'.layout','invalid layout');
      check(Array.isArray(c.contents)&&c.contents.length>0,p+'.contents','nonempty array required');
      if(Array.isArray(c.contents))c.contents.forEach((v,i)=>component(v,`${p}.contents[${i}]`));
    } else if(c.type==='button')action(c.action,p+'.action');
    else check(c.type==='separator',p+'.type','unsupported component in local profile');
  }
  function bubble(b,p) {
    check(b?.type==='bubble',p+'.type','bubble required');
    check(Buffer.byteLength(JSON.stringify(b??null),'utf8')<=30000,p,'local bubble budget 30000 bytes');
    for(const key of ['header','body','footer'])if(b?.[key]){check(b[key].type==='box',p+'.'+key,'box required');component(b[key],p+'.'+key);}
    check(Boolean(b?.body),p+'.body','body required by local profile');
  }
  check(Array.isArray(messages)&&messages.length>=1&&messages.length<=5,'messages','1..5 messages required');
  if(!Array.isArray(messages))return errors;
  messages.forEach((m,i)=>{
    const p=`messages[${i}]`;
    if(m?.type==='text')str(m.text,5000,p+'.text');
    else if(m?.type==='flex') {
      str(m.altText,400,p+'.altText');
      if(m.contents?.type==='carousel') {
        // Product max 5 is intentionally stricter than the platform limit.
        check(Array.isArray(m.contents.contents)&&m.contents.contents.length>=1&&m.contents.contents.length<=5,p+'.contents','1..5 product bubbles');
        if(Array.isArray(m.contents.contents))m.contents.contents.forEach((b,j)=>bubble(b,`${p}.contents[${j}]`));
        check(Buffer.byteLength(JSON.stringify(m.contents),'utf8')<=50000,p+'.contents','local carousel budget 50000 bytes');
      } else bubble(m.contents,p+'.contents');
    } else errors.push(p+': unsupported message type in local profile');
    if(m?.quickReply) {
      check(Array.isArray(m.quickReply.items)&&m.quickReply.items.length>=1&&m.quickReply.items.length<=13,p+'.quickReply','1..13 items');
      if(Array.isArray(m.quickReply.items))m.quickReply.items.forEach((q,j)=>{check(q.type==='action',p+'.quickReply','action item required');action(q.action,`${p}.quickReply[${j}]`);});
    }
  });
  return errors;
}

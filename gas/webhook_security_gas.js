/** Explicit request modes. Default signed mode validates a trusted origin.
 * personal-direct is an opt-in owner allowlist ONLY, never LINE authentication.
 * No production configuration is written by this module.
 */
function papaKingSecurityConfig_() {
  var p = PropertiesService.getScriptProperties();
  var enabled=p.getProperty('PK_WEBHOOK_ENABLED');
  if (enabled !== null && enabled !== 'true') throw new Error('Webhook disabled');
  var mode=p.getProperty('PK_WEBHOOK_MODE') || 'signed';
  var owner=p.getProperty('PK_ALLOWED_LINE_USER_ID');
  if (owner !== null && !/^U[a-fA-F0-9]{32}$/.test(owner)) throw new Error('Invalid personal user configuration');
  if (mode === 'personal-direct') {
    var budget=Number(p.getProperty('MONTHLY_BUDGET'));
    if (!owner || !isFinite(budget) || budget <= 0 || Math.floor(budget) !== budget) throw new Error('Personal owner and positive monthly budget required');
    // Fixed namespace: changing an untrusted body.destination cannot evade dedup.
    return {mode:mode,owner:owner,channel:'personal-direct',destination:p.getProperty('PK_LINE_CHANNEL')};
  }
  if (mode !== 'signed') throw new Error('Unknown webhook mode');
  var config = {mode:mode,owner:owner,secret:p.getProperty('PK_ORIGIN_SECRET'),aud:p.getProperty('PK_ORIGIN_AUDIENCE'),channel:p.getProperty('PK_LINE_CHANNEL')};
  if (!config.secret || config.secret.length < 32 || !config.aud || !config.channel) throw new Error('Origin configuration required');
  return config;
}
function papaKingVerifyRequest_(e) {
  var config=papaKingSecurityConfig_();
  if (config.mode === 'signed') return papaKingVerifyEnvelope_(e,config);
  if (!e || !e.postData || typeof e.postData.contents !== 'string' ||
      e.postData.contents.length > 40000 || unescape(encodeURIComponent(e.postData.contents)).length > 40000) throw new Error('Invalid personal request');
  var body=JSON.parse(e.postData.contents);
  if (!body || typeof body.destination !== 'string' || !body.destination ||
      config.destination && body.destination !== config.destination) throw new Error('Invalid bot destination');
  return {config:config,body:body,authentication:'NONE_ALLOWLIST_ONLY'};
}
function papaKingAuthorizedEvents_(events, owner) {
  if (!Array.isArray(events) || events.length > 32) throw new Error('Invalid batch');
  if (!owner) return events; // Existing signed multi-user contract is unchanged.
  return events.filter(function(event) {
    var source=event && event.source;
    return event.type === 'message' && source && source.type === 'user' && source.userId === owner &&
      source.groupId === undefined && source.roomId === undefined;
  });
}
function papaKingMac_(domain, value, secret) {
  return Utilities.base64Encode(Utilities.computeHmacSha256Signature(domain + '\n' + JSON.stringify(value), secret, Utilities.Charset.UTF_8));
}
function papaKingEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var different = 0;
  for (var i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}
function papaKingVerifyEnvelope_(e, config) {
  config = config || papaKingSecurityConfig_();
  if (config.mode !== 'signed') throw new Error('Signed mode required');
  if (!e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length > 60000) throw new Error('Invalid envelope');
  var x = JSON.parse(e.postData.contents);
  if (!x || x.v !== 1 || x.aud !== config.aud || x.channel !== config.channel ||
      typeof x.issuedAt !== 'number' || !isFinite(x.issuedAt) || Math.abs(Date.now() - x.issuedAt) > 60000 ||
      typeof x.nonce !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(x.nonce) ||
      typeof x.payload !== 'string' || x.payload.length > 40000 ||
      !papaKingEqual_(x.mac,papaKingMac_('PK_REQUEST_V1',[x.v,x.aud,x.channel,x.issuedAt,x.nonce,x.payload],config.secret))) throw new Error('Untrusted envelope');
  var body=JSON.parse(x.payload);
  if (!body || body.destination !== config.channel) throw new Error('Wrong LINE destination');
  return {envelope:x,config:config,body:body};
}
function papaKingAck_(request, status) {
  if (request && request.config.mode === 'personal-direct') {
    // ContentService cannot set an HTTP status: this is NOT an authenticated ACK.
    return ContentService.createTextOutput(status === 'accepted' ? 'OK' : status).setMimeType(ContentService.MimeType.TEXT);
  }
  var ack = {v:1,status:status};
  if (request) {
    ack.nonce = request.envelope.nonce;
    ack.mac = papaKingMac_('PK_ACK_V1',[ack.v,ack.nonce,ack.status],request.config.secret);
  }
  return ContentService.createTextOutput(JSON.stringify(ack)).setMimeType(ContentService.MimeType.TEXT);
}

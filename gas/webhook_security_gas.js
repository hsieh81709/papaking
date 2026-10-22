/** P0-9 trusted-origin boundary. GAS cannot read LINE signature headers.
 * Only an independent raw-byte LINE verifier may sign this envelope.
 * No secrets configured by this file; missing config always rejects.
 */
function papaKingSecurityConfig_() {
  var p = PropertiesService.getScriptProperties();
  var config = {secret:p.getProperty('PK_ORIGIN_SECRET'),aud:p.getProperty('PK_ORIGIN_AUDIENCE'),channel:p.getProperty('PK_LINE_CHANNEL')};
  if (!config.secret || config.secret.length < 32 || !config.aud || !config.channel) throw new Error('Origin configuration required');
  return config;
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
function papaKingVerifyEnvelope_(e) {
  var config = papaKingSecurityConfig_();
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
  var ack = {v:1,status:status};
  if (request) {
    ack.nonce = request.envelope.nonce;
    ack.mac = papaKingMac_('PK_ACK_V1',[ack.v,ack.nonce,ack.status],request.config.secret);
  }
  return ContentService.createTextOutput(JSON.stringify(ack)).setMimeType(ContentService.MimeType.TEXT);
}

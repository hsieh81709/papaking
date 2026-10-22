/** Bounded, single-value durable state; all writers cooperate via ScriptLock.
 * Max 32 events / 16 conversation scopes / 7800 UTF-8 bytes (below 9KB/value).
 * No raw message, position, replyToken or user ID is persisted. Not exactly-once.
 * Missing value initializes; malformed/unavailable value fails closed, never resets.
 */
function papaKingWithLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('State busy');
  try { return fn(); } finally { lock.releaseLock(); }
}
function papaKingHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value),Utilities.Charset.UTF_8)
    .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
}
function papaKingState_(change) {
  return papaKingWithLock_(function() {
    var p = PropertiesService.getScriptProperties(), raw = p.getProperty('pk_state_v1');
    var state = raw === null ? {v:1,events:{},intents:{}} : JSON.parse(raw);
    if (!state || state.v !== 1 || !state.events || !state.intents ||
        typeof state.events !== 'object' || typeof state.intents !== 'object' ||
        Array.isArray(state.events) || Array.isArray(state.intents)) throw new Error('Invalid durable state');
    // Validate before GC: corruption must never erase event identity evidence.
    Object.keys(state.events).forEach(function(k) {
      var r=state.events[k];
      if (!r || typeof r !== 'object' || Array.isArray(r) ||
          typeof r.hash !== 'string' || !/^[a-f0-9]{64}$/.test(r.hash) ||
          typeof r.time !== 'number' || !isFinite(r.time) || r.time < 0 ||
          ['RECEIVED','STARTED','DONE','UNKNOWN'].indexOf(r.status)<0 ||
          r.replyAttempts !== undefined && r.replyAttempts !== 1 && r.replyAttempts !== 2) throw new Error('Invalid event record');
    });
    var now = Date.now();
    // Personal mode retains DONE beyond every accepted event's validity:
    // 600s stale horizon + up to 60s future timestamp. Never GC uncertain work.
    var retention=p.getProperty('PK_WEBHOOK_MODE') === 'personal-direct' ? 660000 : 86400000;
    Object.keys(state.events).forEach(function(k) {
      var r=state.events[k];
      // Never garbage-collect unfinished/uncertain work automatically.
      if (r.status === 'DONE' && now-r.time > retention) delete state.events[k];
    });
    Object.keys(state.intents).forEach(function(k){if(state.intents[k].expiresAt + 21600000 < now) delete state.intents[k];});
    var result = change(state);
    var next = JSON.stringify(state);
    if (Object.keys(state.events).length > 32 || Object.keys(state.intents).length > 16 ||
        unescape(encodeURIComponent(next)).length > 7800) throw new Error('State capacity reached');
    p.setProperty('pk_state_v1', next);
    if (p.getProperty('pk_state_v1') !== next) throw new Error('State write not confirmed');
    return result;
  });
}
function papaKingCanonical_(value) {
  if (Array.isArray(value)) return value.map(papaKingCanonical_);
  if (value && typeof value === 'object') {
    var result={};Object.keys(value).sort().forEach(function(k){result[k]=papaKingCanonical_(value[k]);});return result;
  }
  return value;
}
function papaKingEventHash_(event) {
  return papaKingHash_(papaKingCanonical_([event.type,event.timestamp,event.source,event.message]));
}
function papaKingAcceptEvents_(events, channel) {
  if (!Array.isArray(events) || events.length > 32) throw new Error('Invalid batch');
  var now = Date.now();
  events.forEach(function(e){
    if (!e || typeof e.webhookEventId !== 'string' || !/^[\w-]{1,128}$/.test(e.webhookEventId) ||
        typeof e.timestamp !== 'number' || !isFinite(e.timestamp) || now-e.timestamp > 600000 || e.timestamp-now > 60000) throw new Error('Invalid or stale event');
    if (e.type === 'message' && (!e.source || !e.message || typeof e.replyToken !== 'string')) throw new Error('Invalid message');
  });
  return papaKingState_(function(s) {
    var work=[];
    events.forEach(function(e){
      var key=papaKingHash_([channel,e.webhookEventId]), hash=papaKingEventHash_(e), old=s.events[key];
      if (old && old.hash !== hash) throw new Error('Event conflict');
      if (!old) {s.events[key]={hash:hash,time:now,status:'RECEIVED'};work.push({key:key,event:e});}
    });
    return work;
  });
}
function papaKingStartEvent_(key) {
  return papaKingState_(function(s){
    var r=s.events[key];
    if (!r || r.status !== 'RECEIVED') return false;
    r.status='STARTED';return true;
  });
}
function papaKingFinishEvent_(key, status) {
  papaKingState_(function(s){if(!s.events[key] || s.events[key].status !== 'STARTED') throw new Error('Invalid event transition');s.events[key].status=s.events[key].phase === 'UNKNOWN_REPLY' ? 'UNKNOWN' : status;});
}

// Per-execution owner only; every event claim remains durable across executions.
var papaKingCurrentEventKey_ = null;
function papaKingBeginReply_(messages, isFallback, fallbackMessages) {
  if (!papaKingCurrentEventKey_) return; // Manual/offline callers have no webhook owner.
  var key=papaKingCurrentEventKey_;
  papaKingState_(function(s) {
    var r=s.events[key];
    if (!r || r.status !== 'STARTED') throw new Error('Reply owner missing');
    if (isFallback) {
      if (r.replyAttempts !== 1 || r.phase !== 'REJECTED' || r.replyCode !== 400 ||
          !r.fallbackHash || r.fallbackHash !== papaKingHash_(messages) ||
          !messages.length || messages.some(function(m){return m.type !== 'text';})) throw new Error('Fallback not authorized');
      r.replyAttempts=2;
    } else {
      if (r.replyAttempts || r.phase) throw new Error('Reply already attempted');
      r.replyAttempts=1;
      if (fallbackMessages && fallbackMessages.length) r.fallbackHash=papaKingHash_(fallbackMessages);
    }
    r.phase='REPLY_STARTED'; // Commit this complete attempt reservation before HTTP.
  });
}
function papaKingReplyPhase_(phase, code) {
  if (!papaKingCurrentEventKey_) return; // Offline/manual formatter callers have no webhook claim.
  var key=papaKingCurrentEventKey_;
  papaKingState_(function(s){if(!s.events[key] || s.events[key].status !== 'STARTED') throw new Error('Reply owner missing');s.events[key].phase=phase;s.events[key].replyCode=code;});
}

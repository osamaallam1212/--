/* طبقة المنصة: أندرويد (WebView) / ويندوز (Electron) / متصفح عادي */
(function (K) {
  'use strict';
  var isAndroid = !!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage);
  var desk = window.kalimatiDesktop || null;
  var N = K.native = { platform: isAndroid ? 'android' : (desk ? 'desktop' : 'web') };
  document.documentElement.setAttribute('data-platform', N.platform);
  K.isMobile = isAndroid;
  var seq = 1, waiting = {}, handlers = {};
  N._r = function (id, ok, payload) {
    var w = waiting[id]; if (!w) return; delete waiting[id];
    if (ok) w.resolve(payload); else w.reject(new Error(payload && payload.message ? payload.message : String(payload || 'error')));
  };
  N._e = function (name, data) { (handlers[name] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); };
  N.on = function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); };
  if (desk && desk.on) ['back', 'window-focus'].forEach(function (ev) { desk.on(ev, function (d) { N._e(ev, d); }); });
  N.call = function (m, a, t) {
    if (isAndroid) return new Promise(function (resolve, reject) {
      var id = seq++; waiting[id] = { resolve: resolve, reject: reject };
      if (t) setTimeout(function () { if (waiting[id]) { delete waiting[id]; reject(new Error('timeout')); } }, t);
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'call', id: id, m: m, a: a || {} })); } catch (e) { delete waiting[id]; reject(e); }
    });
    if (desk) return desk.invoke(m, a || {});
    return Promise.reject(new Error('unsupported: ' + m));
  };
  setTimeout(function () { try { N.call('ready', {}).catch(function () {}); } catch (e) {} }, 0);

  var b64ToBuf = function (b64) { return fetch('data:application/octet-stream;base64,' + b64).then(function (r) { return r.arrayBuffer(); }); };
  var blobToB64 = function (blob) { return new Promise(function (res, rej) { var f = new FileReader(); f.onload = function () { res(String(f.result).split(',')[1] || ''); }; f.onerror = rej; f.readAsDataURL(blob); }); };

  /* اختيار ملف: kind = pdf | image */
  K.pick = function (kind) {
    var accept = kind === 'pdf' ? '.pdf,application/pdf' : kind === 'image' ? 'image/*' : '*/*';
    if (desk) return desk.invoke('pick-any', { kind: kind }).then(function (l) {
      return l ? l.map(function (f) { return { name: f.name, blob: new Blob([f.bytes], { type: f.type || '' }) }; }) : null; });
    if (isAndroid) return N.call('pickAny', { kind: kind }).then(async function (l) {
      if (!l || !l.length) return null; var out = [];
      for (var i = 0; i < l.length; i++) {
        var f = l[i], parts = [], off = 0, CH = 1024 * 1024;
        while (off < f.size) {
          var b64 = await N.call('readChunk', { uri: f.uri, offset: off, length: Math.min(CH, f.size - off) }, 120000);
          var buf = await b64ToBuf(b64); if (!buf.byteLength) throw new Error('read error'); parts.push(buf); off += buf.byteLength;
          if (K.onReadProgress) K.onReadProgress(off, f.size);
        }
        N.call('deleteFile', { uri: f.uri }).catch(function () {});
        out.push({ name: f.name, blob: new Blob(parts, { type: f.mime || '' }) });
      }
      return out; });
    return new Promise(function (resolve) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; inp.style.display = 'none'; document.body.appendChild(inp);
      var done = false;
      inp.onchange = function () { done = true; var f = inp.files && inp.files[0]; inp.remove(); resolve(f ? [{ name: f.name, blob: f }] : null); };
      window.addEventListener('focus', function onF() { window.removeEventListener('focus', onF); setTimeout(function () { if (!done) { inp.remove(); resolve(null); } }, 1500); });
      inp.click();
    });
  };

  /* حفظ ملف (docx / md) */
  K.save = async function (name, blob) {
    if (desk) { var bytes = new Uint8Array(await blob.arrayBuffer()); return desk.invoke('save-binary', { name: name, bytes: bytes }); }
    if (isAndroid) {
      var id = 's' + Date.now(), CH = 768 * 1024, off = 0;
      await N.call('saveStart', { id: id, name: name, mime: blob.type || 'application/octet-stream' });
      try {
        while (off < blob.size) { await N.call('saveChunk', { id: id, b64: await blobToB64(blob.slice(off, off + CH)) }, 120000); off += CH; }
        return await N.call('saveEnd', { id: id }, 120000);
      } catch (e) { N.call('saveAbort', { id: id }).catch(function () {}); throw e; }
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 4000); return true;
  };
  K.copy = async function (text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    var t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(t); t.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} t.remove(); return ok;
  };
  var awakeN = 0;
  K.awake = function (on) { awakeN = Math.max(0, awakeN + (on ? 1 : -1)); try { N.call('keepAwake', { on: awakeN > 0 }).catch(function () {}); } catch (e) {} };
})(window.K = window.K || {});

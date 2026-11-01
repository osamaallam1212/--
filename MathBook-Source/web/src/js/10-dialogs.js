/* نوافذ حوار داخل التطبيق (prompt/confirm لا تعمل في ويندوز Electron) + رسائل قصيرة */
(function (K) {
  var box;
  function mk(html) {
    if (!box) { box = document.createElement('div'); box.className = 'modal'; box.style.zIndex = 200; document.body.appendChild(box); }
    box.innerHTML = '<div class="mbox" style="max-width:520px;width:100%">' + html + '</div>'; box.classList.add('open'); return box;
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  K.confirm = function (msg, okOnly) {
    return new Promise(function (res) {
      var b = mk('<div style="font-weight:700;line-height:1.8;white-space:pre-wrap">' + esc(msg) + '</div><div class="row"><button class="btn btn-green" data-r="1">موافق</button>' + (okOnly ? '' : '<button class="btn btn-ghost" data-r="0">إلغاء</button>') + '</div>');
      b.onclick = function (e) { var r = e.target.dataset && e.target.dataset.r; if (r == null) return; b.classList.remove('open'); b.onclick = null; res(r === '1'); };
    });
  };
  K.ask = function (msg, def, multiline) {
    return new Promise(function (res) {
      var b = mk('<div style="font-weight:700;margin-bottom:8px">' + esc(msg) + '</div>' + (multiline ? '<textarea id="kAsk" style="min-height:120px;direction:rtl;font-family:inherit">' : '<input type="text" id="kAsk" style="width:100%">') + (multiline ? esc(def) + '</textarea>' : '') + '<div class="row"><button class="btn btn-green" data-r="1">حفظ</button><button class="btn btn-ghost" data-r="0">إلغاء</button></div>');
      var inp = b.querySelector('#kAsk'); if (!multiline) inp.value = def == null ? '' : def; setTimeout(function () { inp.focus(); inp.select && inp.select(); }, 50);
      b.onclick = function (e) { var r = e.target.dataset && e.target.dataset.r; if (r == null) return; var v = inp.value; b.classList.remove('open'); b.onclick = null; res(r === '1' ? v : null); };
    });
  };
  window.alert = function (m) { K.confirm(m, true); };
  var tt;
  K.toast = function (m) {
    var t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 2200);
  };
})(window.K = window.K || {});

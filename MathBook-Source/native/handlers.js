/* ============================================================
   أوامر الواجهة على أندرويد (الملفات، الإشعارات، النطق، الأذونات…)
   كل أمر يُرجع Promise، وتُرسل النتيجة إلى الواجهة بصيغة JSON
   ============================================================ */
const { BackHandler, Linking, PermissionsAndroid, StatusBar } = require("react-native");
const Notifications = require("expo-notifications");
const Speech = require("expo-speech");
const DocumentPicker = require("expo-document-picker");
const NavigationBar = require("expo-navigation-bar");
const KeepAwake = require("expo-keep-awake");
const { Asset } = require("expo-asset");
const FS = require("expo-file-system");
const ENGINE = require("./engineAssets");
const pkg = require("../package.json");

const { File, Directory, Paths } = FS;

/* ---------- base64 سريع (بدون مكتبات) ---------- */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LUT = new Uint8Array(64);
for (let i = 0; i < 64; i++) LUT[i] = B64.charCodeAt(i);
function toBase64(bytes) {
  const n = bytes.length;
  const out = new Uint8Array(Math.ceil(n / 3) * 4);
  let o = 0, i = 0;
  for (; i + 2 < n; i += 3) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out[o++] = LUT[(v >> 18) & 63]; out[o++] = LUT[(v >> 12) & 63]; out[o++] = LUT[(v >> 6) & 63]; out[o++] = LUT[v & 63];
  }
  if (i < n) {
    const v = (bytes[i] << 16) | ((i + 1 < n ? bytes[i + 1] : 0) << 8);
    out[o++] = LUT[(v >> 18) & 63]; out[o++] = LUT[(v >> 12) & 63];
    out[o++] = i + 1 < n ? LUT[(v >> 6) & 63] : 61; out[o++] = 61;
  }
  const parts = [];
  const CH = 0x2000;
  for (let k = 0; k < out.length; k += CH) parts.push(String.fromCharCode.apply(null, Array.from(out.subarray(k, k + CH))));
  return parts.join("");
}

/* ---------- أسماء الملفات من روابط أندرويد ---------- */
function nameFromUri(uri) {
  let s = String(uri || "").replace(/\/+$/, "");
  s = s.split("/").pop() || "";
  try { s = decodeURIComponent(s); } catch (e) { /* */ }
  s = s.split("/").pop();
  if (s.indexOf(":") >= 0) s = s.split(":").pop();
  return s;
}
function isHtmlName(n) { return /\.html?$/i.test(n || ""); }

async function listFolder(dir, rel, out, depth) {
  if (depth > 8 || out.length > 5000) return;
  let items = [];
  try { items = dir.list(); } catch (e) { return; }
  for (const it of items) {
    if (it instanceof Directory) {
      const dn = nameFromUri(it.uri);
      if (dn.startsWith(".")) continue;
      await listFolder(it, rel + dn + "/", out, depth + 1);
    } else {
      const n = nameFromUri(it.uri);
      let size = 0;
      try { size = it.size || 0; } catch (e) { /* */ }
      let html = isHtmlName(n);
      if (!html && !/\.[a-z0-9]{1,5}$/i.test(n)) { try { html = /html/i.test(it.type || ""); } catch (e) { /* */ } }
      out.push({ name: html && !isHtmlName(n) ? n + ".html" : n, path: rel + n, uri: it.uri, size, skip: !html });
    }
  }
}

/* بديل احتياطي بالواجهة القديمة لو الجديدة ما اشتغلتش */
async function legacyPickFolder() {
  const legacy = require("expo-file-system/legacy");
  const SAF = legacy.StorageAccessFramework;
  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  const out = [];
  async function walk(uri, rel, depth) {
    if (depth > 8) return;
    let list = [];
    try { list = await SAF.readDirectoryAsync(uri); } catch (e) { return; }
    for (const u of list) {
      const n = nameFromUri(u);
      if (isHtmlName(n)) out.push({ name: n, path: rel + n, uri: u, legacy: true });
      else if (n.indexOf(".") < 0) await walk(u, rel + n + "/", depth + 1);
      else out.push({ name: n, path: rel + n, uri: u, skip: true });
    }
  }
  await walk(perm.directoryUri, "", 0);
  return out;
}

/* ---------- قطع الملفات للواجهة ---------- */
const assetCache = {};
async function engineAsset(name) {
  if (assetCache[name]) return assetCache[name];
  const mod = ENGINE[name];
  if (!mod) throw new Error("engine asset missing: " + name);
  const a = Asset.fromModule(mod);
  await a.downloadAsync();
  const uri = a.localUri || a.uri;
  assetCache[name] = uri;
  return uri;
}

/* ---------- النطق بصوت الموبايل ---------- */
function splitForSpeech(text, max) {
  const out = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(text.length, pos + max);
    if (end < text.length) {
      const cut = Math.max(text.lastIndexOf(". ", end), text.lastIndexOf("! ", end), text.lastIndexOf("? ", end), text.lastIndexOf("\n", end));
      if (cut > pos + max / 3) end = cut + 1;
      else { const sp = text.lastIndexOf(" ", end); if (sp > pos + 20) end = sp + 1; }
    }
    out.push({ text: text.slice(pos, end), start: pos });
    pos = end;
  }
  return out;
}


function fromBase64(b64) {
  const clean = String(b64 || "").replace(/[^A-Za-z0-9+/]/g, "");
  const rev = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) rev[B64.charCodeAt(i)] = i;
  const n = Math.floor((clean.length * 3) / 4), out = new Uint8Array(n);
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = (buf << 6) | rev[clean.charCodeAt(i)]; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; buf &= (1 << bits) - 1; }
  }
  return out.subarray(0, o);
}

const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function createHandlers(ctx) {
  // ctx: { emit(name, data), setFullscreen(on), setChrome(c), setUA(ua) }
  const H = {};

  H.ready = async () => { ctx.onWebReady(); return true; };

  H.pickFiles = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ["text/html", "application/xhtml+xml", "*/*"], multiple: true, copyToCacheDirectory: true });
    if (!r || r.canceled || !r.assets) return null;
    return r.assets.map((a) => ({ name: a.name || nameFromUri(a.uri), path: a.name || nameFromUri(a.uri), uri: a.uri, size: a.size || 0 }));
  };

  H.pickFolder = async () => {
    let dir;
    try {
      dir = await Directory.pickDirectoryAsync();
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (/cancel/i.test(msg)) return null;
      return legacyPickFolder();
    }
    if (!dir) return null;
    const out = [];
    try { await listFolder(dir, "", out, 0); }
    catch (e) { return legacyPickFolder(); }
    return out;
  };

  H.readText = async ({ uri }) => {
    try {
      return await new File(uri).text();
    } catch (e) {
      const legacy = require("expo-file-system/legacy");
      return legacy.readAsStringAsync(uri);
    }
  };

  H.fileInfo = async ({ asset, uri }) => {
    const u = asset ? await engineAsset(asset) : uri;
    const f = new File(u);
    return { uri: u, size: f.size };
  };

  H.readChunk = async ({ uri, offset, length }) => {
    const f = new File(uri);
    const h = f.open(FS.FileMode ? FS.FileMode.ReadOnly : undefined);
    try {
      h.offset = offset;
      const bytes = h.readBytes(length);
      return toBase64(bytes);
    } finally {
      try { h.close(); } catch (e) { /* */ }
    }
  };

  H.deleteFile = async ({ uri }) => { try { new File(uri).delete(); } catch (e) { /* */ } return true; };

  H.download = async ({ id, url }) => {
    const dest = new File(Paths.cache, "kalimati-dl-" + id);
    try { if (dest.exists) dest.delete(); } catch (e) { /* */ }
    let last = 0;
    const f = await File.downloadFileAsync(url, dest, {
      idempotent: true,
      onProgress: (p) => {
        const now = Date.now();
        if (now - last > 250) { last = now; ctx.emit("download-progress", { id, done: p.bytesWritten, total: p.totalBytes }); }
      },
    });
    return { uri: f.uri, size: f.size };
  };

  /* ---------- الإشعارات ---------- */
  H.notifyPermission = async () => {
    const p = await Notifications.getPermissionsAsync();
    return p.granted || p.status === "granted" ? "granted" : p.canAskAgain === false ? "denied" : "undetermined";
  };
  H.requestNotifyPermission = async () => {
    const p = await Notifications.requestPermissionsAsync();
    return p.granted || p.status === "granted" ? "granted" : "denied";
  };
  H.notifySchedule = async ({ items }) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const p = await Notifications.getPermissionsAsync();
    if (!(p.granted || p.status === "granted")) return false;
    for (const it of items || []) {
      if (!it.at || it.at < Date.now() + 30000) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: String(it.id),
        content: { title: it.title, body: it.body, data: it.data || {}, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(it.at), channelId: "reminders" },
      });
    }
    return true;
  };
  H.notifyTest = async ({ title, body }) => {
    const p = await Notifications.getPermissionsAsync();
    if (!(p.granted || p.status === "granted")) {
      const r = await Notifications.requestPermissionsAsync();
      if (!(r.granted || r.status === "granted")) return false;
    }
    await Notifications.scheduleNotificationAsync({ content: { title, body, data: { page: "review" } }, trigger: null });
    return true;
  };

  /* ---------- الميكروفون ---------- */
  H.micPermission = async () => {
    const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return ok ? "granted" : "undetermined";
  };
  H.requestMicPermission = async () => {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return r === PermissionsAndroid.RESULTS.GRANTED ? "granted" : "denied";
  };

  /* ---------- النطق ---------- */
  H.ttsVoices = async () => {
    let list = [];
    for (let i = 0; i < 4; i++) {
      try { list = await Speech.getAvailableVoicesAsync(); } catch (e) { list = []; }
      if (list && list.length) break;
      await new Promise((r) => setTimeout(r, 700));
    }
    return (list || []).map((v) => ({ identifier: v.identifier, name: v.name, language: v.language, quality: v.quality }));
  };
  H.ttsSpeak = async ({ id, text, voice, language, rate, pitch, volume }) => {
    const max = (Speech.maxSpeechInputLength || 4000) - 100;
    const parts = splitForSpeech(String(text || ""), Math.max(500, max));
    if (!parts.length) { ctx.emit("tts", { id, type: "start" }); ctx.emit("tts", { id, type: "done" }); return true; }
    parts.forEach((p, i) => {
      const last = i === parts.length - 1;
      Speech.speak(p.text, {
        voice: voice || undefined, language: language || "en-US", rate: rate || 1, pitch: pitch || 1, volume: volume == null ? 1 : volume,
        onStart: () => { if (i === 0) ctx.emit("tts", { id, type: "start" }); },
        onBoundary: (e) => { if (e && typeof e.charIndex === "number") ctx.emit("tts", { id, type: "boundary", charIndex: p.start + e.charIndex, charLength: e.charLength || 0 }); },
        onDone: () => { if (last) ctx.emit("tts", { id, type: "done" }); },
        onStopped: () => { if (i === 0 || last) ctx.emit("tts", { id, type: "stopped" }); },
        onError: () => ctx.emit("tts", { id, type: "error" }),
      });
    });
    return true;
  };
  H.ttsStop = async () => { await Speech.stop(); return true; };

  /* ---------- الشاشة ---------- */
  H.setFullscreen = async ({ on }) => { ctx.setFullscreen(!!on); return true; };
  H.setChrome = async (c) => { ctx.setChrome(c || {}); return true; };
  H.keepAwake = async ({ on }) => {
    try { if (on) await KeepAwake.activateKeepAwakeAsync("lesson"); else KeepAwake.deactivateKeepAwake("lesson"); } catch (e) { /* */ }
    return true;
  };
  H.setDesktopUA = async ({ on }) => { ctx.setUA(on ? DESKTOP_UA : undefined); return true; };
  H.openExternal = async ({ url }) => { if (/^(https?|mailto|tel):/i.test(url)) await Linking.openURL(url); return true; };
  H.exitApp = async () => { BackHandler.exitApp(); return true; };
  H.appInfo = async () => ({ version: pkg.version, platform: "android" });

  /* ---------- كتاب الرياضيات: اختيار ملف + حفظ ملف ثنائي (docx / md) ---------- */
  H.pickAny = async ({ kind }) => {
    const type = kind === "pdf" ? ["application/pdf"] : kind === "image" ? ["image/*"] : ["*/*"];
    const r = await DocumentPicker.getDocumentAsync({ type, multiple: false, copyToCacheDirectory: true });
    if (!r || r.canceled || !r.assets || !r.assets.length) return null;
    return r.assets.map((a) => ({ name: a.name || nameFromUri(a.uri), uri: a.uri, size: a.size || new File(a.uri).size || 0, mime: a.mimeType || "" }));
  };
  const saves = {};
  H.saveStart = async ({ id, name, mime }) => { saves[id] = { name, mime: mime || "application/octet-stream", parts: [], len: 0 }; return true; };
  H.saveChunk = async ({ id, b64 }) => {
    const s = saves[id]; if (!s) throw new Error("save session lost");
    const bytes = fromBase64(b64); s.parts.push(bytes); s.len += bytes.length; return true;
  };
  H.saveAbort = async ({ id }) => { delete saves[id]; return true; };
  H.saveEnd = async ({ id }) => {
    const s = saves[id]; if (!s) throw new Error("save session lost");
    delete saves[id];
    const all = new Uint8Array(s.len); let o = 0;
    for (const p of s.parts) { all.set(p, o); o += p.length; }
    let dir;
    try { dir = await Directory.pickDirectoryAsync(); } catch (e) { return false; }
    if (!dir) return false;
    let name = s.name, k = 1;
    const base = name.replace(/(\.[^.]*)?$/, ""), ext = (name.match(/\.[^.]*$/) || [""])[0];
    // لو في ملف بنفس الاسم نغيّر الاسم بدل ما نفشل
    for (;;) {
      try { const f = dir.createFile(name, s.mime); f.write(all); return true; }
      catch (e) { if (++k > 50) throw e; name = base + " (" + k + ")" + ext; }
    }
  };

  /* ---------- النسخ الاحتياطي ---------- */
  H.saveTextFile = async ({ name, text }) => {
    let dir;
    try { dir = await Directory.pickDirectoryAsync(); } catch (e) { return false; }
    if (!dir) return false;
    const f = dir.createFile(name, "application/json");
    f.write(text);
    return true;
  };
  H.openTextFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
    if (!r || r.canceled || !r.assets || !r.assets[0]) return null;
    return new File(r.assets[0].uri).text();
  };

  return H;
}

async function applyBars(fullscreen) {
  try { StatusBar.setHidden(!!fullscreen, "fade"); } catch (e) { /* */ }
  // الواجهة الحديثة (setHidden) إن وُجدت، وإلا القديمة
  try {
    if (typeof NavigationBar.setHidden === "function") NavigationBar.setHidden(!!fullscreen);
    else await NavigationBar.setVisibilityAsync(fullscreen ? "hidden" : "visible");
  } catch (e) {
    try { await NavigationBar.setVisibilityAsync(fullscreen ? "hidden" : "visible"); } catch (e2) { /* */ }
  }
  // عند ظهور الأشرطة بالسحب تختفي تلقائياً بعد لحظات
  if (fullscreen) { try { if (typeof NavigationBar.setBehaviorAsync === "function") await NavigationBar.setBehaviorAsync("overlay-swipe"); } catch (e) { /* */ } }
}

module.exports = { createHandlers, applyBars, DESKTOP_UA };

/* ============================================================
   كلماتي — نسخة ويندوز (Electron)
   ============================================================ */
const { app, BrowserWindow, dialog, ipcMain, session, shell, Notification, protocol, Tray, Menu, nativeImage, systemPreferences, powerSaveBlocker } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const http = require("node:http");
const { URL } = require("node:url");

const SCHEME = "mathbook";
const ORIGIN = SCHEME + "://app/";
const startHidden = process.argv.includes("--hidden");

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());
}

app.setAppUserModelId("com.mathbook.word");
app.setName("MathBook Word");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling");
// أقصى استفادة من الجهاز: كرت الشاشة + عدم تقليل أولوية العملية في الخلفية + ذاكرة أكبر للرسم
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=8192");

let win = null;
let tray = null;
let quitting = false;
let backgroundMode = false;
let blocker = null;

function rendererRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, "renderer") : path.resolve(__dirname, "../dist");
}
function dataFile(name) { return path.join(app.getPath("userData"), name); }
function readJson(name, def) { try { return JSON.parse(fs.readFileSync(dataFile(name), "utf8")); } catch { return def; } }
function writeJson(name, v) { try { fs.writeFileSync(dataFile(name), JSON.stringify(v)); } catch { /* تحسين فقط */ } }
const dlDir = () => path.join(app.getPath("temp"), "kalimati-dl");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".wasm": "application/wasm", ".data": "application/octet-stream",
  ".png": "image/png", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

function registerProtocol() {
  protocol.handle(SCHEME, async (request) => {
    try {
      const u = new URL(request.url);
      let rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
      let base = rendererRoot();
      if (rel.startsWith("__dl/")) { base = dlDir(); rel = rel.slice(5); }
      if (!rel) rel = "index.html";
      const file = path.resolve(base, rel);
      if (!file.startsWith(path.resolve(base))) return new Response("Forbidden", { status: 403 });
      const data = await fs.promises.readFile(file);
      return new Response(data, { status: 200, headers: { "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

/* ---------------- النافذة ---------------- */
function windowState() { return readJson("window.json", { width: 1200, height: 820, maximized: false }); }
function saveWindowState() {
  if (!win || win.isDestroyed() || win.isFullScreen()) return;
  const b = win.getNormalBounds();
  writeJson("window.json", { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() });
}

function chromeColors() { return readJson("chrome.json", { bg: "#f7f8fc", fg: "#141b2d", dark: false }); }

function createWindow() {
  const st = windowState();
  const c = chromeColors();
  const iconPath = path.join(rendererRoot(), "icon.png");
  win = new BrowserWindow({
    x: st.x, y: st.y, width: st.width || 1200, height: st.height || 820, minWidth: 380, minHeight: 520,
    show: false, backgroundColor: c.bg, title: "Math Book to Word", autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    titleBarStyle: "hidden",
    titleBarOverlay: { color: c.bg, symbolColor: c.fg, height: 36 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      spellcheck: false, backgroundThrottling: false, autoplayPolicy: "no-user-gesture-required",
    },
  });
  Menu.setApplicationMenu(null);
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});

  win.once("ready-to-show", () => {
    if (startHidden && backgroundMode) return;
    if (st.maximized) win.maximize();
    win.show();
  });
  ["resize", "move"].forEach((ev) => win.on(ev, debounce(saveWindowState, 500)));
  win.on("maximize", saveWindowState);
  win.on("unmaximize", saveWindowState);
  win.on("enter-full-screen", () => send("fullscreen-changed", { on: true }));
  win.on("leave-full-screen", () => send("fullscreen-changed", { on: false }));
  win.on("close", (e) => {
    saveWindowState();
    if (backgroundMode && !quitting) { e.preventDefault(); win.hide(); }
  });
  win.on("closed", () => { win = null; });
  win.on("focus", () => send("window-focus", {}));
  // زر الرجوع في الماوس (Windows)
  win.on("app-command", (e, cmd) => { if (cmd === "browser-backward") send("back", { source: "mouse" }); });

  win.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && input.control && input.shift && (input.key === "I" || input.key === "i")) {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(ORIGIN)) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("render-process-gone", () => { setTimeout(() => { if (win && !win.isDestroyed()) win.reload(); }, 800); });
  win.loadURL(ORIGIN + "index.html");
}

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function send(ch, data) { if (win && !win.isDestroyed()) win.webContents.send(ch, data); }
function debounce(fn, ms) { let t = null; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* ---------------- الخلفية + الأيقونة جنب الساعة ---------------- */
function setBackgroundMode(on) {
  backgroundMode = !!on;
  writeJson("background.json", { on: backgroundMode });
  try {
    app.setLoginItemSettings({ openAtLogin: backgroundMode, args: backgroundMode ? ["--hidden"] : [] });
  } catch { /* بعض الأجهزة لا تسمح */ }
  if (backgroundMode && !tray) {
    const iconPath = path.join(rendererRoot(), "icon.png");
    const img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }) : nativeImage.createEmpty();
    tray = new Tray(img);
    tray.setToolTip("كلماتي");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "فتح كلماتي", click: () => showWindow() },
      { label: "المراجعة", click: () => { showWindow(); send("open-page", { page: "review" }); } },
      { type: "separator" },
      { label: "خروج", click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on("click", () => showWindow());
  } else if (!backgroundMode && tray) {
    tray.destroy();
    tray = null;
  }
}

/* ---------------- التذكيرات ---------------- */
let reminders = [];
function loadReminders() { reminders = readJson("reminders.json", []); }
function saveReminders() { writeJson("reminders.json", reminders); }
function tickReminders() {
  const now = Date.now();
  let changed = false;
  reminders.forEach((r) => {
    if (r.shown || r.at > now) return;
    r.shown = true;
    changed = true;
    if (now - r.at > 12 * 3600 * 1000) return; // فات عليه وقت طويل
    showNotification(r.title, r.body, r.data);
  });
  if (changed) saveReminders();
}
function showNotification(title, body, data) {
  if (!Notification.isSupported()) return;
  const iconPath = path.join(rendererRoot(), "icon.png");
  const n = new Notification({ title, body, icon: fs.existsSync(iconPath) ? iconPath : undefined, silent: false });
  n.on("click", () => { showWindow(); send("notification-click", data || {}); });
  n.show();
}

/* ---------------- قراءة الملفات ---------------- */
async function readHtml(file) {
  let t = await fs.promises.readFile(file, "utf8");
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return t;
}
async function walk(dir, rel, out, depth) {
  if (depth > 12 || out.length > 6000) return;
  let ents = [];
  try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
  ents.sort((a, b) => a.name.localeCompare(b.name, "ar", { numeric: true }));
  for (const e of ents) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, rel + e.name + "/", out, depth + 1);
    else if (e.isFile()) {
      if (/\.html?$/i.test(e.name)) {
        try { out.push({ name: e.name, path: rel + e.name, text: await readHtml(full) }); }
        catch (err) { out.push({ name: e.name, path: rel + e.name, error: String(err.message || err) }); }
      } else out.push({ name: e.name, path: rel + e.name, skip: true });
    }
  }
}

/* ---------------- تنزيل (لو المتصفح منعه) ---------------- */
const downloads = new Map();
function download(id, url, file, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, { headers: { "user-agent": "Kalimati/1.0" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 8) {
        res.resume();
        resolve(download(id, new URL(res.headers.location, url).toString(), file, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error("HTTP " + res.statusCode)); return; }
      const total = Number(res.headers["content-length"]) || 0;
      let done = 0, last = 0;
      const out = fs.createWriteStream(file);
      res.on("data", (c) => {
        done += c.length;
        const now = Date.now();
        if (now - last > 200) { last = now; send("download-progress", { id, done, total }); }
      });
      res.pipe(out);
      out.on("finish", () => { send("download-progress", { id, done, total: total || done }); resolve(file); });
      out.on("error", reject);
      res.on("error", reject);
    });
    downloads.set(id, req);
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error("timeout")));
  });
}

/* ---------------- الأوامر من الواجهة ---------------- */
function handle(name, fn) { ipcMain.handle(name, async (_e, args) => fn(args || {})); }

handle("ready", () => true);
handle("pick-files", async () => {
  const r = await dialog.showOpenDialog(win, {
    title: "اختيار ملفات الامتحانات", properties: ["openFile", "multiSelections"],
    filters: [{ name: "HTML", extensions: ["html", "htm"] }, { name: "كل الملفات", extensions: ["*"] }],
  });
  if (r.canceled || !r.filePaths.length) return null;
  const out = [];
  for (const f of r.filePaths) {
    const name = path.basename(f);
    if (!/\.html?$/i.test(name)) { out.push({ name, path: name, skip: true }); continue; }
    try { out.push({ name, path: name, text: await readHtml(f) }); } catch (e) { out.push({ name, path: name, error: String(e.message || e) }); }
  }
  return out;
});
handle("pick-folder", async () => {
  const r = await dialog.showOpenDialog(win, { title: "اختيار مجلد الامتحانات", properties: ["openDirectory"] });
  if (r.canceled || !r.filePaths.length) return null;
  const out = [];
  await walk(r.filePaths[0], "", out, 0);
  return out;
});
handle("setFullscreen", ({ on }) => { if (win) win.setFullScreen(!!on); return true; });
handle("setChrome", ({ bg, fg, dark }) => {
  writeJson("chrome.json", { bg, fg, dark });
  if (win && !win.isDestroyed()) {
    try { win.setTitleBarOverlay({ color: bg, symbolColor: fg, height: 36 }); } catch { /* */ }
    win.setBackgroundColor(bg);
  }
  return true;
});
handle("openExternal", ({ url }) => { if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url); return true; });
handle("appInfo", () => ({ version: app.getVersion(), platform: process.platform, electron: process.versions.electron }));
handle("exitApp", () => { quitting = true; app.quit(); return true; });
handle("keepAwake", ({ on }) => {
  if (on && blocker == null) blocker = powerSaveBlocker.start("prevent-display-sleep");
  if (!on && blocker != null) { powerSaveBlocker.stop(blocker); blocker = null; }
  return true;
});
handle("notifyPermission", () => (Notification.isSupported() ? "granted" : "denied"));
handle("requestNotifyPermission", () => (Notification.isSupported() ? "granted" : "denied"));
handle("notifySchedule", ({ items }) => {
  const shownKeys = new Set(reminders.filter((r) => r.shown).map((r) => r.id + ":" + r.at));
  reminders = (items || []).map((it) => ({ id: it.id, at: it.at, title: it.title, body: it.body, data: it.data, shown: shownKeys.has(it.id + ":" + it.at) }));
  saveReminders();
  return true;
});
handle("notifyTest", ({ title, body }) => { showNotification(title || "كلماتي", body || "", { page: "review" }); return true; });
handle("setBackgroundMode", ({ on }) => { setBackgroundMode(on); return true; });
handle("micPermission", () => {
  try { return systemPreferences.getMediaAccessStatus("microphone") === "granted" ? "granted" : "denied"; } catch { return "unknown"; }
});
handle("download", async ({ id, url }) => {
  await fs.promises.mkdir(dlDir(), { recursive: true });
  const file = path.join(dlDir(), id);
  await download(id, url, file);
  return { localUrl: ORIGIN + "__dl/" + id };
});
handle("download-cleanup", async ({ id }) => {
  downloads.delete(id);
  try { await fs.promises.unlink(path.join(dlDir(), id)); } catch { /* */ }
  return true;
});
handle("pick-any", async ({ kind }) => {
  const filters = kind === "pdf" ? [{ name: "PDF", extensions: ["pdf"] }] : kind === "image" ? [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }] : [{ name: "All", extensions: ["*"] }];
  const r = await dialog.showOpenDialog(win, { title: kind === "pdf" ? "اختيار كتاب PDF" : "اختيار صورة", properties: ["openFile"], filters });
  if (r.canceled || !r.filePaths.length) return null;
  const f = r.filePaths[0];
  const bytes = new Uint8Array(await fs.promises.readFile(f));
  return [{ name: path.basename(f), bytes }];
});
handle("save-binary", async ({ name, bytes }) => {
  const ext = path.extname(name).replace(".", "") || "*";
  const r = await dialog.showSaveDialog(win, { title: "حفظ الملف", defaultPath: path.join(app.getPath("documents"), name), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return false;
  await fs.promises.writeFile(r.filePath, Buffer.from(bytes));
  return true;
});
handle("saveTextFile", async ({ name, text }) => {
  const r = await dialog.showSaveDialog(win, { title: "حفظ نسخة احتياطية", defaultPath: path.join(app.getPath("documents"), name), filters: [{ name: "JSON", extensions: ["json"] }] });
  if (r.canceled || !r.filePath) return false;
  await fs.promises.writeFile(r.filePath, text, "utf8");
  return true;
});
handle("openTextFile", async () => {
  const r = await dialog.showOpenDialog(win, { title: "استرجاع نسخة احتياطية", properties: ["openFile"], filters: [{ name: "JSON", extensions: ["json"] }] });
  if (r.canceled || !r.filePaths.length) return null;
  return fs.promises.readFile(r.filePaths[0], "utf8");
});

/* ---------------- التشغيل ---------------- */
app.whenReady().then(() => {
  registerProtocol();
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));
  ses.setPermissionCheckHandler(() => true);
  try { ses.setSpellCheckerEnabled(false); } catch { /* */ }
  loadReminders();
  const bg = readJson("background.json", { on: false });
  if (bg.on) setBackgroundMode(true);
  createWindow();
  setInterval(tickReminders, 30000);
  setTimeout(tickReminders, 5000);
});

app.on("before-quit", () => { quitting = true; saveWindowState(); });
app.on("window-all-closed", () => { if (!backgroundMode) app.quit(); });
app.on("activate", () => showWindow());

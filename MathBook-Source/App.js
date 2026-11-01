/* ============================================================
   كتاب الرياضيات إلى Word — نسخة أندرويد
   التطبيق كله واجهة واحدة (هي نفسها واجهة الحاسوب) داخل WebView بملء الشاشة،
   والأوامر التي تحتاج إلى الهاتف نفسه (ملفات، إشعارات، نطق، أذونات…) في native/handlers.js
   ============================================================ */
const React = require("react");
const { useRef, useEffect, useState, useCallback } = React;
const { View, StatusBar, BackHandler, AppState, Linking, StyleSheet } = require("react-native");
const { WebView } = require("react-native-webview");
const { SafeAreaProvider, useSafeAreaInsets } = require("react-native-safe-area-context");
const Notifications = require("expo-notifications");
const SplashScreen = require("expo-splash-screen");
const { createHandlers, applyBars, DESKTOP_UA } = require("./native/handlers");
const SHELL_HTML = require("./native/shellHtml");

const BASE_URL = "https://mathbook.app/";
const h = React.createElement;

try { SplashScreen.preventAutoHideAsync().catch(() => {}); } catch (e) { /* */ }

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
} catch (e) { /* */ }

function Shell() {
  const web = useRef(null);
  const ready = useRef(false);
  const queue = useRef([]);
  const fullscreen = useRef(false);
  const insets = useSafeAreaInsets();
  const [bg, setBg] = useState("#f7f8fc");
  const [dark, setDark] = useState(false);
  const [ua, setUA] = useState(DESKTOP_UA);
  const [key, setKey] = useState(1);
  const [hidden, setHidden] = useState(false);

  const inject = useCallback((js) => {
    if (web.current) web.current.injectJavaScript(js + ";true;");
  }, []);

  const emit = useCallback((name, data) => {
    const js = "window.K&&K.native&&K.native._e(" + JSON.stringify(name) + "," + JSON.stringify(data == null ? null : data) + ")";
    if (!ready.current) { queue.current.push(js); return; }
    inject(js);
  }, [inject]);

  const handlers = useRef(null);
  if (!handlers.current) {
    handlers.current = createHandlers({
      emit: (n, d) => emit(n, d),
      onWebReady: () => {
        ready.current = true;
        const q = queue.current; queue.current = [];
        q.forEach((js) => inject(js));
        Notifications.getLastNotificationResponseAsync().then((r) => {
          if (r && r.notification) emit("notification-click", (r.notification.request.content.data) || {});
        }).catch(() => {});
      },
      setFullscreen: (on) => { fullscreen.current = on; setHidden(on); applyBars(on); },
      setChrome: (c) => { if (c.bg) setBg(c.bg); setDark(!!c.dark); },
      setUA: (v) => setUA(v),
    });
  }

  /* أوامر من الواجهة */
  const onMessage = useCallback(async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.nativeEvent.data); } catch (e) { return; }
    if (!msg || msg.t !== "call") return;
    const fn = handlers.current[msg.m];
    let ok = true, payload;
    try {
      if (!fn) throw new Error("unknown call " + msg.m);
      payload = await fn(msg.a || {});
    } catch (e) {
      ok = false;
      payload = { message: String((e && e.message) || e) };
    }
    inject("window.K&&K.native&&K.native._r(" + JSON.stringify(msg.id) + "," + (ok ? "true" : "false") + "," + JSON.stringify(payload === undefined ? null : payload) + ")");
  }, [inject]);

  /* زر الرجوع في الموبايل → الواجهة هي اللي بتقرر */
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!ready.current) return false;
      emit("back", { source: "android" });
      return true;
    });
    return () => sub.remove();
  }, [emit]);

  /* الإشعارات */
  useEffect(() => {
    Notifications.setNotificationChannelAsync("reminders", {
      name: "التذكيرات", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 120, 200], lightColor: "#4c6ef5",
    }).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      emit("notification-click", (r && r.notification && r.notification.request.content.data) || {});
    });
    return () => sub.remove();
  }, [emit]);

  /* العودة إلى التطبيق: إعادة ملء الشاشة والتحديث */
  useEffect(() => {
    applyBars(fullscreen.current);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") { applyBars(fullscreen.current); emit("resume", {}); }
    });
    return () => sub.remove();
  }, [emit]);

  /* إذا ظهرت أشرطة النظام بالسحب أثناء ملء الشاشة، تُخفى مرة أخرى بعد لحظات */
  useEffect(() => {
    let t = null, sub = null;
    try {
      const NavigationBar = require("expo-navigation-bar");
      if (typeof NavigationBar.addVisibilityListener === "function") {
        sub = NavigationBar.addVisibilityListener((ev) => {
          if (!fullscreen.current || !ev || ev.visibility !== "visible") return;
          clearTimeout(t);
          t = setTimeout(() => { if (fullscreen.current) applyBars(true); }, 2800);
        });
      }
    } catch (e) { /* */ }
    return () => { clearTimeout(t); try { sub && sub.remove(); } catch (e) { /* */ } };
  }, []);

  /* مقاسات الأماكن المحجوزة (الكاميرا/الحواف) */
  useEffect(() => {
    emit("insets", { sat: Math.round(insets.top), sab: Math.round(insets.bottom), sal: Math.round(insets.left), sar: Math.round(insets.right) });
  }, [insets.top, insets.bottom, insets.left, insets.right, emit]);

  const onShouldStart = useCallback((req) => {
    const u = req.url || "";
    if (u.indexOf(BASE_URL) === 0 || /^(about:|blob:|data:)/i.test(u)) return true;
    if (req.isTopFrame === false) return true;
    if (/^(https?|mailto|tel):/i.test(u)) { Linking.openURL(u).catch(() => {}); return false; }
    return false;
  }, []);

  const onLoadEnd = useCallback(() => {
    setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 150);
  }, []);
  useEffect(() => { const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 5000); return () => clearTimeout(t); }, []);

  const onCrash = useCallback(() => {
    ready.current = false;
    setKey((k) => k + 1);
  }, []);

  return h(View, { style: [styles.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }] },
    h(StatusBar, { hidden, translucent: true, backgroundColor: "transparent", barStyle: dark ? "light-content" : "dark-content" }),
    h(WebView, {
      key,
      ref: web,
      source: { html: SHELL_HTML, baseUrl: BASE_URL },
      originWhitelist: ["*"],
      style: [styles.web, { backgroundColor: bg }],
      containerStyle: { backgroundColor: bg },
      javaScriptEnabled: true,
      domStorageEnabled: true,
      allowFileAccess: true,
      allowFileAccessFromFileURLs: true,
      allowUniversalAccessFromFileURLs: true,
      mediaPlaybackRequiresUserAction: false,
      allowsInlineMediaPlayback: true,
      allowsFullscreenVideo: true,
      mixedContentMode: "always",
      setSupportMultipleWindows: false,
      javaScriptCanOpenWindowsAutomatically: false,
      textZoom: 100,
      overScrollMode: "never",
      setBuiltInZoomControls: false,
      setDisplayZoomControls: false,
      cacheEnabled: true,
      // بدون طبقة إضافية: WebView يرسم مباشرة على معالج الرسوميات (الطبقة الإضافية تسبب تقطيعاً)
      androidLayerType: "none",
      nestedScrollEnabled: false,
      webviewDebuggingEnabled: true,
      userAgent: ua,
      onMessage,
      onShouldStartLoadWithRequest: onShouldStart,
      onLoadEnd,
      onRenderProcessGone: onCrash,
      onContentProcessDidTerminate: onCrash,
    }));
}

function App() {
  return h(SafeAreaProvider, null, h(Shell));
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  web: { flex: 1 },
});

module.exports = App;
module.exports.default = App;

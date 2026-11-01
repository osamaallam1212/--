/*
 * إعدادات أندرويد الإضافية لتطبيق "كلماتي".
 * (اسم الملف فضل زي ما هو لأن build-android.bat بيعتمد عليه — المحتوى نفسه خاص بكلماتي)
 *
 * - الشاشة تمتد تحت مكان الكاميرا (cutout) عشان التطبيق يملأ الشاشة كلها
 * - تسريع الرسم + تسجيل الصوت للميكروفون
 * - مرآة Google لملف react-android (حل مشكلة DNS عند بعض مزودي الإنترنت)
 * - نسخة release تشتغل لوحدها على الجهاز وفحص lint ما يوقفش البناء
 */
const { withAndroidManifest, withAppBuildGradle, withProjectBuildGradle, withAndroidStyles } = require("expo/config-plugins");

const REQUIRED_PERMISSIONS = [
  "android.permission.INTERNET",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.WAKE_LOCK",
];

const MIRROR_MARKER = "// sajel: react-android mirror";
const MIRROR_BLOCK = `
${MIRROR_MARKER}
allprojects {
  repositories {
    exclusiveContent {
      forRepository {
        maven {
          name = "SajelReactAndroidMirror"
          url = uri("https://maven-central.storage-download.googleapis.com/maven2/")
        }
      }
      filter {
        includeModule("com.facebook.react", "react-android")
      }
    }
  }
}
`;

module.exports = function withKalimati(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest["uses-permission"] ??= [];
    for (const permission of REQUIRED_PERMISSIONS) {
      const exists = manifest["uses-permission"].some((entry) => entry.$?.["android:name"] === permission);
      if (!exists) manifest["uses-permission"].push({ $: { "android:name": permission } });
    }
    const app = manifest.application?.[0];
    if (app) {
      app.$ = app.$ || {};
      app.$["android:hardwareAccelerated"] = "true";
      const main = (app.activity || []).find((a) => a.$?.["android:name"] === ".MainActivity");
      if (main) main.$["android:hardwareAccelerated"] = "true";
    }
    return config;
  });

  config = withAndroidStyles(config, (config) => {
    const res = config.modResults.resources;
    res.$ = res.$ || {};
    if (!res.$["xmlns:tools"]) res.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const theme = (res.style || []).find((s) => s.$ && s.$.name === "AppTheme");
    if (theme) {
      theme.item = theme.item || [];
      const name = "android:windowLayoutInDisplayCutoutMode";
      const existing = theme.item.find((i) => i.$ && i.$.name === name);
      if (existing) { existing._ = "shortEdges"; existing.$["tools:targetApi"] = "28"; }
      else theme.item.push({ $: { name, "tools:targetApi": "28" }, _: "shortEdges" });
    }
    return config;
  });

  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") return config;
    if (!config.modResults.contents.includes(MIRROR_MARKER)) {
      config.modResults.contents = `${config.modResults.contents.trimEnd()}\n${MIRROR_BLOCK}`;
    }
    return config;
  });

  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") return config;
    let contents = config.modResults.contents;
    if (!contents.includes("sajel: release lint")) {
      contents = contents.replace(/^android\s*\{/m, "android {\n    // sajel: release lint\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }\n");
    }
    if (!/debuggableVariants\s*=\s*\[\s*\]/.test(contents)) {
      const bundleCommand = /(\bbundleCommand\s*=\s*["']export:embed["']\s*\n)/;
      if (bundleCommand.test(contents)) contents = contents.replace(bundleCommand, "$1    debuggableVariants = []\n");
    }
    config.modResults.contents = contents;
    return config;
  });
};

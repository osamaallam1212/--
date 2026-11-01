const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

// نبني واجهة التطبيق (web/src) قبل التجميع، عشان أي تعديل فيها يدخل في نسخة أندرويد تلقائياً
try {
  require("./scripts/build-shell.cjs").build({ quiet: true });
} catch (e) {
  console.warn("[kalimati] shell build skipped:", e && e.message);
}

const config = getDefaultConfig(__dirname);

// ملفات محرك الأصوات (wasm وغيرها) بتتحفظ جوه التطبيق بامتداد .bin
if (!config.resolver.assetExts.includes("bin")) config.resolver.assetExts.push("bin");

// مجلدات المشروع اللي Metro مش محتاجها (مسارات كاملة عشان ما نأثرش على أي مكتبة)
function dirRegex(rel) {
  const abs = path.resolve(__dirname, rel).replace(/[\\/]+/g, "/");
  const esc = abs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "[\\\\/]");
  return new RegExp("^" + esc + "[\\\\/].*$");
}
const prev = config.resolver.blockList;
config.resolver.blockList = [].concat(prev ? (Array.isArray(prev) ? prev : [prev]) : [], [
  dirRegex("desktop/node_modules"),
  dirRegex("dist"),
  dirRegex("artifacts"),
  dirRegex("web/lib"),
  dirRegex("web/src"),
]);

module.exports = config;

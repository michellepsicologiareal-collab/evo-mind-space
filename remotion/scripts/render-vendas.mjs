import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stills = process.argv.includes("--stills");
const bundled = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c) => c });
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});
const composition = await selectComposition({ serveUrl: bundled, id: "vendas", puppeteerInstance: browser });
if (stills) {
  const frames = process.argv[process.argv.indexOf("--stills") + 1].split(",").map(Number);
  for (const f of frames) {
    await renderStill({ composition, serveUrl: bundled, frame: f, output: `/tmp/still-${f}.png`, puppeteerInstance: browser, overwrite: true });
    console.log("still", f);
  }
} else {
  await renderMedia({
    composition, serveUrl: bundled, codec: "h264",
    outputLocation: "/tmp/vendas-mudo.mp4",
    puppeteerInstance: browser, muted: true, concurrency: 2,
    onProgress: ({ progress }) => { if (Math.round(progress * 100) % 10 === 0) console.log("progress", Math.round(progress * 100)); },
  });
}
await browser.close({ silent: false });
console.log("DONE");

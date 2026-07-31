#!/usr/bin/env node
/**
 * Auditoria de responsividade (regressões de corte/sobreposição).
 *
 * Uso:
 *   node scripts/responsive-audit.mjs                  # audita /app/agenda
 *   node scripts/responsive-audit.mjs /app/pacientes   # audita outra rota
 *
 * Requisitos: dev server em http://localhost:8080 e Playwright disponível.
 * Sessão autenticada opcional via LOVABLE_BROWSER_SUPABASE_* (injetada no sandbox).
 *
 * Saída: relatório por largura/visualização + screenshots em /tmp/responsive-audit.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const ROUTE = process.argv[2] || "/app/agenda";
const BASE = process.env.AUDIT_BASE_URL || "http://localhost:8080";
const OUT = "/tmp/responsive-audit";

// Checklist oficial de breakpoints do PsiReal
const WIDTHS = [
  { w: 320, label: "mobile mínimo (iPhone SE 1)" },
  { w: 360, label: "Android comum" },
  { w: 375, label: "iPhone SE/13 mini" },
  { w: 390, label: "iPhone 14/15" },
  { w: 414, label: "iPhone Plus" },
  { w: 430, label: "iPhone Pro Max" },
  { w: 640, label: "sm (Tailwind)" },
  { w: 768, label: "md / tablet retrato" },
  { w: 820, label: "iPad Air" },
  { w: 1024, label: "lg / tablet paisagem" },
];

const TABS = ["Dia", "Semana", "Mês"];

const PROBE = () => {
  const vw = window.innerWidth;
  const pageScrolls = document.documentElement.scrollWidth > vw + 1;
  const out = { docW: document.documentElement.scrollWidth, vw, pageScrolls, offenders: [] };
  const scrollableAncestor = (n) => {
    while (n && n !== document.body) {
      const s = getComputedStyle(n);
      if (/auto|scroll|hidden/.test(s.overflowX)) return true;
      n = n.parentElement;
    }
    return false;
  };
  document.querySelectorAll("main *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const st = getComputedStyle(el);
    if (st.position === "fixed") return;
    // corte real: texto/controle cortado sem container rolável e com a página estourando
    const bleeds = r.right > vw + 1 || r.left < -1;
    if (bleeds && pageScrolls && !scrollableAncestor(el.parentElement)) {
      out.offenders.push({
        type: "overflow",
        tag: el.tagName,
        cls: String(el.className || "").slice(0, 90),
        text: (el.innerText || "").trim().slice(0, 50),
      });
    }
    // conteúdo truncado sem ellipsis nem scroll (folhas apenas)
    if (
      el.children.length === 0 &&
      el.scrollWidth > el.clientWidth + 2 &&
      st.overflow === "visible" &&
      st.textOverflow !== "ellipsis"
    ) {
      out.offenders.push({
        type: "clipped",
        tag: el.tagName,
        cls: String(el.className || "").slice(0, 90),
        text: (el.innerText || "").trim().slice(0, 50),
      });
    }
  });
  return out;
};

const run = async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  const results = [];

  for (const { w, label } of WIDTHS) {
    const context = await browser.newContext({ viewport: { width: w, height: 1200 } });
    const page = await context.newPage();
    await page.goto(BASE);
    if (key && session) {
      await page.evaluate(([k, s]) => window.localStorage.setItem(k, s), [key, session]);
    }
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    for (const tab of TABS) {
      try {
        await page.getByRole("tab", { name: tab, exact: true }).click({ timeout: 3000 });
        await page.waitForTimeout(900);
      } catch {
        /* rota sem abas Dia/Semana/Mês */
      }
      const res = await page.evaluate(PROBE);
      const ok = !res.pageScrolls && res.offenders.length === 0;
      results.push({ w, label, tab, ok, res });
      console.log(
        `${ok ? "PASS" : "FAIL"}  ${String(w).padStart(4)}px  ${tab.padEnd(6)}  ${label}` +
          (ok ? "" : `  -> scrollX=${res.pageScrolls} offenders=${res.offenders.length}`)
      );
      res.offenders.slice(0, 5).forEach((o) => console.log("        ", JSON.stringify(o)));
    }

    await page.screenshot({ path: `${OUT}/${ROUTE.replace(/\W+/g, "-")}-${w}.png` });
    await context.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks OK — screenshots em ${OUT}`);
  if (failed.length) process.exitCode = 1;
};

run();

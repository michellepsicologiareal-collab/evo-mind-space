#!/usr/bin/env python3
"""Auditoria de responsividade — regressões de corte e sobreposição.

Uso:
    python3 scripts/responsive_audit.py                 # audita /app/agenda
    python3 scripts/responsive_audit.py /app/pacientes  # audita outra rota

Requisitos: dev server em http://localhost:8080 e Playwright (Python).
Sessão autenticada opcional via LOVABLE_BROWSER_SUPABASE_* .
Screenshots em /tmp/responsive-audit. Sai com código 1 se houver falha.
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = os.environ.get("AUDIT_BASE_URL", "http://localhost:8080")
ROUTE = sys.argv[1] if len(sys.argv) > 1 else "/app/agenda"
OUT = Path("/tmp/responsive-audit")

# Checklist oficial de breakpoints do PsiReal
WIDTHS = [
    (320, "mobile mínimo (iPhone SE 1)"),
    (360, "Android comum"),
    (375, "iPhone SE/13 mini"),
    (390, "iPhone 14/15"),
    (414, "iPhone Plus"),
    (430, "iPhone Pro Max"),
    (640, "sm (Tailwind)"),
    (768, "md / tablet retrato"),
    (820, "iPad Air"),
    (1024, "lg / tablet paisagem"),
]

TABS = ["Dia", "Semana", "Mês"]

PROBE = """() => {
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
  document.querySelectorAll('main *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const st = getComputedStyle(el);
    if (st.position === 'fixed') return;
    const bleeds = r.right > vw + 1 || r.left < -1;
    // corte real: só conta quando a própria página rola na horizontal
    if (bleeds && pageScrolls && !scrollableAncestor(el.parentElement)) {
      out.offenders.push({ type: 'overflow', tag: el.tagName,
        cls: String(el.className || '').slice(0, 90),
        text: (el.innerText || '').trim().slice(0, 50) });
    }
    // texto truncado sem ellipsis nem rolagem (apenas folhas)
    if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 &&
        st.overflow === 'visible' && st.textOverflow !== 'ellipsis') {
      out.offenders.push({ type: 'clipped', tag: el.tagName,
        cls: String(el.className || '').slice(0, 90),
        text: (el.innerText || '').trim().slice(0, 50) });
    }
  });
  return out;
}"""


async def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    slug = re.sub(r"\W+", "-", ROUTE).strip("-")
    results = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for width, label in WIDTHS:
            context = await browser.new_context(viewport={"width": width, "height": 1200})
            page = await context.new_page()
            await page.goto(BASE)
            if storage_key and session_json:
                await page.evaluate(
                    f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
                )
            await page.goto(f"{BASE}{ROUTE}", wait_until="networkidle")
            await page.wait_for_timeout(2000)

            for tab in TABS:
                try:
                    await page.get_by_role("tab", name=tab, exact=True).click(timeout=3000)
                    await page.wait_for_timeout(900)
                except Exception:
                    pass  # rota sem abas Dia/Semana/Mês
                res = await page.evaluate(PROBE)
                ok = not res["pageScrolls"] and not res["offenders"]
                results.append(ok)
                status = "PASS" if ok else "FAIL"
                extra = "" if ok else f"  -> scrollX={res['pageScrolls']} offenders={len(res['offenders'])}"
                print(f"{status}  {width:>4}px  {tab:<6}  {label}{extra}")
                for off in res["offenders"][:5]:
                    print("         ", json.dumps(off, ensure_ascii=False))

            await page.screenshot(path=str(OUT / f"{slug}-{width}.png"))
            await context.close()
        await browser.close()

    passed = sum(1 for r in results if r)
    print(f"\n{passed}/{len(results)} checks OK — screenshots em {OUT}")
    return 0 if passed == len(results) else 1


sys.exit(asyncio.run(main()))

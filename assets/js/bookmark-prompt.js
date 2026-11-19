(() => {
  "use strict";

  const storageKey = "mohaktools-bookmark-prompt-dismissed-until";
  const desktop = window.matchMedia("(min-width: 768px) and (pointer: fine)");
  if (!desktop.matches) return;

  try {
    if (Number(localStorage.getItem(storageKey)) > Date.now()) return;
  } catch (_) {
    // Continue without remembering dismissal when storage is unavailable.
  }

  let shown = false;
  let revealTimer;
  const revealAfterUse = () => {
    if (shown || revealTimer) return;
    revealTimer = window.setTimeout(showPrompt, 18000);
  };

  function showPrompt() {
    if (shown || !desktop.matches || !document.body) return;
    shown = true;

    const host = document.createElement("aside");
    host.setAttribute("aria-label", "Bookmark this page tip");
    host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483000;width:min(360px,calc(100vw - 40px));font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--color-text,#202924);";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        *{box-sizing:border-box}
        .card{padding:18px;background:var(--color-surface,#fffefa);border:1px solid var(--color-border,#dce2d8);border-radius:16px;box-shadow:0 14px 42px color-mix(in srgb,var(--color-text,#202924) 16%,transparent)}
        .top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        h2{margin:0 0 5px;font-size:16px;line-height:1.35;color:var(--color-text,#202924)}
        p{margin:0;color:var(--color-text-secondary,#55625b);font-size:13px}
        button{font:inherit;cursor:pointer}
        .close{display:grid;place-items:center;width:30px;height:30px;flex:0 0 30px;padding:0;border:0;border-radius:8px;background:var(--color-surface-secondary,#edf1e9);color:var(--color-text-secondary,#55625b);font-size:20px;line-height:1}
        .actions{display:flex;align-items:center;gap:10px;margin-top:15px}
        .help{padding:9px 13px;border:0;border-radius:9px;background:var(--color-primary,#0b6f83);color:var(--color-primary-text,#fff);font-size:13px;font-weight:700}
        .later{padding:8px 4px;border:0;background:transparent;color:var(--color-text-secondary,#55625b);font-size:13px}
        .tip{margin-top:13px;padding:10px 12px;border:1px solid var(--color-border,#dce2d8);border-radius:9px;background:var(--color-surface-secondary,#edf1e9);color:var(--color-text,#202924);font-size:13px}
        kbd{padding:2px 6px;border:1px solid var(--color-border,#dce2d8);border-bottom-width:2px;border-radius:5px;background:var(--color-surface,#fffefa);color:var(--color-text,#202924);font:600 12px ui-monospace,SFMono-Regular,Consolas,monospace}
        [hidden]{display:none!important}
        button:focus-visible{outline:3px solid var(--color-primary,#0b6f83);outline-offset:2px}
      </style>
      <section class="card" role="region" aria-labelledby="bookmark-title">
        <div class="top">
          <div><h2 id="bookmark-title">Keep this tool close</h2><p>Bookmark this page to find it quickly next time.</p></div>
          <button class="close" type="button" aria-label="Dismiss bookmark tip">×</button>
        </div>
        <div class="actions">
          <button class="help" type="button" aria-expanded="false">How to bookmark</button>
          <button class="later" type="button">Maybe later</button>
        </div>
        <div class="tip" hidden></div>
      </section>`;

    const close = () => {
      try { localStorage.setItem(storageKey, String(Date.now() + 30 * 24 * 60 * 60 * 1000)); } catch (_) { /* Storage is optional. */ }
      host.remove();
    };
    shadow.querySelector(".close").addEventListener("click", close);
    shadow.querySelector(".later").addEventListener("click", close);
    const help = shadow.querySelector(".help");
    const tip = shadow.querySelector(".tip");
    help.addEventListener("click", () => {
      const opening = tip.hidden;
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
      tip.innerHTML = `Press <kbd>${isMac ? "⌘" : "Ctrl"}</kbd> + <kbd>D</kbd>, then confirm the bookmark in your browser.`;
      tip.hidden = !opening;
      help.setAttribute("aria-expanded", String(opening));
    });
    document.body.appendChild(host);
  }

  window.addEventListener("pointerdown", revealAfterUse, { once: true, passive: true });
  window.addEventListener("keydown", revealAfterUse, { once: true });
})();

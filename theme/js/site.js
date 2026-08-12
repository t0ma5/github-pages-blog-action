(() => {
  const FONT_KEY = "blogmd-font-scale";
  const MIN = 0.85;
  const MAX = 1.4;
  const STEP = 0.1;

  if (!document.getElementById("top")) {
    document.body.id = "top";
  }

  function getScale() {
    const raw = Number(localStorage.getItem(FONT_KEY));
    if (!Number.isFinite(raw)) return 1;
    return Math.min(MAX, Math.max(MIN, raw));
  }

  function applyScale(scale) {
    document.documentElement.style.setProperty("--font-scale", String(scale));
    localStorage.setItem(FONT_KEY, String(scale));
  }

  function ensureNavControls() {
    const nav = document.querySelector("nav.nav");
    if (!nav) return;

    let left = nav.querySelector(".nav__left");
    let right = nav.querySelector(".nav__right");
    if (!left) {
      left = document.createElement("div");
      left.className = "nav__left";
      nav.prepend(left);
    }
    if (!right) {
      right = document.createElement("div");
      right.className = "nav__right";
      nav.appendChild(right);
    }

    let center = nav.querySelector(".nav__center");
    if (!center) {
      center = document.createElement("div");
      center.className = "nav__center";
      left.after(center);
    }

    if (!center.querySelector(".reader-zoom")) {
      const zoom = document.createElement("div");
      zoom.className = "reader-zoom";
      zoom.setAttribute("role", "group");
      zoom.setAttribute("aria-label", "Text size");

      const smaller = document.createElement("button");
      smaller.type = "button";
      smaller.className = "reader-zoom__btn";
      smaller.setAttribute("aria-label", "Decrease text size");
      smaller.textContent = "−";

      const larger = document.createElement("button");
      larger.type = "button";
      larger.className = "reader-zoom__btn";
      larger.setAttribute("aria-label", "Increase text size");
      larger.textContent = "+";

      smaller.addEventListener("click", () => {
        applyScale(Math.max(MIN, Math.round((getScale() - STEP) * 100) / 100));
      });
      larger.addEventListener("click", () => {
        applyScale(Math.min(MAX, Math.round((getScale() + STEP) * 100) / 100));
      });

      zoom.append(smaller, larger);
      center.appendChild(zoom);
    }

    if (!right.querySelector(".share-btn")) {
      const share = document.createElement("button");
      share.type = "button";
      share.className = "share-btn";
      share.textContent = "Share";
      share.setAttribute("aria-label", "Share this page");
      share.addEventListener("click", async () => {
        const payload = {
          title: document.title,
          text: document.querySelector("meta[name='description']")?.content || document.title,
          url: window.location.href,
        };
        try {
          if (navigator.share) {
            await navigator.share(payload);
            return;
          }
        } catch (err) {
          if (err && err.name === "AbortError") return;
        }
        try {
          await navigator.clipboard.writeText(payload.url);
          const prev = share.textContent;
          share.textContent = "Copied";
          setTimeout(() => {
            share.textContent = prev;
          }, 1400);
        } catch {
          window.prompt("Copy this link:", payload.url);
        }
      });
      right.appendChild(share);
    }
  }

  applyScale(getScale());
  ensureNavControls();
})();

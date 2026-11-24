// PRISM — navigation.js
// Accessible mobile navigation toggle. Desktop navigation remains plain
// HTML anchors with aria-current set server-side (in the static markup).

export function initNavigation() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("app-nav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("open", open);
  };

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

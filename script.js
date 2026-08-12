const VOICES_API = "https://xxfem-voices-api.truewolfflix777.workers.dev";

const menu = document.querySelector(".menu");
const nav = document.querySelector("#nav");

function setMenu(open) {
  if (!menu || !nav) return;
  nav.classList.toggle("open", open);
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  document.body.classList.toggle("menu-open", open);
}
menu?.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
nav?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("click", e => {
  if (!nav || !menu || !nav.classList.contains("open")) return;
  if (!nav.contains(e.target) && !menu.contains(e.target)) setMenu(false);
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 950) setMenu(false);
});

const modal = document.querySelector("#storyModal");
const openBtn = document.querySelector("#openStoryForm");
const storyForm = document.querySelector("#storyForm");
const submitStatus = document.querySelector("#submitStatus");
let priorFocus = null;

function focusable(container) {
  return [...container.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
}
function openModal() {
  if (!modal) return;
  priorFocus = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => focusable(modal)[0]?.focus());
}
function closeModal() {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = "";
  priorFocus?.focus?.();
}
openBtn?.addEventListener("click", openModal);
modal?.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeModal));
modal?.addEventListener("keydown", e => {
  if (e.key !== "Tab") return;
  const items = focusable(modal);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeModal();
    setMenu(false);
  }
});

function esc(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

/* First-visit XX rain intro.
   - Runs once per browser via localStorage.
   - Skip button available.
   - Completely disabled for prefers-reduced-motion. */
const rain = document.querySelector("#xxRain");
const skipIntro = document.querySelector("#skipIntro");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function finishIntro() {
  if (!rain) return;
  rain.classList.remove("active");
  try { localStorage.setItem("xxfem_intro_seen_v1", "yes"); } catch {}
  setTimeout(() => rain.remove(), 500);
}
function startIntro() {
  if (!rain) return;
  let seen = false;
  try { seen = localStorage.getItem("xxfem_intro_seen_v1") === "yes"; } catch {}
  if (seen || reduceMotion) {
    rain.remove();
    return;
  }
  const count = Math.min(74, Math.max(40, Math.floor(window.innerWidth / 18)));
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const xx = document.createElement("span");
    xx.className = "rain-xx";
    xx.textContent = "XX";
    xx.style.left = `${Math.random() * 100}%`;
    xx.style.setProperty("--size", `${18 + Math.random() * 58}px`);
    xx.style.setProperty("--duration", `${2.5 + Math.random() * 2.2}s`);
    xx.style.setProperty("--delay", `${Math.random() * 1.15}s`);
    xx.style.setProperty("--drift", `${-70 + Math.random() * 140}px`);
    xx.style.setProperty("--spin", `${-190 + Math.random() * 380}deg`);
    xx.style.setProperty("--alpha", `${0.28 + Math.random() * 0.68}`);
    frag.appendChild(xx);
  }
  rain.insertBefore(frag, skipIntro || null);
  requestAnimationFrame(() => rain.classList.add("active"));
  window.setTimeout(finishIntro, 4700);
}
skipIntro?.addEventListener("click", finishIntro);
startIntro();

async function loadStories() {
  const status = document.querySelector("#storiesStatus");
  const grid = document.querySelector("#storiesGrid");
  if (!status || !grid) return;
  status.textContent = "Loading approved stories…";
  try {
    const res = await fetch(`${VOICES_API}/stories`, {headers: {"Accept":"application/json"}});
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || "Unable to load stories.");
    const stories = Array.isArray(data) ? data : (data.stories || []);
    if (!stories.length) {
      grid.innerHTML = "";
      status.textContent = "No approved community stories yet. Your voice could be one of the first.";
      return;
    }
    grid.innerHTML = stories.map(s => `
      <article class="story-card">
        <div class="story-meta"><span>${esc(s.category || "XX Voice")}</span><span>${esc(s.state || "")}</span><span>${esc(s.displayName || "Anonymous")}</span></div>
        <h3>${esc(s.title || "Her Story")}</h3>
        <p>${esc((s.story || "").slice(0, 330))}${(s.story || "").length > 330 ? "…" : ""}</p>
        ${(s.story || "").length > 330 ? `<details><summary>Read her full story</summary><p>${esc(s.story)}</p></details>` : ""}
      </article>`).join("");
    status.textContent = `${stories.length} approved ${stories.length === 1 ? "story" : "stories"}.`;
  } catch (err) {
    grid.innerHTML = "";
    status.textContent = "Stories are temporarily unavailable. Please try again.";
    console.error(err);
  }
}
document.querySelector("#refreshStories")?.addEventListener("click", loadStories);

storyForm?.addEventListener("submit", async e => {
  e.preventDefault();
  submitStatus.textContent = "Submitting securely…";
  const fd = new FormData(storyForm);
  const payload = {
    name: fd.get("name") || "",
    displayName: fd.get("displayName") || "",
    email: fd.get("email") || "",
    state: fd.get("state") || "",
    category: fd.get("category") || "",
    title: fd.get("title") || "",
    story: fd.get("story") || "",
    anonymous: fd.get("anonymous") === "on",
    permissionToPublish: fd.get("permissionToPublish") === "on"
  };
  try {
    const res = await fetch(`${VOICES_API}/submit`, {
      method: "POST",
      headers: {"Content-Type":"application/json","Accept":"application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || "Submission failed.");
    storyForm.reset();
    submitStatus.textContent = "Thank you. Your story was submitted for review and is not public yet.";
  } catch (err) {
    submitStatus.textContent = `We couldn't submit your story: ${err.message}`;
  }
});
loadStories();
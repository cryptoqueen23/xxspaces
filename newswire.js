let allWireItems = [];
let activeCategory = "All";

function wireEsc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function renderWire() {
  const grid = document.querySelector("#wireGrid");
  const status = document.querySelector("#wireStatus");
  if (!grid || !status) return;
  const items = activeCategory === "All" ? allWireItems : allWireItems.filter(x => x.category === activeCategory);
  if (!items.length) {
    grid.innerHTML = "";
    status.textContent = activeCategory === "All" ? "No Newswire items are available right now." : `No current ${activeCategory} items.`;
    return;
  }
  grid.innerHTML = items.map(item => `
    <article class="wire-card">
      <span class="wire-cat">${wireEsc(item.category)}</span>
      <h2>${wireEsc(item.title)}</h2>
      <div class="wire-source">${wireEsc(item.source || "External source")}</div>
      <div class="wire-date">${wireEsc(item.dateLabel || "")}</div>
      ${item.description ? `<p>${wireEsc(item.description)}</p>` : ""}
      <a href="${wireEsc(item.link)}" target="_blank" rel="noopener noreferrer">Read original ↗</a>
    </article>`).join("");
  status.textContent = `${items.length} ${items.length === 1 ? "headline" : "headlines"} shown.`;
}
async function loadWire() {
  const status = document.querySelector("#wireStatus");
  if (!status) return;
  status.textContent = "Loading Newswire…";
  try {
    const res = await fetch("/api/newswire", {headers: {"Accept":"application/json"}});
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || "Unable to load Newswire.");
    allWireItems = data.items || [];
    renderWire();
  } catch (err) {
    status.textContent = "Newswire is temporarily unavailable. Please try again.";
    console.error(err);
  }
}
document.querySelectorAll(".wire-filter").forEach(btn => {
  btn.addEventListener("click", () => {
    activeCategory = btn.dataset.category;
    document.querySelectorAll(".wire-filter").forEach(x => x.classList.toggle("active", x === btn));
    renderWire();
  });
});
document.querySelector("#refreshWire")?.addEventListener("click", loadWire);
loadWire();
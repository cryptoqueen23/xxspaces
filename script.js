const menuBtn = document.querySelector(".menu-toggle");
const nav = document.querySelector(".primary-nav");

menuBtn?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});

document.querySelectorAll(".primary-nav a").forEach(link => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuBtn?.setAttribute("aria-expanded", "false");
  });
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add("in-view");
  });
}, { threshold: 0.14 });

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

function populateFireflies(selector, count) {
  const host = document.querySelector(selector);
  if (!host) return;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    dot.className = "firefly";
    dot.style.left = `${5 + Math.random() * 90}%`;
    dot.style.top = `${8 + Math.random() * 80}%`;
    dot.style.animationDelay = `${Math.random() * -4}s`;
    dot.style.animationDuration = `${2 + Math.random() * 2.5}s`;
    dot.style.transform = `scale(${0.65 + Math.random() * 1.2})`;
    host.appendChild(dot);
  }
}

populateFireflies(".fireflies", 22);
populateFireflies(".watch-fireflies", 32);


const TOPICS = [
  { category: "Sports", queries: ["women's sports transgender", "female athletes transgender", "girls sports transgender"] },
  { category: "Private Spaces", queries: ["women's locker room transgender", "women's bathroom transgender", "women-only spaces transgender"] },
  { category: "Schools & Girls", queries: ["girls privacy school transgender", "Title IX girls sports", "parental rights gender identity school"] },
  { category: "Medicine", queries: ["gender medicine minors", "puberty blockers children", "gender-affirming care minors"] },
  { category: "Detransition", queries: ["detransition", "detransitioner lawsuit"] },
  { category: "Law & Courts", queries: ["sex-based rights women court", "definition of woman court", "single-sex spaces law", "Title IX transgender court"] },
  { category: "Prisons & Shelters", queries: ["women's prison transgender", "women's shelter transgender"] },
  { category: "International", queries: ["women's spaces transgender UK", "women's sports transgender Canada", "single-sex spaces transgender Australia"] }
];

function decodeXml(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
function stripHtml(s = "") {
  return decodeXml(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? decodeXml(m[1]).trim() : "";
}
function parseItems(xml, category) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return blocks.map(block => {
    const titleRaw = stripHtml(tag(block, "title"));
    const link = stripHtml(tag(block, "link"));
    const pubDate = stripHtml(tag(block, "pubDate"));
    const description = stripHtml(tag(block, "description")).slice(0, 240);
    let source = stripHtml(tag(block, "source"));
    let title = titleRaw;
    if (!source && titleRaw.includes(" - ")) {
      const parts = titleRaw.split(" - ");
      source = parts.pop();
      title = parts.join(" - ");
    }
    return { category, title, source, link, pubDate, description };
  }).filter(x => x.title && x.link);
}
function ageLabel(dateString) {
  const t = Date.parse(dateString);
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default async function handler(req, res) {
  try {
    const requests = [];
    for (const topic of TOPICS) {
      for (const q of topic.queries) {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
        requests.push(
          fetch(url, { headers: { "User-Agent": "Mozilla/5.0 XXFemNewswire/1.0" } })
            .then(r => r.ok ? r.text() : "")
            .then(xml => parseItems(xml, topic.category))
            .catch(() => [])
        );
      }
    }
    const groups = await Promise.all(requests);
    const deduped = new Map();
    for (const item of groups.flat()) {
      const key = item.title.toLowerCase().replace(/\s+/g, " ").trim();
      if (!deduped.has(key)) deduped.set(key, item);
    }
    const items = [...deduped.values()]
      .sort((a,b) => (Date.parse(b.pubDate)||0) - (Date.parse(a.pubDate)||0))
      .slice(0, 72)
      .map(x => ({...x, dateLabel: ageLabel(x.pubDate)}));

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json({ success: true, generatedAt: new Date().toISOString(), items });
  } catch (error) {
    res.status(500).json({ success: false, error: "Newswire feed unavailable." });
  }
}
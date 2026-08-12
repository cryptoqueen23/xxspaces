# XXFem Live V4

This is the consolidated pre-GitHub build discussed in chat.

Included:
- Pink/feminine responsive design
- Hero video using `object-fit: contain` so the source video is not cropped
- Animated butterflies and fireflies
- First-visit XX rain intro
  - only once per browser via localStorage
  - Skip intro button
  - completely disabled when `prefers-reduced-motion: reduce`
- Accessible mobile hamburger drawer
  - aria-expanded
  - Escape closes
  - outside click closes
  - link click closes
- Founder story: "I was a tomboy. I needed time, not a label."
- XX Voices live approved-story feed
- XX Voices moderated story submission form
- XX Watch section
- XX♀ Circle entrance linked to the protected Cloudflare Access API
- XX Newswire page
- Vercel `/api/newswire` serverless endpoint that combines Google News RSS searches
- Newswire filters:
  Sports
  Private Spaces
  Schools & Girls
  Medicine
  Detransition
  Law & Courts
  Prisons & Shelters
  International
- External-source disclaimer on the Newswire

Existing services referenced:
- Public Voices API:
  https://xxfem-voices-api.truewolfflix777.workers.dev
- Protected Circle API:
  https://xxfem-circle-api.truewolfflix777.workers.dev

Vercel:
- No environment variables are required by this V4 package.
- Keep `api/newswire.js` in the repository root under `/api`.
- Vercel will deploy it as `/api/newswire`.

Accessibility / WCAG-oriented features:
- skip links
- semantic headings
- labeled forms
- keyboard focus outlines
- keyboard modal close and focus trap
- aria-live statuses
- responsive layouts for desktop/tablet/mobile
- reduced-motion fallback
- mobile navigation keyboard behavior
- hero video disabled for reduced-motion users
- first-visit rain disabled for reduced-motion users

Note:
The protected Circle authentication/backend is live, but the polished private member dashboard is still the next private-app layer. This public build intentionally does not expose a public member directory.

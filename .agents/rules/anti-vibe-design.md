# Anti-Vibe Design and Operational Invariants

These strict design, styling, copy, and operational rules are permanently enforced across all frontend, backend, and agent responses in this project:

## 1. Visual Design and Aesthetics
1. **Never Use Purple Gradients or Accents:**
   - No `from-purple`, `to-purple`, `bg-purple-*`, `text-purple-*`, `violet`, or purple color gradients anywhere in the UI or map layers.
   - Use authentic oceanic palettes (slate navy, cyan, teal, deep marine sky-blue).
2. **Never Use Pill-Shaped Buttons:**
   - Do not use `rounded-full` or oversized pill radii on interactive buttons, action chips, or modal triggers.
   - Use crisp, structured rectangular buttons with subtle rounding (`rounded-md` or `rounded`), sharp borders, and tactile active states.
3. **No Over-The-Top Animations:**
   - No floaty cursor animations, bouncy keyframes, or distracting scroll physics. Motion must remain subtle, purposeful, and functional.

## 2. Copywriting, Content and Typography
1. **No Vague Hero Text or AI-Slop Copy:**
   - All headings, subheaders, and empty-state placeholders must cite concrete operational metrics and maritime functionality (e.g. "Operational Marine Decision Support • 12 Landing Centres • Real-Time Satellite Telemetry").
   - Never use marketing buzzwords, speculative claims, or generic AI jargon.
2. **Never Use Emoji Icons in Code, UI or Agent Responses:**
   - No emojis (such as 🌊, ⚡, 🛡️, ⚓, 🚨, 🐟, ⚠️) in user interface copy, button labels, dropdown options, map tooltips, or agent text templates.
   - Use authentic SVG vectors or structured Lucide icon components.
3. **Never Use Em Dashes (`—` or `–` or `--`):**
   - Do not use em dashes in page titles, navigation headers, summaries, or report text. Use colons (`:`), hyphens (`-`), or clean sentence structure.

## 3. Data Integrity and Anti-Fabrication
1. **No Fake Reviews or Fake Metrics:**
   - Never show fabricated user testimonials, fake star ratings, or imaginary customer counters.
   - Every metric displayed must stem directly from verified physical telemetry (Open-Meteo live API, ERDDAP satellite SST/Chl-a, PyProj geodesic math, or genuine pipeline latency in ms).

## 4. Pre-Launch Requirements (Mandatory Checklist)
1. **Connected Custom Domain:**
   - Supported via `frontend/public/CNAME` and configured via `CUSTOM_DOMAIN` / `VITE_CUSTOM_DOMAIN` (default: `orca.marine.gov.in`).
2. **Professional Maritime Favicon:**
   - High-contrast SVG vector favicon located at `frontend/public/favicon.svg`.
3. **No "Made with AI" Tags:**
   - Zero badges, watermarks, or footers indicating "Made with AI", "Powered by AI", or AI sparkle branding.
4. **Statutory Privacy Policy and Terms of Use Pages:**
   - Accessible via navigation header and footer (`PrivacyPolicyModal` & `TermsConditionsModal`), covering Indian DPDP Act 2023, UNCLOS, and maritime advisory disclaimers.

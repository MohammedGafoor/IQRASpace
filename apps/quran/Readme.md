# MASTER PROMPT — Build IqraSpace Quran Platform

You are the lead product architect, UX designer, senior full-stack engineer, DevOps engineer, accessibility specialist, and technical reviewer for a new project called **IqraSpace Quran**.

We are starting this project in a **new Claude Code session**, so do not assume any previous conversation, codebase, architecture, or decisions exist.

## 1. Project Vision

Build a free, fast, trustworthy and highly accessible Quran web platform where anyone in the world can read the Quran easily on virtually any device.

The core philosophy is:

> **Read. Listen. Learn. Reflect.**

The primary objective is NOT to build a commercial website.

This should be designed like an **NGO / community / Sadaqah Jariyah project**:

* Free for users
* No intrusive advertisements
* No unnecessary subscriptions
* Very low operating cost
* Excellent reading experience
* Accessible worldwide
* Fast even on slower networks
* Mobile-first
* Reliable
* Secure
* Easy to maintain
* Open to future expansion

The most important principle is:

> **Do not over-engineer the project or introduce paid infrastructure unless there is a genuine technical requirement.**

---

# 2. Important Development Rule

Do NOT immediately start writing the entire application.

First:

1. Inspect the available environment.
2. Understand the repository.
3. Analyze existing files.
4. Identify the current technology stack.
5. Create the project architecture.
6. Prepare the development plan.
7. Identify risks and dependencies.
8. Propose the implementation phases.
9. Get the architecture into a documented state.
10. Then begin development phase-by-phase.

If the repository is empty, establish the project from scratch using the architecture defined below.

---

# 3. Product Positioning

The primary positioning should be:

> **IqraSpace — The easiest way to read the Quran.**

The Quran reader must be extremely clean and distraction-free.

Do NOT try to duplicate every feature of large Quran platforms during the initial release.

Prioritize:

1. Quran reading
2. Quran navigation
3. Translation
4. Audio
5. Search
6. Bookmarks
7. Continue reading
8. Accessibility
9. Mobile experience
10. Performance

Everything else should be phased later.

---

# 4. Target Devices

The application must work flawlessly across:

* iPhone
* iPad
* Android phones
* Android tablets
* Windows
* macOS
* Linux
* Chromebook
* Modern desktop browsers
* Modern mobile browsers

Use a responsive architecture rather than maintaining separate websites.

The application should also be designed as a **Progressive Web App (PWA)**.

---

# 5. Recommended Technology

Use modern, stable and maintainable technologies.

Preferred stack:

### Frontend

* Next.js
* React
* TypeScript
* Modern CSS
* Responsive design
* PWA support

### Backend / Data

* Supabase PostgreSQL where application persistence is required
* Server-side API routes/services where appropriate

### Hosting

* Vercel

### Source Control

* GitHub

### CI/CD

* GitHub Actions
* Automatic build/test/deployment pipeline

### CDN / DNS

* Cloudflare where useful

However:

**Do not blindly implement these technologies.**

First inspect the current project and validate the architecture.

If there is a technically better and significantly cheaper alternative, document it before changing direction.

---

# 6. Cost Philosophy

The platform should be designed around an NGO-style low-cost operating model.

Target:

### Development

$0/month where possible.

### Pilot

Use free tiers where practical.

### Initial public production

Keep infrastructure costs approximately within:

**$5–30/month**

unless actual traffic requires more.

### Growth

Scale only based on real usage.

Do NOT introduce:

* Kubernetes
* unnecessary microservices
* dedicated servers
* expensive databases
* unnecessary Redis
* Elasticsearch
* paid CMS
* expensive monitoring
* unnecessary third-party APIs
* AI APIs for basic Quran functionality

unless a genuine requirement is documented.

Every paid service must have:

* Purpose
* Estimated usage
* Estimated monthly cost
* Free/cheaper alternative
* Reason it is necessary

---

# 7. Quran Content

Do NOT manually type or create Quran text.

Use a trusted and properly licensed Quran content provider.

Investigate and evaluate:

### Quran Foundation / Quran.com APIs

https://api-docs.quran.com/

Evaluate the available APIs for:

* Surahs
* Ayahs
* Juz
* Pages
* Hizb
* Ruku
* Translations
* Tafsir
* Recitations
* Audio
* Search
* Metadata

Before implementation:

1. Review current API documentation.
2. Check authentication requirements.
3. Check rate limits.
4. Check licensing/usage requirements.
5. Check attribution requirements.
6. Check production/commercial/nonprofit usage conditions.
7. Determine which content should be cached.
8. Determine which content can be served from CDN.
9. Do not expose private API credentials in the browser.

If another authoritative source is more appropriate for a specific content type, document the decision.

### Critical rule

Never automatically machine-translate Quran text or Quran translations.

Use verified translations and respect the licensing and attribution requirements of each translation.

---

# 8. Quran Data Architecture

Do NOT make every user request directly dependent on an external Quran API.

Design a resilient architecture.

Preferred conceptual model:

Quran Content Provider
↓
Content Sync / Import Layer
↓
Validated / Cached Quran Content
↓
CDN / Application
↓
Users

User-specific application data should be stored separately.

For example:

* bookmarks
* reading progress
* reading history
* preferences
* notes
* collections

Do not unnecessarily store large immutable Quran content in relational tables if CDN/static caching is a better solution.

---

# 9. Authentication Philosophy

Reading the Quran must NOT require an account.

A visitor should be able to:

* Open website
* Select Surah
* Read Quran
* Listen to audio
* Search
* Change font size
* Change theme

without signing in.

Authentication should only be required for features such as:

* Synchronizing bookmarks
* Reading history
* Notes
* Collections
* Cross-device preferences
* Reading goals

Consider anonymous/local-device storage for basic functionality.

---

# 10. Phase 1 — Core Quran Reader

Build the first production-quality version around the Quran reader.

Required functionality:

### Navigation

* Surah list
* Surah details
* Juz navigation
* Page navigation
* Previous/next Surah
* Previous/next page where appropriate
* Ayah navigation
* Search

### Quran display

* Arabic Quran text
* Proper Arabic typography
* RTL
* Ayah numbers
* Clear verse separation
* Excellent readability
* Responsive typography

### Translation

Support:

* English initially
* Architecture ready for multiple languages

### Reader controls

Provide intuitive controls for:

* Arabic font size
* Translation font size
* Line spacing
* Theme
* Light mode
* Dark mode
* System theme
* Reading width
* Translation visibility

Do not overcrowd the reader.

---

# 11. Reader UX

The reader is the most important component of the entire application.

Design it to feel peaceful, simple and distraction-free.

Desktop concept:

---

## IqraSpace     Search    Surahs    Juz      Theme

```
             سورة الفاتحة
              Al-Fatihah

         بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ

         الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ

         All praise is for Allah...
```

---

Mobile concept:

☰       Al-Fatihah       🔍

```
    بِسْمِ اللَّهِ
  الرَّحْمَنِ الرَّحِيمِ

    In the name of Allah...

    ----------------

    الْحَمْدُ لِلَّهِ
  رَبِّ الْعَالَمِينَ

    All praise is for Allah...

    🔊   🔖   Aa
```

Do NOT copy this exact visual design.

Create a polished Islamic-inspired design that is:

* Modern
* Minimal
* Elegant
* Calm
* Accessible
* Professional
* Suitable for children and adults
* Free from excessive decoration

---

# 12. Islamic Design Direction

The application should have a subtle Islamic identity.

Use:

* Elegant typography
* Subtle geometric patterns
* Appropriate Islamic visual motifs
* Calm visual hierarchy
* Tasteful colors
* Good whitespace

Avoid:

* Excessive gold
* Excessive ornamental borders
* Crowded Islamic decoration
* Flashy animations
* Distracting backgrounds
* Poor Arabic typography

The Quran text itself must remain the visual focus.

Create a reusable theme system so the design can evolve without rewriting the application.

---

# 13. Audio

Implement Quran recitation support.

Requirements:

* Select reciter
* Play ayah
* Play Surah
* Pause
* Resume
* Previous
* Next
* Playback progress
* Auto advance
* Current Ayah highlighting
* Repeat ayah
* Repeat range if practical
* Playback speed if supported and appropriate

Audio should not unnecessarily consume application server bandwidth.

Evaluate external audio/CDN delivery and caching strategies.

---

# 14. Search

Implement Quran search.

Initial search:

* Arabic
* English translation
* Surah
* Ayah reference

Future-ready architecture:

* Multiple languages
* Transliteration
* Advanced search
* Search filters

Search must be fast.

Do not introduce Elasticsearch merely because it is available.

Start with the simplest reliable solution.

---

# 15. Bookmarking

Allow users to bookmark ayahs.

Support:

* Add bookmark
* Remove bookmark
* View bookmarks
* Optional bookmark categories
* Bookmark notes in future

Bookmarks should work locally without requiring login.

If the user signs in, synchronize them.

---

# 16. Continue Reading

Implement:

* Last Surah
* Last Ayah
* Last reading position

Home page should provide:

> Continue Reading

The user should be able to return to exactly where they stopped.

---

# 17. Reading Progress

Eventually support:

* Surah progress
* Juz progress
* Overall Quran progress
* Reading history
* Reading goals

Keep this simple initially.

Do not turn the Quran into a gamification-heavy application.

---

# 18. Accessibility

Accessibility is a first-class requirement.

Implement:

* Semantic HTML
* Keyboard navigation
* Screen reader support
* ARIA labels where appropriate
* High contrast
* Dark mode
* Large text
* Adjustable font sizes
* Focus indicators
* Reduced motion
* RTL support
* Accessible buttons
* Accessible menus
* Accessible audio controls

Target:

**WCAG 2.2 AA**

Run automated accessibility testing.

Also manually test important reader workflows.

---

# 19. Performance

Performance is one of the project's highest priorities.

Target:

* Lighthouse Performance: 95+
* Accessibility: 95+
* Best Practices: 95+
* SEO: 95+

Optimize:

* Initial JavaScript
* Images
* Fonts
* Quran content
* API calls
* Audio loading
* Caching
* CDN
* Server rendering where appropriate
* Lazy loading
* Prefetching

Avoid unnecessary client-side JavaScript.

The first Quran content should appear extremely quickly.

---

# 20. PWA / Offline

Design the application to eventually support offline Quran reading.

Phase initially:

* Installable PWA
* App icon
* Splash screen
* Offline shell
* Cache static assets

Later:

* Offline Arabic Quran
* Offline selected translation
* Offline reading
* Optional offline audio

Do not implement huge offline audio downloads until the architecture is properly evaluated.

---

# 21. Internationalization

The architecture must be i18n-ready.

Start with:

* Arabic
* English

Design for future:

* Urdu
* Hindi
* Telugu
* Malayalam
* Tamil
* Bengali
* Indonesian
* Malay
* Turkish
* Other languages

Support both:

* LTR
* RTL

Do not hard-code English UI strings throughout components.

---

# 22. SEO

Implement excellent SEO.

Requirements:

* Server-rendered Quran pages where appropriate
* Metadata
* Open Graph
* Structured data where appropriate
* Canonical URLs
* Sitemap
* Robots.txt
* Clean URLs
* Search engine friendly Surah pages
* Shareable Ayah URLs

Example:

/quran

/quran/1

/quran/1/1

/quran/al-fatiha

Choose the final URL strategy based on SEO and maintainability.

---

# 23. Social Sharing

Allow users to share an ayah.

Example:

> Surah Al-Fatiha 1:1

with:

* Arabic
* Translation
* Reference
* IqraSpace link

Do not generate inaccurate Quran images or modify Quran text.

---

# 24. Security

Implement:

* Secure API handling
* Environment variables
* No secrets in Git
* Authentication security
* Input validation
* Rate limiting where necessary
* Secure headers
* XSS protection
* CSRF considerations
* Database Row Level Security
* Proper Supabase policies
* Dependency auditing

Run security checks before production.

---

# 25. Database

Keep the database simple.

Potential tables:

users
profiles
bookmarks
reading_progress
reading_history
user_preferences
notes
collections

Do not create tables unless there is a genuine requirement.

Document:

* schema
* indexes
* relationships
* RLS policies
* backup strategy

---

# 26. Admin

Create an admin architecture only for genuine operational requirements.

Potential future capabilities:

* Content configuration
* Translation management
* Reciter configuration
* System settings
* Monitoring
* User management
* Feature flags
* Announcements

Do NOT build a huge CMS in Phase 1.

---

# 27. Monitoring

Use low-cost/free monitoring initially.

Monitor:

* Uptime
* Errors
* API failures
* Performance
* Database health
* Deployment failures

Do not collect unnecessary personal information.

Privacy must be treated seriously.

---

# 28. Privacy

The application should collect as little user information as possible.

Do not track users unnecessarily.

Avoid intrusive advertising trackers.

Document:

* What data is collected
* Why it is collected
* How long it is retained
* How users can delete their data

Create:

* Privacy Policy
* Terms of Use
* Content attribution page

before public production.

---

# 29. Analytics

If analytics are required, use a privacy-conscious approach.

Prefer:

* Minimal analytics
* Aggregated information
* No invasive tracking

Analytics should be used primarily to understand:

* Performance
* Popular Surahs
* Device compatibility
* Errors
* Feature usage

Avoid building advertising profiles.

---

# 30. CI/CD

Implement GitHub-based CI/CD.

Expected flow:

Developer
↓
Git commit
↓
GitHub
↓
Pull Request
↓
Automated Tests
↓
Lint
↓
Type Check
↓
Build
↓
Preview Deployment
↓
Approval
↓
Production Deployment

Use appropriate GitHub Environments.

Preferred environment naming:

* development
* preview
* production

Do not use confusing environment names such as "pilot" for the production deployment environment.

If Vercel is used, integrate GitHub → Vercel deployment cleanly.

---

# 31. Development Phases

Implement the project in controlled phases.

## Phase 0

Architecture and project foundation

## Phase 1

Core Quran reader

## Phase 2

Audio

## Phase 3

Search

## Phase 4

Bookmarks and Continue Reading

## Phase 5

Authentication and synchronization

## Phase 6

PWA and offline

## Phase 7

Accessibility and performance hardening

## Phase 8

Multilingual support

## Phase 9

Production readiness

## Phase 10

Future IqraSpace learning ecosystem

Do not jump ahead.

---

# 32. Required Documentation

Maintain documentation in the repository.

Create/update:

### README.md

Project introduction and local setup.

### ARCHITECTURE.md

Complete technical architecture.

### PRODUCT-ROADMAP.md

Features and phases.

### DATABASE.md

Database schema and RLS.

### QURAN-CONTENT.md

Quran content providers, licensing, attribution and synchronization.

### AUDIO.md

Audio architecture.

### ACCESSIBILITY.md

Accessibility requirements and testing.

### PERFORMANCE.md

Performance targets and optimization strategy.

### SECURITY.md

Security architecture.

### DEPLOYMENT.md

Local → Preview → Production deployment.

### COST.md

Expected infrastructure costs and scaling assumptions.

### DECISIONS.md

Important architecture decisions and reasons.

---

# 33. Architecture Decision Records

Whenever you make an important architectural choice, document:

### Decision

What was chosen?

### Alternatives

What else was considered?

### Reason

Why was it selected?

### Cost impact

Does it increase monthly cost?

### Future impact

Can we change it later?

This prevents the project from becoming dependent on undocumented decisions.

---

# 34. Testing Strategy

Implement:

### Unit tests

For business logic.

### Component tests

For critical UI.

### Integration tests

For APIs and database.

### E2E tests

Critical workflows:

1. Open Quran
2. Select Surah
3. Read ayah
4. Change font
5. Change theme
6. Play audio
7. Search
8. Bookmark
9. Continue reading
10. Sign in
11. Synchronize bookmark

### Accessibility testing

Automated + manual.

### Responsive testing

Test at:

* 320px
* 375px
* 390px
* 430px
* 768px
* 1024px
* 1280px
* 1440px+

---

# 35. Quality Gate

Before declaring any phase complete, verify:

* Functional requirements
* UX
* Responsive design
* Accessibility
* Security
* Performance
* SEO
* Tests
* Documentation
* Error handling
* Mobile experience

Do not say a phase is complete merely because the application builds successfully.

---

# 36. Visual Design Requirement

Do not create a generic SaaS dashboard.

This is a Quran platform.

The UI should feel:

* Peaceful
* Elegant
* Trustworthy
* Modern
* Islamic
* Accessible
* Minimal

Create reusable components:

* Header
* Navigation
* Surah selector
* Quran reader
* Ayah
* Translation
* Audio player
* Reader toolbar
* Search
* Bookmark
* Theme switcher
* Language selector
* Footer

Maintain a consistent design system.

---

# 37. Avoid Feature Creep

Do NOT implement everything at once.

If you identify a useful feature that is outside the current phase:

1. Document it.
2. Add it to the roadmap.
3. Do not implement it immediately.

The first goal is:

> **A beautiful, extremely fast, reliable Quran reader.**

---

# 38. Cost Review Requirement

At the end of every major phase, report:

### Infrastructure

* Service
* Current tier
* Estimated usage
* Estimated cost

### Alternatives

* Free option
* Low-cost option
* Current recommendation

### Expected scaling

Explain what happens at:

* 1,000 users
* 10,000 users
* 100,000 users
* 1 million users

Do not over-engineer for one million users before we have one thousand.

---

# 39. Production Architecture

The target architecture should roughly follow:

GitHub
│
▼
GitHub Actions
│
▼
Vercel
│
├───────────────┐
▼               ▼
Next.js        API Layer
│               │
│               ▼
│           Supabase
│
▼
CDN / Cache
│
▼
Quran Content / Audio Services

Keep the architecture modular but simple.

---

# 40. Future IqraSpace Ecosystem

Do not implement this now unless required.

The long-term platform may eventually contain:

IqraSpace
│
├── Quran
│   ├── Reader
│   ├── Audio
│   ├── Search
│   └── Memorization
│
├── Qaida
│   └── Beginner Learning
│
├── Lessons
│
├── Kids
│
├── Teachers
│
└── Learning Progress

The Quran Reader must remain independently usable even if the rest of the ecosystem is unavailable.

---

# 41. Important Engineering Principles

Follow these principles throughout development:

### KISS

Keep it simple.

### DRY

Avoid unnecessary duplication.

### SOLID

Use good engineering principles.

### Security by default

Never expose secrets.

### Accessibility by default

Do not add accessibility at the end.

### Mobile first

Do not treat mobile as an afterthought.

### Performance first

Do not allow unnecessary JavaScript or API requests.

### Cost conscious

Every infrastructure decision must consider cost.

### Maintainability

Another developer should be able to understand the project.

### Progressive enhancement

Basic Quran reading should remain reliable even when optional services fail.

---

# 42. Failure Handling

If the external Quran API is unavailable:

The reader should not simply show:

> "Something went wrong."

Use cached/static content wherever possible.

For optional services:

* Audio unavailable → reading still works
* Search unavailable → browsing still works
* Login unavailable → anonymous reading still works
* Analytics unavailable → application still works

The Quran reading experience must have the highest resilience.

---

# 43. First Task — DO THIS BEFORE CODING

Your first response/action in this new Claude session should NOT be to start generating large amounts of application code.

Instead:

### Step 1

Inspect the repository/environment.

### Step 2

Determine whether this is:

* Empty repository
* Existing application
* Existing IqraSpace project
* Partial implementation

### Step 3

Analyze existing files and configuration.

### Step 4

Check:

* package.json
* environment configuration
* Git configuration
* deployment configuration
* database configuration
* existing components
* existing design system
* existing tests

### Step 5

Create:

**PROJECT-STATUS.md**

containing:

* Current state
* Existing technology
* Existing functionality
* Missing functionality
* Risks
* Recommended next steps

### Step 6

Create:

**ARCHITECTURE.md**

with the proposed architecture.

### Step 7

Create:

**PRODUCT-ROADMAP.md**

with the phased roadmap.

### Step 8

Create:

**COST.md**

with the expected low-cost infrastructure strategy.

### Step 9

Only after completing the above, begin Phase 0 implementation.

---

# 44. Claude Code Working Style

Throughout the project:

* Think before coding.
* Inspect before modifying.
* Reuse existing code where appropriate.
* Do not overwrite working functionality unnecessarily.
* Do not introduce duplicate components.
* Do not create dead code.
* Remove obsolete code when safely confirmed.
* Keep commits logically organized.
* Explain important architectural decisions.
* Run tests after meaningful changes.
* Run build validation.
* Check responsive behavior.
* Check accessibility.
* Check performance.
* Update documentation as the architecture evolves.

If you discover dead code, duplicate functionality, obsolete dependencies or architectural problems, document them and clean them up when appropriate.

---

# 45. Definition of Done

A feature is NOT complete until:

* It works
* It is responsive
* It is accessible
* It is tested
* It handles errors
* It performs well
* It does not introduce unnecessary cost
* It is documented
* It does not break existing functionality

---

# 46. Final Instruction

Treat this as a **real production-grade public Quran platform**, not a demo or coding exercise.

The project should ultimately be capable of serving users globally while remaining extremely inexpensive to operate.

The guiding principle for every decision is:

> **Maximum benefit to users with minimum unnecessary complexity and cost.**

Start now by inspecting the repository/environment and producing the Phase 0 assessment and architecture.

**Do not skip the discovery and planning stage.**

<!-- ─────────────────────────── HERO ─────────────────────────── -->
![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=HelloCal&fontSize=70&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Intelligent%20Voice%20Calorie%20Tracker&descAlignY=58&descSize=18)

<div align="center">

### Log meals by voice in seconds — for busy people who won't open a spreadsheet.

![Version](https://img.shields.io/badge/version-1.0.87-8b5cf6?style=for-the-badge)
![Node](https://img.shields.io/badge/node-%3E%3D22-0ea5e9?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-22c55e?style=for-the-badge&logo=pwa&logoColor=white)
![Platforms](https://img.shields.io/badge/Web_%7C_iOS_%7C_Android-6366f1?style=for-the-badge)
![Offline](https://img.shields.io/badge/offline--first-10b981?style=for-the-badge)

<br/>

<a href="https://hellocal.infinitemind.space">
  <img src="https://img.shields.io/badge/▶_Live_Demo-hellocal.infinitemind.space-ec4899?style=for-the-badge" alt="Live Demo"/>
</a>
&nbsp;
<a href="#-quick-start">
  <img src="https://img.shields.io/badge/📖_Quick_Start-Get_Running-0ea5e9?style=for-the-badge" alt="Quick Start"/>
</a>

<br/><br/>

<p align="center">
  <img src="public/logo.svg" width="96" alt="HelloCal logo"/>
</p>

</div>

---

## Table of contents

- [See it in action](#-see-it-in-action)
- [Features](#-features)
- [Built with](#️-built-with)
- [Quick start](#-quick-start)
- [Cloud & AI (optional)](#-cloud--ai-optional)
- [Native apps](#-native-apps)
- [Deployment](#️-deployment)
- [Project docs](#-project-docs)
- [Contributing](#-contributing)

---

## ✨ See it in action

**Live app:** [https://hellocal.infinitemind.space](https://hellocal.infinitemind.space)

<p align="center">
  <img src="src/assets/hero.png" width="280" alt="HelloCal hero art — obsidian console aesthetic"/>
</p>

<!-- TODO: Add product screenshots (dashboard, voice log, analytics) under .github/assets/
     and a short demo GIF/mp4. Upload video via the GitHub README editor for a native player. -->

| | |
|:--:|:--:|
| **Voice-first logging** | **Analytics & streaks** |
| Speak a meal; macros land on the dashboard. | Trends, heatmaps, and goal feedback at a glance. |
| **Barcode & recipes** | **Hydration & supplements** |
| Scan packages or save go-to meals. | Track water and daily stack without leaving the app. |

> [!TIP]
> HelloCal is **offline-first**. Everything works in the browser with no backend. Supabase and Gemini unlock account sync and server-proxied AI when you opt in.

---

## 🚀 Features

| | Feature | Description |
|--|---------|-------------|
| 🎤 | **Voice calorie logging** | Speak natural language (“chicken bowl and a latte”) and get structured macros fast. |
| ⚡ | **Frictionless dashboard** | Rings, macros, meal slots, and reorderable panels designed for on-the-go use. |
| 📊 | **Analytics** | Range views, day-of-week patterns, heatmaps, sparklines, and insight strips. |
| 📷 | **Barcode & camera** | Scan packaged food; native camera support on iOS/Android via Capacitor. |
| 💊 | **Supplements** | Track your stack with optional reminders. |
| 💧 | **Hydration & weight** | Water logging and body metrics alongside calories. |
| 📖 | **Recipe box** | Save and reuse meals; AI-assisted flows when cloud AI is configured. |
| 🔁 | **Meal templates** | One-tap re-logs for the foods you eat every day. |
| ☁️ | **Optional cloud sync** | Google / email sign-in, encrypted per-user storage, conflict handling. |
| 📱 | **PWA + native** | Installable web app; same codebase ships as Capacitor iOS & Android apps. |
| 🔒 | **Private by default** | Local storage first — no account required to track. |

> [!NOTE]
> Brand personality: **Sleek · Precise · Intelligent** — dark “Obsidian Console” UI with glass surfaces and purposeful neon feedback. See [`PRODUCT.md`](./PRODUCT.md) and [`DESIGN.md`](./DESIGN.md).

---

## 🛠️ Built with

<p align="center">
  <img src="https://skillicons.dev/icons?i=react,ts,vite,supabase,vercel,androidstudio" alt="Tech stack icons"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white" alt="Capacitor"/>
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=black" alt="Supabase"/>
  <img src="https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini"/>
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white" alt="Chart.js"/>
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright"/>
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest"/>
</p>

---

## 📦 Quick start

> [!IMPORTANT]
> Requires **Node.js 22+**.

```bash
git clone https://github.com/bhaskaraanjana/HelloCal.git
cd HelloCal
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The app runs fully offline with no env vars.

**Useful scripts**

| Command | What it does |
|---------|----------------|
| `npm run dev` | Vite dev server + HMR |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | Playwright end-to-end tests |
| `npm run lint` | ESLint |
| `npm run android` / `npm run ios` | Build, Capacitor sync, open native IDE |

---

## ☁️ Cloud & AI (optional)

Leave env vars empty for a pure local app. To enable accounts, sync, and HelloCal AI:

```bash
cp .env.example .env.local
# edit .env.local — see SUPABASE.md for full setup
```

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | For cloud features |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | For cloud features |
| `GEMINI_API_KEY` | Google AI Studio key — set as a **Supabase Edge Function secret**, not a `VITE_` client var | For server-proxied AI |

Then:

1. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor.
2. Deploy the edge function: `supabase functions deploy gemini-proxy`
3. `supabase secrets set GEMINI_API_KEY=...`
4. Enable Email / Google auth providers as needed.

Full walkthrough: **[`SUPABASE.md`](./SUPABASE.md)**.

---

## 📱 Native apps

The same React build powers **iOS** and **Android** via [Capacitor](https://capacitorjs.com).

```bash
npm run cap:sync   # build + copy dist into android/ & ios/
npm run android    # open Android Studio
npm run ios        # open Xcode (macOS only)
```

Native bridges include camera meal capture, haptics, share/export, splash/status bar, and local meal/supplement reminders. Details: **[`NATIVE.md`](./NATIVE.md)**.

---

## 🚀 Deployment

**Live at:** [https://hellocal.infinitemind.space](https://hellocal.infinitemind.space)

Configured for **Vercel** SPA hosting (`vercel.json` rewrites all routes to `index.html`).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/bhaskaraanjana/HelloCal)

On your host, set the same `VITE_SUPABASE_*` vars **before** build if you want cloud features in production.

```bash
npm run build
# serve dist/ with any static host, or push and let Vercel build
```

---

## 📚 Project docs

| Doc | Contents |
|-----|----------|
| [`PRODUCT.md`](./PRODUCT.md) | Users, purpose, brand personality |
| [`DESIGN.md`](./DESIGN.md) | Design tokens & Obsidian Console system |
| [`SUPABASE.md`](./SUPABASE.md) | Cloud auth, sync, Gemini proxy |
| [`NATIVE.md`](./NATIVE.md) | Capacitor / iOS / Android |
| [`docs/changes.md`](./docs/changes.md) | Version changelog |

---

## 🤝 Contributing

Contributions welcome — open an issue or submit a pull request.

1. Fork and branch from `main`
2. Keep changes focused; match existing TypeScript and design tokens
3. Run `npm test` and `npm run lint` before opening a PR

---

## 📄 License

This repository is private (`"private": true` in `package.json`). Contact the maintainer for reuse or licensing questions.

<div align="center">

**[▶ Open HelloCal](https://hellocal.infinitemind.space)** · Built for speed, clarity, and calm daily tracking.

</div>

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=120&section=footer)

# MetaForge Platform 🛠️

**MetaForge** is a production-grade, metadata-driven dynamic runtime application builder platform. It enables developers to compile natural language prompts instantly into production-grade multi-entity interfaces, schemas, validation boundaries, and REST APIs—with **zero compilation steps** and extreme environment resilience.

---

## 🌟 Core Features

- 🖥️ **Dynamic React Component Rendering**: Generates beautiful inputs, selects, checkboxes, text areas, and calendars at runtime without rebuilds.
- 🧪 **Dynamic Form & Table grids**: Uses JSON configuration specs dynamically to mount React Hook Form schemas and searchable, sortable, paginated data log grids.
- ⚡ **Event-Driven Cascade Workflows**: OBS-driven background triggers mapping events like `employees.created` or `tasks.deleted` to automated notifications, log records, or cascading database insertions.
- 🛡️ **Offline Resilient sandbox Database**: Highly robust db client that automatically falls back to an in-memory high-fidelity sandbox database if PostgreSQL or Prisma is misconfigured or offline.
- 📥 **Case-Insensitive CSV Ingestion**: Fuzzy maps CSV columns to entity fields case-insensitively, validates all rows using dynamic Zod schemas, lists valid vs invalid records with diagnostics, and saves them in parallel.
- 🌐 **Multilingual Translation Context (i18n)**: Instant switching between **English (EN)**, **Spanish (ES)**, **German (DE)**, and **French (FR)** across all dashboards, builder consoles, system logs, and notification drawers.
- 📱 **Resilient PWA & Service Workers**: Full-featured service worker caching static shells and visual connectivity indicators.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router with Turbopack support)
- **State Management**: Zustand
- **Database Engine**: Prisma + PostgreSQL (with resilient high-fidelity In-Memory Database fallback)
- **Validation Shield**: Zod + React Hook Form
- **Styling system**: TailwindCSS (Harmonious dark modern aesthetics)
- **Icons Registry**: Lucide React

---

## 🚀 Quick Start

### 1. Prerequisite Setup

Configure your environmental variables in `.env` in the root of the project:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/metaforge?schema=public"
JWT_SECRET="forge-ai-super-secret-key-development-2026-xyz"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"  # Optional: Reverts to intelligent local parser if omitted
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your local browser to access the Developer Console!

---

## 📂 Codebase Architecture

```
├── prisma/
│   └── schema.prisma         # Database model spec
├── public/
│   ├── manifest.json         # PWA specifications
│   └── sw.js                 # Service worker offline cache
├── src/
│   ├── app/
│   │   ├── api/              # Dynamic REST CRUD routes, auth, and AI compilers
│   │   ├── dashboard/        # Main apps workspace and live builder consoles
│   │   ├── layout.tsx        # Modern dark theme shell
│   │   └── page.tsx          # Clean Console Authentication page
│   ├── components/
│   │   ├── forms/            # DynamicForm mapping Zod schemas
│   │   ├── runtime/          # Error boundaries and component registries
│   │   └── tables/           # DynamicTable and CsvImporter columns mapper
│   ├── lib/
│   │   ├── ai/               # Local and Google Gemini schema compiler engines
│   │   ├── logger/           # Engine log compiler & debugger
│   │   ├── runtime/          # Cascadic workflows & Next.js static starter ZIP exporter
│   │   └── schema/           # Defensively parsing auto-healer validation schemas
│   └── store/
│       ├── authStore.ts      # Zustand developer session store
│       └── i18nStore.ts      # Zustand multilingual translation store
```

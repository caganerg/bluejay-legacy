# 🐦 Bluejay

<div align="center">

> **An Obsidian-inspired, cloud-based Markdown note-taking platform with bi-directional linking and an interactive knowledge graph.**

[![Bun](https://img.shields.io/badge/Bun-v1.2-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.0-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ready-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

</div>

---

## 📖 Overview

**Bluejay** is a **second brain** application that lets you connect your thoughts, ideas, and documents in a non-linear network.

Link your notes together with `[[wiki-links]]`, visualize them in a live D3-powered **Interactive Knowledge Graph**, and enjoy a seamless writing experience with a powerful Markdown editor.

---

## ✨ Key Features

### 🔗 Bi-Directional Links (Wikilinks & Backlinks)
- **`[[Note Name]]` Syntax:** Add a wikilink inside your notes; the system automatically detects the connection and establishes a bi-directional relationship.
- **Alias Support:** Customize the link text with the `[[Real Note Name|Display Name]]` format.
- **Phantom Notes:** A link to a note that doesn't exist yet is preserved in the graph and editor, and is created instantly on click.
- **Backlinks Panel:** See at a glance, from the side panel, which notes reference the current note and which notes it links out to.

### 🕸️ Interactive 2D Knowledge Graph (Graph View)
- **D3-Force Physics Simulation:** Visualize the relationships between notes and tags as a dynamic node network.
- **Interactive Controls:** Zoom, freely pan, and drag nodes around.
- **Search & Node Highlighting:** Search directly within the graph to highlight matching nodes or light up the neighbors of the selected note.

### ✍️ Advanced Markdown Editor
- **Multiple View Modes:**
  - 🌓 *Split View*: Live preview while you write.
  - 📝 *Edit Mode*: A focused writing area.
  - 👁️ *Preview Mode*: A clean reading experience.
- **Smart Autocomplete:** A popup menu that lists existing notes and lets you pick one as soon as you type `[[`.
- **Quick Formatting Toolbar:** Bold, Italic, Headings, Code Blocks, Ordered/Unordered Lists, and Task Checkboxes (`- [ ]`).
- **Instant Autosave:** Changes are saved automatically via debounce, with a status badge (*Saved / Saving / Unsaved changes*) keeping you informed.

### 🔍 Quick Search & Command Palette (Quick Switcher)
- **`Ctrl + K` / `Cmd + K` Shortcut:** Fuzzy-search across notes, folders, and tags from anywhere in the app.
- **Instant Note Creation:** If the note you're searching for doesn't exist, create it directly from the search box with a single keystroke.

### 📁 Hierarchical Folder & Tag System
- **Unlimited Nested Folders:** Organize your notes in a hierarchical folder tree.
- **Inline `#tag` Support:** `#tag` mentions inside Markdown content are automatically extracted and made filterable.

### 💾 Hybrid Data Architecture
- **PostgreSQL + Prisma ORM:** A persistent, relational, and high-performance database model.
- **Built-in Fallback (In-Memory Store):** A smart in-memory storage layer that lets you try out every feature of the app instantly, even without a configured database.

---

## 🛠️ Tech Stack

| Layer | Technology / Library |
| :--- | :--- |
| **Runtime & Package Manager** | [Bun](https://bun.sh/) `v1.2+` (no Node.js/npm required) |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Server Components & Route Handlers) |
| **UI & Core** | [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/) |
| **Styling & Design** | [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons |
| **Graph Engine** | [D3.js (d3-force)](https://d3js.org/d3-force) Canvas Simulation |
| **Command Palette** | [cmdk](https://cmdk.paco.me/) |
| **Markdown Processing** | `react-markdown`, `remark-gfm` |
| **ORM & Database** | [Prisma ORM](https://www.prisma.io/), PostgreSQL |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Open Quick Search / Command Palette (Quick Switcher) |
| `Ctrl + S` / `Cmd + S` | Manually save the note |
| `[[` | Open the wikilink autocomplete menu |
| `Esc` | Close any open modals and windows |

---

## 🚀 Setup & Getting Started

### 1. Requirements
- **[Bun](https://bun.sh)**: `v1.2` or later — the project's package manager and runtime
- *(Optional)* A **PostgreSQL** database

> Bluejay uses Bun as its package manager and runtime; Node.js and npm are not required.
> If Bun isn't installed: `curl -fsSL https://bun.sh/install | bash`

### 2. Clone the Repository
```bash
git clone https://github.com/caganerg/bluejay.git
cd bluejay
```

### 3. Install Dependencies
```bash
bun install
```

> The lockfile is `bun.lock` and it is committed to the repo; don't create a `package-lock.json`.
>
> The `Blocked 1 postinstall` (`unrs-resolver`) warning you see during install is
> expected and harmless: the package already ships the binaries it needs.

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set your database connection string in `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/bluejay?schema=public"
```
> *Note: If the database URL isn't set, Bluejay automatically starts in In-Memory mode.*

### 5. Sync the Database Schema *(if using PostgreSQL)*
```bash
bunx prisma db push
```
> Remember to run `bunx prisma generate` every time you change `prisma/schema.prisma`.

### 6. Start the Development Server
```bash
bun run dev
```

Head to [http://localhost:3000](http://localhost:3000) in your browser and start using Bluejay!

---

## 📦 Available Commands

All commands run through Bun; commands starting with `npm`, `npx`, `yarn`,
or `pnpm` are not used in this project.

| Command | Action |
| :--- | :--- |
| `bun install` | Install dependencies |
| `bun add <package>` | Add a dependency (for dev dependencies: `bun add -d <package>`) |
| `bun remove <package>` | Remove a dependency |
| `bun run dev` | Start the development server |
| `bun run build` | Create a production build |
| `bun run start` | Serve the production build |
| `bun run lint` | Run the ESLint check |
| `bunx prisma <command>` | Prisma CLI (`generate`, `db push`, `migrate dev`, …) |

> The `[run] bun = true` setting in `bunfig.toml` makes sure the binaries under
> `node_modules/.bin` (`next`, `eslint`, `prisma`) run under the Bun runtime
> instead of Node. Don't remove this file.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

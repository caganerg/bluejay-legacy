<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# This project uses Bun, not npm

Bun is the package manager, script runner and runtime for this repository, and
the machine it is developed on has **no Node.js installed at all**. Any command
starting with `npm`, `npx`, `yarn` or `pnpm` will fail.

```bash
bun install          # install dependencies (instead of: npm install)
bun add <pkg>        # add a dependency  (instead of: npm install <pkg>)
bun add -d <pkg>     # add a dev dependency
bun remove <pkg>     # remove a dependency
bun run dev          # start the dev server
bun run build        # production build
bun run start        # serve the production build
bun run lint         # eslint
bunx prisma <cmd>    # Prisma CLI, e.g. bunx prisma generate / migrate dev
```

The lockfile is `bun.lock` and it is committed. Never generate a
`package-lock.json`; if one shows up, delete it and re-run `bun install`.

`bunfig.toml` sets `[run] bun = true` so that binaries in `node_modules/.bin`
— whose shebang is `#!/usr/bin/env node` — are executed by the Bun runtime
instead of searching for a Node binary that does not exist. Do not remove it.
Next.js 16 (dev, build, start), ESLint and the Prisma CLI have all been
verified to run under Bun with no Node present.

Anything you write that documents or automates setup — README, install scripts,
Dockerfiles, CI workflows — must assume Bun as well.

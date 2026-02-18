# onboarding-flow

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Convex, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Convex** - Reactive backend-as-a-service platform
- **Biome** - Linting and formatting
- **Turborepo** - Optimized monorepo build system

## Getting Started

```bash
pnpm install
```

## Running the App (Two Terminals)

### Terminal 1 — Convex backend

```bash
cd packages/backend
npx convex dev
```

**First time only:** run `npx convex dev --configure`, select **"Start without an account (run Convex locally)"**, and name the project `onboarding-flow`. This writes `packages/backend/.env.local`.

Convex runs at `http://127.0.0.1:3210`, dashboard at `http://127.0.0.1:6790`.

### Terminal 2 — Web frontend

```bash
pnpm -F web dev
```

Opens at [http://localhost:3001](http://localhost:3001).

### Or run both at once (Turborepo)

```bash
pnpm dev
```

> Convex must be configured first (see Terminal 1 above).

### Environment

`apps/web/.env` needs:

```
VITE_CONVEX_URL=http://127.0.0.1:3210
```

Copy from `apps/web/.env.example` if missing.


## Git Hooks and Formatting

- Format and lint fix: `pnpm run check`



## Project Structure

```
onboarding-flow/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
├── packages/
│   ├── backend/     # Convex backend functions and schema
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:setup`: Setup and configure your Convex project
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run check`: Run Biome formatting and linting

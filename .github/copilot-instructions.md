# Lumen Project Instructions

A pnpm/Turborepo monorepo for an infinite-canvas Kanban board built with Next.js 16, React 19, and tRPC.

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `npx ultracite fix`
- **Check for issues**: `npx ultracite check`
- **Diagnose setup**: `npx ultracite doctor`

Biome (the underlying engine) provides extremely fast Rust-based linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `npx ultracite fix` before committing to ensure compliance.

## Architecture Overview

```
apps/web/          → Next.js App Router frontend (port 3000)
packages/
  db/              → Drizzle ORM + PostgreSQL schema (@lumen/db)
  trpc/            → tRPC router and procedures (@lumen/trpc)
  logger/          → Pino logger with browser/server support (@lumen/logger)
  configs/         → Shared TypeScript configs (@lumen/configs)
```

### Data Flow
- **Frontend state**: Zustand store with Immer (`features/kanban/store/kanban-store.ts`) persists to IndexedDB via `idb-keyval`
- **Server communication**: tRPC client → `/api/trpc` route → `@lumen/trpc` router → `@lumen/db`
- **Canvas rendering**: React Flow (`@xyflow/react`) renders board nodes on infinite canvas
- **Drag-and-drop**: `@dnd-kit` handles column/task reordering within boards

### State Management Pattern
Normalized entity maps with `EntityMap<T>` pattern (`{ byId: Record<string, T>, allIds: string[] }`):
```typescript
// Access entities
const board = state.boards.byId[boardId];
const allBoardIds = state.boards.allIds;
// Denormalize for rendering via getDenormalizedBoard()
```

## Essential Commands

```bash
pnpm dev              # Start all packages in dev mode
pnpm db:start         # Start PostgreSQL container
pnpm db:push          # Push schema changes to database
pnpm db:studio        # Open Drizzle Studio
pnpm check            # Lint + format with Ultracite/Biome
```

## Code Conventions

### Linting & Formatting
Uses **Ultracite** (Biome preset). Run `pnpm ultracite fix` before committing. Key rules:
- No barrel files except feature entry points (see `features/kanban/index.ts`)
- UI components in `components/ui/` are excluded from strict linting

### Environment Variables
Type-safe env with `@t3-oss/env-core` + Zod:
```typescript
// packages/db/src/env.ts - server-only DATABASE_URL
// apps/web/src/env.ts - web-specific vars
import { env } from "@lumen/db/env";
```

### Logging
Use `@lumen/logger` with structured context:
```typescript
import { createLogger, createChildLogger } from "@lumen/logger";
const logger = createLogger({ name: "[scope] module" });
const childLogger = createChildLogger(logger, { requestId: "abc" });
```

### Component Patterns
- Feature components in `features/<name>/components/` with barrel export
- Use `memo()` for expensive list items (see `KanbanBoard`, `KanbanColumn`)
- Store selectors in `features/kanban/store/selectors.ts` for derived state

### ID Generation
Use typed ID generators from `features/kanban/store/ids.ts`:
```typescript
import { generateBoardId, generateTaskId } from "./ids";
```

## Key Files Reference

| Pattern | Example |
|---------|---------|
| Feature module | `apps/web/src/features/kanban/` |
| Zustand store | `features/kanban/store/kanban-store.ts` |
| tRPC router | `packages/trpc/src/router.ts` |
| DB schema | `packages/db/src/schema.ts` |
| Type definitions | `features/kanban/types/index.ts` |
| API route | `apps/web/src/app/api/trpc/[trpc]/route.ts` |
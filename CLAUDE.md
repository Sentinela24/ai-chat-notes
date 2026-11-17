# CLAUDE.md

Guidance for working in this repo. The user-facing overview, feature list and design rationale are in [README.md](README.md). Read it before you make an architectural change.

## What this is

An npm-workspaces monorepo for an AI chat + notes app, built as a frontend portfolio project. Chat replies stream over SSE. Notes use TipTap, with streamed AI summarise/rewrite. The parts that matter most are **streaming, cancellation, error states and accessibility while content is still arriving**. Keep that bar when you change things.

```
apps/web/        @acn/web     Vite + React 19 + Tailwind v4 + Zustand + TanStack Query + TipTap 3
apps/server/     @acn/server  Hono on Node: a thin LLM proxy that holds the API key
packages/shared/ @acn/shared  Zod wire schemas + SSE parser (imported as TS source, no build step)
e2e/                          Playwright, whole stack in mock mode
scripts/screenshots.ts        Regenerates docs/*.png (needs `npm run dev` running)
```

## Commands

Requires Node 22 or newer. CI uses Node 24.

```bash
npm run dev            # server :8787 + web :5173 (Vite proxies /api → server)
npm test               # Vitest in every workspace
npm run test -w apps/web -- src/features/chat   # one workspace / path filter
npx vitest run src/lib/markdown.test.ts         # single file (run from inside the workspace dir)
npm run test:e2e       # Playwright; starts its own servers on :8790/:5180 in mock mode
npm run lint           # ESLint (flat config, root)
npm run typecheck      # root tsconfig (e2e, scripts) + every workspace
npx prettier --check . # CI fails on formatting
npm run storybook      # :6006
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs Prettier check, lint, typecheck, unit tests, the web build, the Storybook build and E2E. Run lint, typecheck, tests and the Prettier check before you call work done.

## Running without an API key

The provider defaults to `mock`, so no `apps/server/.env` is needed. The mock provider ([apps/server/src/providers/mock.ts](apps/server/src/providers/mock.ts)) reacts to triggers in the user message: `/slow`, `/error` (fails mid-stream), `/fail` (fails before the first token), `/refuse` and `/long`. Use them to exercise UI states by hand. E2E tests rely on them too.

For real models, copy `apps/server/.env.example` to `.env` and set `LLM_PROVIDER=anthropic|openai` plus the key. Env parsing lives in [apps/server/src/providers/index.ts](apps/server/src/providers/index.ts).

## Architecture: the streaming path

1. **Wire contract**: [packages/shared/src/schemas.ts](packages/shared/src/schemas.ts). Every provider is normalised into four events: `start`, `delta`, `done` and `error`. Request bodies (`ChatRequestSchema`, `TransformRequestSchema`) are shared by client and server. **Change the contract here first**, then update both sides.
2. **Server**: [apps/server/src/app.ts](apps/server/src/app.ts) has `createApp({ provider })`, kept separate from `index.ts` so that tests use `app.request()` without opening a port. Routes: `GET /api/health`, `GET /api/config`, `POST /api/chat` and `POST /api/transform`. Bodies are Zod-validated **before** the stream opens, so bad input gets a normal 400 JSON `ApiErrorBody`.
3. **SSE relay**: [apps/server/src/sse.ts](apps/server/src/sse.ts) `streamCompletion()` sends `start`, relays provider events, maps thrown errors to an in-band `error` event and sends `: ping` heartbeats. On client disconnect it aborts the upstream provider call.
4. **Providers**: `apps/server/src/providers/`. Each implements `LLMProvider` ([types.ts](apps/server/src/providers/types.ts)) and yields only `delta`/`done`. The route adds `start` and `error`. A provider must throw `ProviderError` ([errors.ts](apps/server/src/providers/errors.ts)) for known failures. `toErrorEvent` replaces anything unknown with a generic message, so internals never reach the client. SDK error mapping is in `sdkErrors.ts`. Prompts, including the `<passage>` prompt-injection guard for transforms, are in [prompts.ts](apps/server/src/prompts.ts).
5. **Client transport**: [apps/web/src/lib/api/streamEvents.ts](apps/web/src/lib/api/streamEvents.ts) uses `fetch` POST + `readSSE` from shared, not `EventSource`, and yields schema-validated events. Unknown events are skipped, not fatal. HTTP errors map to `StreamRequestError` with `code` and `retryable`.
6. **Frame buffer**: [apps/web/src/lib/stream/frameBuffer.ts](apps/web/src/lib/stream/frameBuffer.ts) coalesces deltas into at most one store update per animation frame. Always `flush()` before writing a terminal state and `cancel()` in `finally`.

### Chat (`apps/web/src/features/chat/`)

- [chatActions.ts](apps/web/src/features/chat/chatActions.ts) owns the stream lifecycle as **module-level functions outside React** (`sendMessage`, `stopStreaming`, `retryMessage`), with a single module `AbortController`. This lets streams survive switching views. Don't move it into a component or effect.
- [store.ts](apps/web/src/features/chat/store.ts) is a Zustand store persisted to `localStorage` under the `acn:chat` key. Updates go through `patch()` so that only the streaming message object changes, which lets memoised bubbles skip re-renders. Keep updates immutable and per-message. On rehydrate, `merge` turns `streaming` messages into `stopped`.
- Message status values: `streaming | done | stopped | error`. `stopReason` covers `end_turn | max_tokens | refusal | other`. A refusal is a normal stop, not an error.
- `toApiHistory` drops failed and empty messages before sending.

### Notes (`apps/web/src/features/notes/`)

- [useAiTransform.ts](apps/web/src/features/notes/useAiTransform.ts) is a component-scoped hook, unlike chat: unmounting aborts the request. Results stream into a **preview** ([AiPreviewPanel.tsx](apps/web/src/features/notes/components/AiPreviewPanel.tsx)), never straight into the document. Updates are guarded on `idle` so that chunks arriving after a discard are dropped.
- [NoteEditor.tsx](apps/web/src/features/notes/components/NoteEditor.tsx) wraps TipTap behind an **imperative `NoteEditorHandle`** (focus, `replaceRange`, `insertAfter`, …), not a controlled `value` prop. Accepting a suggestion must be a single ProseMirror transaction so that one Undo reverts it. The editor is read-only while a suggestion streams.
- The notes store persists under `acn:notes`. [saveReply.ts](apps/web/src/features/notes/saveReply.ts) converts chat Markdown to rich text. TipTap's schema parser is the HTML sanitiser.

### Other web state

- [uiStore.ts](apps/web/src/app/uiStore.ts) holds UI-only state (current view, toast) and persists `view` under `acn:ui`.
- Server request/response data uses TanStack Query (`useConfig` in [config.ts](apps/web/src/lib/api/config.ts)). The rule: request/response data goes in Query, and long-lived streamed writes go in a Zustand store or local state.
- Markdown rendering uses `react-markdown` + `remark-gfm` ([components/ui/Markdown.tsx](apps/web/src/components/ui/Markdown.tsx)). Never enable raw HTML.

## Accessibility rules (don't regress these)

- A streaming message is `aria-busy` and is deliberately **not** a live region. Narration goes through a separate polite region in [StreamAnnouncer.tsx](apps/web/src/features/chat/components/StreamAnnouncer.tsx), which uses helpers in [lib/a11y/announce.ts](apps/web/src/lib/a11y/announce.ts). It announces whole sentences, batched, with Markdown stripped.
- <kbd>Esc</kbd> stops a chat reply or stops/discards an AI suggestion. <kbd>Enter</kbd> sends, <kbd>Shift</kbd>+<kbd>Enter</kbd> adds a newline, and IME composition never sends.
- Focus recovery: when Stop or Retry unmounts, focus goes back to the composer. A view switch focuses the new view's heading. AI preview focus moves to Stop while streaming, then to the primary action.
- [Toolbar.tsx](apps/web/src/components/ui/Toolbar.tsx) is a WAI-ARIA toolbar with a roving tabindex.
- E2E runs axe (WCAG 2 A/AA), and the Storybook a11y addon checks every story.

## Conventions

- TypeScript is strict, with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. Use `import type` for types; ESLint enforces it. Prefix intentionally unused vars/args with `_`.
- **Every workspace must declare the dependencies it imports.** `import-x/no-extraneous-dependencies` catches phantom deps that npm hoisting would otherwise hide. Add deps with `npm i <pkg> -w apps/web` (or the relevant workspace).
- In web code, the `@/` alias points to `apps/web/src`. The server and shared packages use relative imports and `@acn/shared`.
- Prettier settings: single quotes, semicolons, trailing commas, width 100.
- Code is organised by feature (`features/chat`, `features/notes`), with shared primitives in `components/ui` and `lib/`. Tests (`*.test.ts(x)`) and stories (`*.stories.tsx`) sit next to their source.
- Comments explain _why_, as the existing code does. Match that style.
- Commits use Conventional Commits (`feat(scope):`, `test:`, `docs:`).

## Testing patterns

- **Server**: call `createApp({ provider: createMockProvider({ delayMs: 0 }) })` and `app.request()`. Read responses with `readSSE` + `StreamEventSchema`, the same path the browser uses. Provider adapters are tested with injected fake SDK clients ([providers.test.ts](apps/server/src/providers/providers.test.ts)).
- **Web**: Vitest runs in jsdom with globals. [src/test/setup.ts](apps/web/src/test/setup.ts) stubs `scrollTo` and `matchMedia` and clears `localStorage` after each test. Fake `fetch` with the helpers in [src/test/sse.ts](apps/web/src/test/sse.ts): `sseResponse`, `hangingSSEResponse` (stays open until abort), `start`, `delta()` and `done`.
- **Shared parser**: its tests cover arbitrary chunk splits, `\r\n` split across chunks and multi-byte UTF-8. Keep that coverage if you touch `SSEParser`.
- **Storybook**: [src/stories/useFakeStream.ts](apps/web/src/stories/useFakeStream.ts) replays tokens for live-streaming stories.
- **E2E**: [e2e/chat.spec.ts](e2e/chat.spec.ts) drives mock triggers. On a fresh machine, run `npx playwright install chromium` once.

## Known limitations

These are intentional for now (see the README): single conversation, `localStorage` persistence, tables flattened when saved to notes, and no auth or rate limiting on the proxy. A WebSocket transport behind the same `streamEvents()` interface is planned.

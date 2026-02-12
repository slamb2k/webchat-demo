# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm install        # Install dependencies
npm run dev        # Start Vite dev server (hot reload)
npm run build      # Production build via Vite
```

No test runner or linter is configured.

## Architecture

This is a standalone demo app that embeds a **real `botframework-webchat` instance** connected to a **mock DirectLine transport** (no live bot needed). It demonstrates the `Action.Execute` vs `Action.Submit` adaptive card problem when using the **M365 Agents SDK** (Copilot Studio) with WebChat. Microsoft officially states that WebChat does not support `Action.Execute` — the recommended approach is to use `Action.Submit` instead. The demo also shows an unsupported middleware workaround that intercepts `Action.Execute` and sends an invoke activity.

### Source Files

- **`src/App.tsx`** — Main UI. Contains:
  - `WebChatInstance` — wrapper that creates a fresh `MockDirectLine` and WebChat `store` per config change (remounted via React key)
  - `App` — control panel (left sidebar) with card-type radio, middleware toggles, and status display. All UI components (`Section`, `Toggle`, `RadioOption`, `StatusLine`) are defined inline at the bottom.

- **`src/MockDirectLine.ts`** — Implements the DirectLine interface that WebChat expects. Simulates an M365 Agents SDK bot: sends a welcome message, then an adaptive card consent prompt using either `Action.Execute` (broken in WebChat) or `Action.Submit` (recommended). Processes user responses (invoke activities from the fix middleware, or message activities from Action.Submit). Users can type "reset" to re-trigger the card.

- **`src/middlewares.ts`** — Three middleware factories:
  1. `createDiagnosticStoreMiddleware()` — Redux store middleware; logs all `DIRECT_LINE/POST_ACTIVITY` and `DIRECT_LINE/INCOMING_ACTIVITY` actions
  2. `createDiagnosticCardActionMiddleware()` — Card action middleware; logs button clicks with warnings about Action.Execute
  3. `createActionExecuteFixStoreMiddleware()` — A Redux store middleware that converts `Action.Execute` → `Action.Submit` in incoming adaptive cards before WebChat renders them. This works because WebChat's `cardActionMiddleware` never fires for `Action.Execute` (the AdaptiveCardRenderer logs "received unknown action" and drops it). The recommended long-term fix is to have the bot send `Action.Submit` when targeting WebChat.

### Key Pattern

`App.tsx` composes middleware chains conditionally based on toggle state. The execute fix and diagnostics are both store middlewares added to the `createStore()` call. The diagnostic card action middleware is separate and only logs clicks (it cannot fix Action.Execute because WebChat never routes Execute actions through `cardActionMiddleware`).

### Card Type Scenarios

1. **Action.Execute** — What M365 Agents SDK / Copilot Studio typically sends. Broken in WebChat: clicks are silently dropped because WebChat does not support Action.Execute. The Adaptive Cards schema-level `fallback` property does not help here because WebChat's AC renderer recognises Action.Execute as a known type and renders the button — it just doesn't handle the click.
2. **Action.Submit** (Recommended) — Works natively in WebChat without any middleware. Microsoft's recommended approach when targeting WebChat. The bot should detect the channel and send Action.Submit for WebChat, Action.Execute for Teams.

### TypeScript Config

`strict` is set to `false` in `tsconfig.json`. The codebase uses `any` liberally for WebChat middleware signatures and DirectLine types.

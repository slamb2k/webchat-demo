# Copilot Studio WebChat Adaptive Card Demo

Demo app showing why `Action.Execute` adaptive cards break in WebChat and how to fix them with a store middleware that converts them to `Action.Submit`.

## The Problem

Microsoft's [Bot Framework WebChat](https://github.com/microsoft/BotFramework-WebChat) does not support `Action.Execute` — the adaptive card action type used by Teams, Outlook, and M365 Copilot for Universal Actions. When a Copilot Studio agent sends a card with `Action.Execute` buttons to WebChat, **clicks are silently dropped**. No error, no activity, nothing.

This is [documented by Microsoft](https://learn.microsoft.com/en-us/microsoft-copilot-studio/adaptive-cards-overview):

> The Bot Framework Web Chat component supports version 1.6 but doesn't support `Action.Execute`

WebChat's `AdaptiveCardRenderer` logs `"received unknown action from Adaptive Cards"` and discards it. The action never reaches `cardActionMiddleware` — so a card action middleware fix is impossible.

## The Fix

A **Redux store middleware** that intercepts `DIRECT_LINE/INCOMING_ACTIVITY` and rewrites `Action.Execute` to `Action.Submit` in adaptive cards before WebChat renders them. Once converted, WebChat handles clicks natively.

This is a client-side workaround for when you can't control what the bot sends (e.g. Copilot Studio's built-in auth/consent flows). If you control the bot, just use `Action.Submit` for WebChat channels.

## How It Works

This is a **real `botframework-webchat` instance** connected to a mock DirectLine transport (no live bot needed). The mock bot simulates a Copilot Studio agent that sends an adaptive card consent prompt. All middleware, card actions, and activity flows work exactly as they would against a real bot.

### Source Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main UI with control panel, card type selector, and middleware toggles |
| `src/MockDirectLine.ts` | Mock DirectLine transport that simulates a Copilot Studio bot |
| `src/middlewares.ts` | Diagnostic and fix store middlewares |

## Getting Started

```bash
npm install
npm run dev
```

Open the URL shown in your terminal (usually `http://localhost:5173`).

## Walkthrough

1. Open browser **DevTools > Console** — all activity is logged there
2. With the default settings (**Action.Execute**, no middleware), click "Yes, Allow" on the consent card — **nothing happens**
3. Toggle **Action.Submit** — click the card — **it works immediately**
4. Switch back to **Action.Execute** and enable the **Execute Fix** toggle — click the card — **it works** (the middleware converted Execute to Submit before rendering)
5. Enable **Diagnostics** to see the full activity flow in the console
6. Type `reset` in the chat to resend the consent card at any time

## Why Not Action.Submit Everywhere?

`Action.Execute` exists for a reason — in Teams and Outlook it enables:

- **Card refresh**: the bot responds with a replacement card (updated in place, no new message)
- **Per-user views**: different users see different content on the same card
- **Auto-refresh on open**: cards can fetch fresh data when viewed

`Action.Submit` can't do any of this. It sends a message and the card goes stale.

The problem is that Copilot Studio sends the same card to every channel — there's no per-channel switching. If the card uses `Action.Execute` for Teams, it's broken in WebChat.

## Production Use

In a real app you'd replace `MockDirectLine` with the [M365 Agents SDK](https://learn.microsoft.com/en-us/microsoft-copilot-studio/publication-integrate-web-or-native-app-m365-agents-sdk):

```typescript
import { CopilotStudioClient } from '@microsoft/agents-copilotstudio-client';
import { CopilotStudioWebChat } from '@microsoft/agents-copilotstudio-client';

const client = new CopilotStudioClient({ botId: '...', tenantId: '...' });
const directLine = CopilotStudioWebChat.createConnection(client);
```

The WebChat component and store middleware are the same either way — the Agents SDK only replaces the transport layer.

## Tech Stack

- React 18 + TypeScript
- [botframework-webchat](https://www.npmjs.com/package/botframework-webchat) 4.17
- Vite

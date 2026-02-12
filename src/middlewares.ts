/**
 * MIDDLEWARES
 *
 * These are the actual middlewares you'd add to a real WebChat instance.
 * Toggle them on/off in App.tsx to see the difference.
 *
 * Store middleware (diagnostic) → Logs all inbound/outbound activities
 * Store middleware (fix) → Converts Action.Execute → Action.Submit in incoming cards
 * Card action middleware (diagnostic) → Logs card button clicks
 */

// ============================================================
// DIAGNOSTIC STORE MIDDLEWARE
// Logs all activities flowing through WebChat
// ============================================================
export function createDiagnosticStoreMiddleware() {
  return () => (next: any) => (action: any) => {
    if (action.type === 'DIRECT_LINE/POST_ACTIVITY') {
      const activity = action.payload?.activity;
      console.group('%c📤 OUTBOUND Activity', 'color: #0078d4; font-weight: bold');
      console.log('Type:', activity?.type);
      console.log('Name:', activity?.name || '(none)');
      console.log('Text:', activity?.text || '(none)');
      console.log('Value:', activity?.value);
      console.log('ChannelData:', activity?.channelData);
      console.log('Full:', JSON.parse(JSON.stringify(activity)));
      console.groupEnd();
    }

    if (action.type === 'DIRECT_LINE/INCOMING_ACTIVITY') {
      const activity = action.payload?.activity;
      const hasCards = activity?.attachments?.some(
        (a: any) => a.contentType === 'application/vnd.microsoft.card.adaptive'
      );

      if (hasCards) {
        console.group('%c📥 INBOUND Adaptive Card', 'color: #107c10; font-weight: bold');
        activity.attachments.forEach((att: any, i: number) => {
          if (att.contentType === 'application/vnd.microsoft.card.adaptive') {
            const actions = att.content?.actions || [];
            console.log(`Card ${i + 1} actions:`);
            actions.forEach((a: any, j: number) => {
              console.log(`  [${j}] ${a.type} — title: "${a.title}", verb: ${a.verb || 'N/A'}`);
              if (a.type === 'Action.Execute') {
                console.warn(
                  '  ⚠️ Action.Execute is not supported by WebChat — clicks will be silently dropped!'
                );
              }
            });
          }
        });
        console.groupEnd();
      } else {
        console.log(
          '%c📥 INBOUND:',
          'color: #107c10',
          activity?.type,
          activity?.text || ''
        );
      }
    }

    return next(action);
  };
}

// ============================================================
// DIAGNOSTIC CARD ACTION MIDDLEWARE
// Logs card button clicks — shows if actions are being handled
// ============================================================
export function createDiagnosticCardActionMiddleware() {
  return ({ dispatch }: any) => (next: any) => (...args: any[]) => {
    const [cardAction] = args;
    const { cardAction: action } = cardAction;

    console.group('%c🖱️ Card Button Clicked', 'color: #d83b01; font-weight: bold; font-size: 14px');
    console.log('Action Type:', action?.type);
    console.log('Title:', action?.title);
    console.log('Verb:', action?.verb || '(none — not Action.Execute)');
    console.log('Data:', action?.data);

    if (action?.type === 'Action.Execute') {
      console.warn(
        '⚠️ This is Action.Execute — but note: WebChat does NOT route Action.Execute' +
          ' through cardActionMiddleware. If you see this, it was already converted to' +
          ' Action.Submit by the fix store middleware.'
      );
    }

    if (action?.type === 'Action.Submit') {
      console.log(
        'ℹ️ This is Action.Submit. WebChat will send a message activity with the card data as the value.'
      );
    }

    console.groupEnd();

    return next(...args);
  };
}

// ============================================================
// FIX: STORE MIDDLEWARE — converts Action.Execute → Action.Submit
//
// WebChat does NOT support Action.Execute: the AdaptiveCardRenderer
// logs "received unknown action" and drops it. It never reaches
// cardActionMiddleware at all.
//
// This store middleware intercepts DIRECT_LINE/INCOMING_ACTIVITY
// and rewrites any Action.Execute buttons to Action.Submit before
// the card is rendered. This way WebChat handles clicks natively.
//
// The recommended long-term fix is to have the bot send
// Action.Submit when targeting WebChat.
// ============================================================
export function createActionExecuteFixStoreMiddleware() {
  return () => (next: any) => (action: any) => {
    if (action.type === 'DIRECT_LINE/INCOMING_ACTIVITY') {
      const activity = action.payload?.activity;
      if (activity?.attachments) {
        for (const att of activity.attachments) {
          if (
            att.contentType === 'application/vnd.microsoft.card.adaptive' &&
            att.content?.actions
          ) {
            let converted = false;
            att.content.actions = att.content.actions.map((cardAction: any) => {
              if (cardAction.type === 'Action.Execute') {
                converted = true;
                return {
                  type: 'Action.Submit',
                  title: cardAction.title,
                  style: cardAction.style,
                  data: cardAction.data,
                };
              }
              return cardAction;
            });
            if (converted) {
              console.log(
                '%c🔧 [Execute Fix] Converted Action.Execute → Action.Submit in incoming card',
                'color: #8764b8; font-weight: bold'
              );
            }
          }
        }
      }
    }
    return next(action);
  };
}

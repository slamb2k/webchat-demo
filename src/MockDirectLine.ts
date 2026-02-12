/**
 * MockDirectLine
 *
 * Implements the DirectLine interface that botframework-webchat expects.
 * Simulates an M365 Agents SDK bot (e.g. a Copilot Studio agent) that sends
 * an adaptive card consent prompt and responds to user actions.
 *
 * This is a REAL DirectLine-compatible transport — WebChat treats it identically
 * to a live connection. All middleware, card actions, and activity flows work
 * exactly as they would against a real bot.
 */

// ============================================================
// Minimal Observable (subset of RxJS that DirectLine needs)
// ============================================================
type Observer<T> = {
  next?: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
};

type Subscription = {
  unsubscribe: () => void;
};

class SimpleSubject<T> {
  private observers: Observer<T>[] = [];
  private lastValue?: T;
  private hasValue = false;

  constructor(initialValue?: T) {
    if (initialValue !== undefined) {
      this.lastValue = initialValue;
      this.hasValue = true;
    }
  }

  subscribe(observerOrNext?: Observer<T> | ((value: T) => void)): Subscription {
    const observer: Observer<T> =
      typeof observerOrNext === 'function' ? { next: observerOrNext } : observerOrNext || {};

    this.observers.push(observer);

    // Emit last value for BehaviorSubject-like behaviour
    if (this.hasValue && observer.next) {
      observer.next(this.lastValue!);
    }

    return {
      unsubscribe: () => {
        this.observers = this.observers.filter((o) => o !== observer);
      },
    };
  }

  next(value: T) {
    this.lastValue = value;
    this.hasValue = true;
    this.observers.forEach((o) => o.next?.(value));
  }

  error(err: any) {
    this.observers.forEach((o) => o.error?.(err));
  }

  complete() {
    this.observers.forEach((o) => o.complete?.());
  }
}

// ============================================================
// Adaptive Cards - The consent card Copilot Studio sends
// ============================================================

/** Card with Action.Execute (what Copilot Studio typically uses) */
export const CONSENT_CARD_EXECUTE = {
  type: 'AdaptiveCard',
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  version: '1.4',
  body: [
    {
      type: 'Container',
      style: 'emphasis',
      items: [
        {
          type: 'ColumnSet',
          columns: [
            {
              type: 'Column',
              width: 'auto',
              items: [
                {
                  type: 'Image',
                  url: 'https://img.icons8.com/fluency/48/lock.png',
                  size: 'Small',
                },
              ],
            },
            {
              type: 'Column',
              width: 'stretch',
              items: [
                {
                  type: 'TextBlock',
                  text: 'Permission Required',
                  weight: 'Bolder',
                  size: 'Medium',
                },
                {
                  type: 'TextBlock',
                  text: 'Scheduling Agent needs access to your resources',
                  spacing: 'None',
                  isSubtle: true,
                  size: 'Small',
                },
              ],
              verticalContentAlignment: 'Center',
            },
          ],
        },
      ],
    },
    {
      type: 'Container',
      items: [
        {
          type: 'TextBlock',
          text: 'This copilot is requesting permission to:',
          wrap: true,
          spacing: 'Medium',
        },
        {
          type: 'FactSet',
          facts: [
            { title: '📅', value: 'Read your Outlook calendar' },
            { title: '👤', value: 'View your basic profile' },
          ],
        },
        {
          type: 'TextBlock',
          text: 'Requested by: **Copilot Studio Scheduling Agent**',
          wrap: true,
          spacing: 'Medium',
          size: 'Small',
        },
      ],
    },
  ],
  actions: [
    {
      type: 'Action.Execute',
      title: 'Yes, Allow',
      verb: 'consent',
      style: 'positive',
      data: {
        action: 'Allow',
        id: 'consent-response',
        scope: 'Calendars.Read,User.Read',
      },
    },
    {
      type: 'Action.Execute',
      title: 'No, Deny',
      verb: 'consent',
      style: 'destructive',
      data: {
        action: 'Deny',
        id: 'consent-response',
        scope: 'Calendars.Read,User.Read',
      },
    },
  ],
};

/** Same card but with Action.Submit */
export const CONSENT_CARD_SUBMIT = {
  ...CONSENT_CARD_EXECUTE,
  actions: [
    {
      type: 'Action.Submit',
      title: 'Yes, Allow',
      style: 'positive',
      data: {
        action: 'Allow',
        id: 'consent-response',
        scope: 'Calendars.Read,User.Read',
      },
    },
    {
      type: 'Action.Submit',
      title: 'No, Deny',
      style: 'destructive',
      data: {
        action: 'Deny',
        id: 'consent-response',
        scope: 'Calendars.Read,User.Read',
      },
    },
  ],
};


// ============================================================
// Connection Status (matches botframework-directlinejs)
// ============================================================
enum ConnectionStatus {
  Uninitialized = 0,
  Connecting = 1,
  Online = 2,
  ExpiredToken = 3,
  FailedToConnect = 4,
  Ended = 5,
}

// ============================================================
// MockDirectLine
// ============================================================
let activityIdCounter = 0;

export interface MockDirectLineOptions {
  /** Which card action type to use */
  cardType: 'execute' | 'submit';
  /** Simulated delay for bot responses (ms) */
  responseDelay?: number;
}

export class MockDirectLine {
  private activitySubject = new SimpleSubject<any>();
  private connectionSubject = new SimpleSubject<number>(ConnectionStatus.Uninitialized);
  private cardType: MockDirectLineOptions['cardType'];
  private responseDelay: number;
  private consentAnswered = false;

  // These are the observables that WebChat reads
  public activity$: any;
  public connectionStatus$: any;

  constructor(options: MockDirectLineOptions) {
    this.cardType = options.cardType;
    this.responseDelay = options.responseDelay ?? 600;
    this.activity$ = this.activitySubject;
    this.connectionStatus$ = this.connectionSubject;

    // Simulate connection startup
    setTimeout(() => {
      this.connectionSubject.next(ConnectionStatus.Connecting);
      setTimeout(() => {
        this.connectionSubject.next(ConnectionStatus.Online);
        // Send welcome message + consent card after "connecting"
        this.sendBotWelcome();
      }, 300);
    }, 100);
  }

  /** Called by WebChat when the user sends a message or card action */
  postActivity(activity: any) {
    const id = `user-${++activityIdCounter}`;

    console.log(
      '%c[MockBot] Received activity from WebChat:',
      'color: #0078d4; font-weight: bold',
      {
        type: activity.type,
        name: activity.name,
        text: activity.text,
        value: activity.value,
        channelData: activity.channelData,
      }
    );

    // Process the incoming activity and respond
    setTimeout(() => this.processActivity(activity), this.responseDelay);

    // Return an Observable that emits the activity ID (WebChat expects this)
    return {
      subscribe: (observer: any) => {
        const obs = typeof observer === 'function' ? { next: observer } : observer;
        setTimeout(() => obs.next?.(id), 0);
        return { unsubscribe: () => {} };
      },
    };
  }

  end() {
    this.connectionSubject.next(ConnectionStatus.Ended);
  }

  // Expose for triggering card resend from UI
  public resendConsentCard() {
    this.consentAnswered = false;
    this.sendConsentCard();
  }

  // ---- Internal methods ----

  private sendBotActivity(activity: any) {
    const fullActivity = {
      id: `bot-${++activityIdCounter}`,
      timestamp: new Date().toISOString(),
      from: { id: 'copilot-bot', name: 'Scheduling Agent', role: 'bot' },
      ...activity,
    };

    console.log(
      '%c[MockBot] Sending activity to WebChat:',
      'color: #107c10; font-weight: bold',
      {
        type: fullActivity.type,
        text: fullActivity.text,
        hasAttachments: !!fullActivity.attachments,
      }
    );

    this.activitySubject.next(fullActivity);
  }

  private sendBotWelcome() {
    setTimeout(() => {
      this.sendBotActivity({
        type: 'message',
        text: "Hi! I'm the Scheduling Agent. I need to check your calendar availability for next week's meeting.",
      });

      setTimeout(() => this.sendConsentCard(), 800);
    }, 500);
  }

  private sendConsentCard() {
    const card =
      this.cardType === 'execute' ? CONSENT_CARD_EXECUTE : CONSENT_CARD_SUBMIT;

    this.sendBotActivity({
      type: 'message',
      text: 'Please review the following permission request:',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        },
      ],
    });
  }

  private processActivity(activity: any) {
    // Handle invoke (from Action.Execute with middleware)
    if (activity.type === 'invoke' && activity.name === 'adaptiveCard/action') {
      console.log(
        '%c[MockBot] ✅ Received invoke activity — this means the middleware is working!',
        'color: #107c10; font-weight: bold; font-size: 14px'
      );

      const actionData = activity.value?.action?.data;
      this.handleConsentResponse(actionData);
      return;
    }

    // Handle message with value (from Action.Submit)
    if (activity.type === 'message' && activity.value && !activity.text) {
      console.log(
        '%c[MockBot] ✅ Received Action.Submit — WebChat handles this natively',
        'color: #107c10; font-weight: bold; font-size: 14px'
      );
      this.handleConsentResponse(activity.value);
      return;
    }

    // Handle regular text messages
    if (activity.type === 'message' && activity.text) {
      const text = activity.text.toLowerCase();
      if (text.includes('reset') || text.includes('again')) {
        this.consentAnswered = false;
        this.sendBotActivity({
          type: 'message',
          text: 'Sure, let me send the permission request again.',
        });
        setTimeout(() => this.sendConsentCard(), 500);
      } else {
        this.sendBotActivity({
          type: 'message',
          text: "I'm waiting for you to respond to the permission card above. You can also type 'reset' to see it again.",
        });
      }
      return;
    }

    // Unhandled activity type
    console.log(
      '%c[MockBot] ❓ Received unrecognised activity type:',
      'color: #888',
      activity.type
    );
  }

  private handleConsentResponse(data: any) {
    if (this.consentAnswered) {
      this.sendBotActivity({
        type: 'message',
        text: "You've already responded to this permission request. Type 'reset' to try again.",
      });
      return;
    }

    this.consentAnswered = true;

    if (data?.action === 'Allow') {
      this.sendBotActivity({
        type: 'message',
        text: '✅ Permission granted! Accessing your calendar now...',
      });
      setTimeout(() => {
        this.sendBotActivity({
          type: 'message',
          text: "📅 I found 3 available slots next week:\n\n• Monday 10:00 - 11:00 AM\n• Wednesday 2:00 - 3:00 PM\n• Friday 9:00 - 10:00 AM\n\nWhich works best for you?",
        });
      }, 1000);
    } else if (data?.action === 'Deny') {
      this.sendBotActivity({
        type: 'message',
        text: "⚠️ Permission denied. I won't be able to check your calendar. You can grant permission later by typing 'reset'.",
      });
    } else {
      this.sendBotActivity({
        type: 'message',
        text: `I received a response but the action "${data?.action}" wasn't expected. Please try again.`,
      });
    }
  }
}

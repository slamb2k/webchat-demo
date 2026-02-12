import React, { useMemo, useState } from 'react';
import ReactWebChat, { createStore } from 'botframework-webchat';
import { MockDirectLine } from './MockDirectLine';
import {
  createDiagnosticStoreMiddleware,
  createDiagnosticCardActionMiddleware,
  createActionExecuteFixStoreMiddleware,
} from './middlewares';

// ============================================================
// WebChat Instance — new instance on every config change
// ============================================================
interface WebChatInstanceProps {
  cardType: 'execute' | 'submit';
  enableDiagnostics: boolean;
  enableExecuteFix: boolean;
}

const WebChatInstance: React.FC<WebChatInstanceProps> = ({
  cardType,
  enableDiagnostics,
  enableExecuteFix,
}) => {
  // Create fresh MockDirectLine for this instance
  const directLine = useMemo(() => {
    console.clear();
    console.log(
      '%c🚀 New WebChat instance created',
      'color: #0078d4; font-weight: bold; font-size: 16px'
    );
    console.log('Card type:', cardType);
    console.log('Diagnostics:', enableDiagnostics);
    console.log('Execute fix:', enableExecuteFix);
    console.log('---');

    return new MockDirectLine({ cardType });
  }, [cardType, enableDiagnostics, enableExecuteFix]);

  // Build store middleware chain
  // The execute fix is a store middleware — it converts Action.Execute → Action.Submit
  // in incoming cards BEFORE WebChat renders them.
  const store = useMemo(() => {
    const middlewares: any[] = [];

    if (enableExecuteFix) {
      middlewares.push(createActionExecuteFixStoreMiddleware());
    }
    if (enableDiagnostics) {
      middlewares.push(createDiagnosticStoreMiddleware());
    }

    return createStore({}, ...middlewares);
  }, [enableDiagnostics, enableExecuteFix]);

  // Card action middleware — only used for diagnostics (logging clicks)
  const cardActionMiddleware = useMemo(() => {
    if (enableDiagnostics) {
      return createDiagnosticCardActionMiddleware();
    }
    return undefined;
  }, [enableDiagnostics]);

  return (
    <div style={{ height: '100%' }}>
      <ReactWebChat
        directLine={directLine as any}
        store={store}
        cardActionMiddleware={cardActionMiddleware}
        userID="simon-user"
        username="Simon"
        styleOptions={{
          backgroundColor: '#ffffff',
          bubbleBackground: '#f0f0f0',
          bubbleBorderRadius: 8,
          bubbleFromUserBackground: '#0078d4',
          bubbleFromUserBorderRadius: 8,
          bubbleFromUserTextColor: '#ffffff',
          rootHeight: '100%',
          rootWidth: '100%',
        }}
      />
    </div>
  );
};

// ============================================================
// Main App
// ============================================================
const App: React.FC = () => {
  const [cardType, setCardType] = useState<'execute' | 'submit'>('execute');
  const [enableDiagnostics, setEnableDiagnostics] = useState(false);
  const [enableExecuteFix, setEnableExecuteFix] = useState(false);

  // Key forces remount of WebChat when config changes
  const instanceKey = `${cardType}-${enableDiagnostics}-${enableExecuteFix}`;

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Control Panel */}
      <div
        style={{
          width: '340px',
          backgroundColor: '#1e1e2e',
          color: '#cdd6f4',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '18px', color: '#cba6f7' }}>
            M365 Agents SDK
          </h1>
          <h2 style={{ margin: 0, fontSize: '14px', color: '#a6adc8', fontWeight: 400 }}>
            WebChat Adaptive Card Demo
          </h2>
        </div>

        <p style={{ fontSize: '12px', lineHeight: 1.6, color: '#a6adc8', margin: 0 }}>
          This is a <strong>real</strong> botframework-webchat instance connected to a mock
          Copilot Studio bot. Toggle the middleware switches and watch the browser DevTools
          console to see exactly what happens.
        </p>

        {/* Card Type */}
        <Section title="Card Action Type" description="What the bot sends">
          <RadioOption
            name="cardType"
            value="execute"
            checked={cardType === 'execute'}
            onChange={() => setCardType('execute')}
            label="Action.Execute"
            tag="Broken in WebChat"
            tagColor="#f38ba8"
          />
          <RadioOption
            name="cardType"
            value="submit"
            checked={cardType === 'submit'}
            onChange={() => setCardType('submit')}
            label="Action.Submit"
            tag="Recommended"
            tagColor="#a6e3a1"
          />
        </Section>

        {/* Middleware Toggles */}
        <Section
          title="Middleware"
          description="Toggle these and watch the console"
        >
          <Toggle
            checked={enableDiagnostics}
            onChange={setEnableDiagnostics}
            label="🔍 Diagnostics"
            description="Logs all activities and card clicks"
          />
          <Toggle
            checked={enableExecuteFix}
            onChange={setEnableExecuteFix}
            label="🔧 Action.Execute Fix"
            description="Converts Action.Execute → Action.Submit in incoming cards"
          />
        </Section>

        {/* Status */}
        <Section title="Current Status">
          <StatusLine
            label="Card type"
            value={cardType === 'execute' ? 'Action.Execute' : 'Action.Submit'}
          />
          <StatusLine
            label="Will clicks work?"
            value={
              cardType === 'execute'
                ? enableExecuteFix
                  ? '✅ Yes (converted to Action.Submit)'
                  : '❌ No (clicks silently dropped)'
                : '✅ Yes (Action.Submit works natively)'
            }
          />
          {cardType === 'submit' && (
            <StatusLine
              label="Approach"
              value="Recommended by Microsoft for WebChat"
            />
          )}
        </Section>

        {/* Instructions */}
        <Section title="How to Use">
          <ol
            style={{
              margin: 0,
              paddingLeft: '16px',
              fontSize: '12px',
              lineHeight: 1.8,
              color: '#bac2de',
            }}
          >
            <li>Open browser DevTools → Console</li>
            <li>Leave all middlewares OFF</li>
            <li>Click "Yes, Allow" on the card</li>
            <li><strong>Action.Execute:</strong> nothing happens (broken!)</li>
            <li><strong>Action.Submit:</strong> works immediately — Microsoft's recommended approach for WebChat</li>
            <li>Switch to Action.Execute, enable "🔧 Fix" → card buttons are converted to Action.Submit</li>
            <li>Enable "🔍 Diagnostics" to see the full activity flow</li>
            <li>Type "reset" in chat to resend the card</li>
          </ol>
        </Section>

        <div style={{ fontSize: '10px', color: '#585b70', marginTop: 'auto' }}>
          Type "reset" in the chat at any time to resend the consent card.
          <br />
          Changing any toggle restarts the WebChat instance.
        </div>
      </div>

      {/* WebChat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: '#0078d4',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Scheduling Agent</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              M365 Agents SDK •{' '}
              {cardType === 'execute' ? 'Action.Execute' : 'Action.Submit'} •{' '}
              {enableExecuteFix
                ? '🟢 Fix enabled'
                : cardType === 'submit'
                  ? '🟢 Works natively'
                  : '🔴 No fix'}
            </div>
          </div>
        </div>

        {/* WebChat */}
        <div style={{ flex: 1 }}>
          <WebChatInstance
            key={instanceKey}
            cardType={cardType}
            enableDiagnostics={enableDiagnostics}
            enableExecuteFix={enableExecuteFix}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================
// UI Components
// ============================================================

const Section: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <div>
    <div
      style={{
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#89b4fa',
        marginBottom: '4px',
      }}
    >
      {title}
    </div>
    {description && (
      <div style={{ fontSize: '11px', color: '#6c7086', marginBottom: '8px' }}>
        {description}
      </div>
    )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{children}</div>
  </div>
);

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}> = ({ checked, onChange, label, description }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '8px 10px',
      backgroundColor: checked ? '#313244' : '#181825',
      borderRadius: '6px',
      cursor: 'pointer',
      border: `1px solid ${checked ? '#89b4fa' : '#313244'}`,
      transition: 'all 0.15s',
    }}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ marginTop: '2px', accentColor: '#89b4fa' }}
    />
    <div>
      <div style={{ fontSize: '13px', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '11px', color: '#6c7086' }}>{description}</div>
    </div>
  </label>
);

const RadioOption: React.FC<{
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  tag: string;
  tagColor: string;
}> = ({ name, value, checked, onChange, label, tag, tagColor }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 10px',
      backgroundColor: checked ? '#313244' : '#181825',
      borderRadius: '6px',
      cursor: 'pointer',
      border: `1px solid ${checked ? '#89b4fa' : '#313244'}`,
    }}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={onChange}
      style={{ accentColor: '#89b4fa' }}
    />
    <span style={{ fontSize: '13px', fontWeight: 600 }}>{label}</span>
    <span
      style={{
        fontSize: '10px',
        backgroundColor: tagColor + '33',
        color: tagColor,
        padding: '1px 6px',
        borderRadius: '4px',
        marginLeft: 'auto',
      }}
    >
      {tag}
    </span>
  </label>
);

const StatusLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ fontSize: '12px' }}>
    <span style={{ color: '#6c7086' }}>{label}: </span>
    <span>{value}</span>
  </div>
);

export default App;

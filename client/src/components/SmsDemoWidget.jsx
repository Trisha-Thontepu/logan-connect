import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

const DEMO_PHONE_PREFIX = '619555';

function randomPhone() {
  return DEMO_PHONE_PREFIX + String(Math.floor(1000 + Math.random() * 9000));
}

const STARTERS = [
  { label: 'Start in English', body: 'hi' },
  { label: 'Empezar en español', body: 'hola' },
];

export default function SmsDemoWidget({ businessSlug }) {
  const [phone] = useState(randomPhone);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(body) {
    if (!body.trim() || sending) return;
    setSending(true);
    setStarted(true);
    setMessages((m) => [...m, { direction: 'outbound_user', body }]);
    setInput('');
    try {
      const result = await api.sendSms({ phone, body, businessSlug });
      setMessages((m) => [...m, { direction: 'inbound_business', body: result.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { direction: 'inbound_business', body: `(demo error: ${err.message})` },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="sms-widget">
      <div className="sms-widget-header">
        <span className="eyebrow">Try it — no real phone needed</span>
        <h3>Text to book, in English or Spanish</h3>
        <p className="sms-widget-sub">
          This is the actual booking engine, simulated over HTTP instead of a real SMS carrier.
          Demo number: <span className="mono">+1 ({DEMO_PHONE_PREFIX.slice(0,3)}) {DEMO_PHONE_PREFIX.slice(3)}-····</span>
        </p>
      </div>

      <div className="sms-thread" ref={scrollRef}>
        {!started && (
          <div className="sms-thread-empty">
            Send a message to start the conversation. Try "hi" or "hola".
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`sms-bubble ${m.direction === 'outbound_user' ? 'sms-bubble-user' : 'sms-bubble-biz'}`}
          >
            {m.body}
          </div>
        ))}
        {sending && <div className="sms-bubble sms-bubble-biz sms-bubble-typing">···</div>}
      </div>

      {!started ? (
        <div className="sms-starters">
          {STARTERS.map((s) => (
            <button key={s.label} className="btn-pill" onClick={() => send(s.body)}>
              {s.label}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="sms-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a reply… e.g. gel manicure thursday 3pm"
            aria-label="Message"
          />
          <button type="submit" className="btn-pill btn-pill-solid" disabled={sending}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}

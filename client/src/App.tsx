import { useState } from 'react';
import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import LandingPage from './components/LandingPage';

export default function App() {
  const [userName, setUserName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [inSession, setInSession] = useState(false);

  const handleJoinSession = (name: string, session: string) => {
    setUserName(name);
    setSessionId(session);
    setInSession(true);
  };

  const handleExit = () => {
    setInSession(false);
    setSessionId('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {!inSession ? (
        <LandingPage onJoinSession={handleJoinSession} />
      ) : (
        <>
          <div style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999,
            background: '#1e293b',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontFamily: 'sans-serif',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            whiteSpace: 'nowrap'
          }}>
            <button
              onClick={handleExit}
              style={{
                background: '#ef4444',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '12px',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ← Exit
            </button>

            <span>
              Session: <strong>{sessionId}</strong> |
              User: <strong>{userName}</strong>
            </span>
          </div>

          <Tldraw autoFocus />
        </>
      )}
    </div>
  );
}

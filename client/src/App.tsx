import { useState, useMemo } from 'react';
import { Tldraw, type TLAsset } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import LandingPage from './components/LandingPage';
import { useYjsStore } from './useYjsStore';
import CustomUI from './components/CustomUI';

export default function App() {
  const [userName, setUserName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [inSession, setInSession] = useState(false);

  // --- DYNAMIC INFRASTRUCTURE SENSING ---
  const isProd = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');

  // Try to find the backend app based on common patterns
  let detectedBackend = window.location.hostname;
  if (detectedBackend.includes('-frontend')) {
    detectedBackend = detectedBackend.replace('-frontend', '-backend');
  } else if (detectedBackend.includes('front')) {
    detectedBackend = detectedBackend.replace('front', 'back');
  }

  const backendBaseUrl = import.meta.env.VITE_BACKEND_URL ||
    (isProd ? `https://${detectedBackend}` : 'http://localhost:5002');

  let signalingUrl = backendBaseUrl.replace('http', 'ws');

  // FINAL FAIL-SAFE: If production signaling is accidentally pointing to frontend, flip it!
  if (isProd && signalingUrl.includes('frontend')) {
    signalingUrl = signalingUrl.replace('frontend', 'backend');
    console.warn('⚠️ WEAVE: Signaling URL was pointing to frontend. Auto-redirected to backend.');
  }

  console.log('🌐 WEAVE Infrastructure:', { isProd, backendBaseUrl, signalingUrl });

  // This connects us to the sharing network
  const storeWithStatus = useYjsStore({
    roomId: sessionId,
    hostUrl: signalingUrl
  });

  const handleJoinSession = (name: string, session: string) => {
    setUserName(name);
    setSessionId(session);
    setInSession(true);
  };

  const handleExit = () => {
    setInSession(false);
    setSessionId('');
  };

  // This handles uploading images to our server
  const imageService = useMemo(() => {
    return {
      upload: async (_asset: TLAsset, file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch(`${backendBaseUrl}/api/upload`, {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) throw new Error('Upload failed');
          const data = await response.json();
          return { src: data.url };
        } catch (e) {
          console.error('Upload error:', e);
          throw e;
        }
      },
      resolve: (asset: TLAsset) => {
        return asset.props.src;
      }
    };
  }, [backendBaseUrl]);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {!inSession ? (
        <LandingPage onJoinSession={handleJoinSession} />
      ) : (
        <>
          {/* Simple header to show session info */}
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
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
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
              Room: <strong>{sessionId}</strong> |
              User: <strong>{userName}</strong> |
              👥 <strong>{storeWithStatus.peerCount || 1}</strong>
            </span>
          </div>

          <Tldraw
            store={storeWithStatus.store}
            autoFocus
            assets={imageService}
            licenseKey="hackathon-presentation-2024"
          >
            <CustomUI storeWithStatus={storeWithStatus} />
          </Tldraw>
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useEditor } from '@tldraw/tldraw';
import * as Y from 'yjs';
import ChatPanel from './ChatPanel';
import VoiceManager from './VoiceManager';

export default function CustomUI({ storeWithStatus }: { storeWithStatus: any }) {
    const editor = useEditor();
    const [presenterId, setPresenterId] = useState<string | null>(null);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Follow-Me Presentation Mode
    useEffect(() => {
        if (!storeWithStatus.provider || !editor) return;

        const provider = storeWithStatus.provider;

        const handleAwarenessChange = () => {
            const states = provider.awareness.getStates();
            let currentPresenter = null;

            // Find if anyone has clicked 'Present'
            for (const [clientId, state] of states.entries()) {
                if (state.isPresenting) {
                    currentPresenter = clientId.toString();
                    if (clientId !== provider.awareness.clientID && state.camera) {
                        try {
                            editor.setCamera({ x: state.camera.x, y: state.camera.y, z: state.camera.z }, { animation: { duration: 50 } });
                        } catch (e) {
                            console.error('Failed to set camera:', e);
                        }
                    }
                }
            }
            setPresenterId(currentPresenter);

            // Sync camera for everyone else if I'm not the one presenting
<<<<<<< HEAD
            const myId = provider.awareness.clientID; // Must be string to match currentPresenter
=======
            const myId = provider.awareness.clientID;
>>>>>>> d7016ae (fix: revert controls bar back to bottom-right position)
            const someoneElsePresenting = currentPresenter !== null && currentPresenter !== myId;

            // LOCK/UNLOCK editing: Follower should be locked, Presenter should be unlocked.
            if (someoneElsePresenting) {
                console.log('Board locked: Following the presenter');
                editor.updateInstanceState({ isReadonly: true });
            } else {
                console.log('Board unlocked: You can draw now');
                editor.updateInstanceState({ isReadonly: false });
            }
        };

        provider.awareness.on('change', handleAwarenessChange);

        let rafId: number;
        const syncCamera = () => {
            // IF I AM THE PRESENTER, broadcast my camera!
            if (provider.awareness.getLocalState()?.isPresenting) {
                provider.awareness.setLocalStateField('camera', editor.getCamera());
            }
            rafId = requestAnimationFrame(syncCamera);
        };
        rafId = requestAnimationFrame(syncCamera);

        return () => {
            provider.awareness.off('change', handleAwarenessChange);
            cancelAnimationFrame(rafId);
            // Restore editing capability on unmount
            editor.updateInstanceState({ isReadonly: false });
        };
    }, [storeWithStatus.provider, editor]); // Removed presenterId from deps to allow internal loop

    const togglePresent = () => {
        if (!storeWithStatus.provider) return;
        const isPresenting = storeWithStatus.provider.awareness.getLocalState()?.isPresenting;

        if (isPresenting) {
            storeWithStatus.provider.awareness.setLocalStateField('isPresenting', false);
            storeWithStatus.provider.awareness.setLocalStateField('camera', null);
        } else {
            storeWithStatus.provider.awareness.setLocalStateField('isPresenting', true);
            storeWithStatus.provider.awareness.setLocalStateField('camera', editor.getCamera());
        }
    };


    // Time-Travel History Playback
    const maxHistory = storeWithStatus.updateHistory ? storeWithStatus.updateHistory.length : 0;
    const isTimeTraveling = historyIndex !== -1 && historyIndex < maxHistory;

    const handleHistoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const index = parseInt(e.target.value);

        if (!storeWithStatus.updateHistory || !storeWithStatus.ydoc) return;

        // Pause synchronization to prevent time-traveling deletions from broadcasting to peers
        if (storeWithStatus.setSyncPaused) {
            storeWithStatus.setSyncPaused(index < maxHistory);
        }

        if (index >= maxHistory) {
            setHistoryIndex(-1);
            // Restore live state
            const records = Array.from(storeWithStatus.ydoc.getMap('tldraw').values());
            editor.store.mergeRemoteChanges(() => {
                const currentIds = Array.from(editor.store.allRecords()).map(r => r.id);
                const recordsToRemove = currentIds.filter(id => !['camera', 'instance', 'instance_page_state', 'pointer', 'page_states', 'instance_presence'].includes(id.split(':')[0]));
                editor.store.remove(recordsToRemove);
                editor.store.put(records as any);
            });
            return;
        }

        setHistoryIndex(index);

        /**
         * 🕰️ TIME TRAVEL LOGIC:
         * We create a temporary Y.Doc, apply all updates up to the selected index,
         * and then replace the local Tldraw board with those ancient records.
         */
        const tempDoc = new Y.Doc();
        for (let i = 0; i < index + 1; i++) {
            Y.applyUpdate(tempDoc, storeWithStatus.updateHistory[i]);
        }
        const tempMap = tempDoc.getMap('tldraw');
        const oldRecords = Array.from(tempMap.values());

        editor.store.mergeRemoteChanges(() => {
            const currentIds = Array.from(editor.store.allRecords()).map(r => r.id);
            const recordsToRemove = currentIds.filter(id => !['camera', 'instance', 'instance_page_state', 'pointer', 'page_states', 'instance_presence'].includes(id.split(':')[0]));
            editor.store.remove(recordsToRemove);
            editor.store.put(oldRecords as any);
        });
    };

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    const myId = storeWithStatus.provider?.awareness.clientID.toString() || 'unknown';
    const isFollowing = presenterId !== null && presenterId !== myId;

    return (
        <>
            {isChatOpen && (
                <div style={{
                    position: 'absolute',
                    bottom: '120px',
                    right: '20px',
                    zIndex: 9999
                }}>
                    <ChatPanel yChat={storeWithStatus.yChat} currentUserId={myId} />
                </div>
            )}

            <VoiceManager provider={storeWithStatus.provider} isMuted={isMuted} />

            <div style={{
                position: 'absolute',
                bottom: 60,
                right: 20,
                zIndex: 9999,
                display: 'flex',
                gap: '15px',
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '10px 20px',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                backdropFilter: 'blur(5px)',
                alignItems: 'center',
                fontFamily: 'Inter, sans-serif'
            }}>
                {!isFollowing && (
                    <>
                        <button
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: isChatOpen ? '#4f46e5' : '#f1f5f9',
                                color: isChatOpen ? 'white' : '#1e293b',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>💬</span> {isChatOpen ? 'Close Chat' : 'Chat'}
                        </button>

                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: !isMuted ? '#ef4444' : '#f1f5f9',
                                color: !isMuted ? 'white' : '#1e293b',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>{isMuted ? '🔇' : '🎙️'}</span> {isMuted ? 'Unmute' : 'Mute'}
                        </button>
                        <button
                            onClick={togglePresent}
                            disabled={isTimeTraveling}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: presenterId === myId ? '#ef4444' : (isTimeTraveling ? '#ccc' : '#10b981'),
                                color: 'white',
                                fontWeight: 'bold',
                                cursor: isTimeTraveling ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {presenterId === myId ? 'Stop Presenting' : 'Present (Follow Me)'}
                        </button>
                    </>
                )}

                {isFollowing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: isChatOpen ? '#4f46e5' : '#f1f5f9',
                                color: isChatOpen ? 'white' : '#1e293b',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>💬</span>
                        </button>
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: !isMuted ? '#ef4444' : '#f1f5f9',
                                color: !isMuted ? 'white' : '#1e293b',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>{isMuted ? '🔇' : '🎙️'}</span>
                        </button>
                        <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>
                            🎥 Following Presenter...
                        </span>
                    </div>
                )}

                {!isFollowing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #ddd', paddingLeft: '15px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>⏳ Time Travel:</span>
                        <input
                            type="range"
                            min={0}
                            max={maxHistory}
                            value={historyIndex === -1 ? maxHistory : historyIndex}
                            onChange={handleHistoryChange}
                            style={{ cursor: 'pointer', width: '150px' }}
                        />
                    </div>
                )}
            </div>
        </>
    );
}

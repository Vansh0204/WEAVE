import { useEffect, useState } from 'react';
import {
    createTLStore,
    defaultShapeUtils,
    throttle,
    type TLRecord,
    type TLStoreWithStatus,
} from '@tldraw/tldraw';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

export function useYjsStore({ roomId, hostUrl }: { roomId: string; hostUrl: string }) {
    const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus & {
        peerCount: number,
        provider?: WebrtcProvider,
        ydoc?: Y.Doc,
        yChat?: Y.Array<any>,
        updateHistory?: Uint8Array[],
        historyTriggers?: number,
        setSyncPaused?: (paused: boolean) => void
    }>({
        status: 'loading',
        peerCount: 1,
        historyTriggers: 0
    });

    // Determine the signaling URL dynamically
    const signalingUrl = hostUrl || import.meta.env.VITE_SIGNALING_URL || `ws://${window.location.hostname}:5002`;

    useEffect(() => {
        if (!roomId) return;

        const store = createTLStore({ shapeUtils: defaultShapeUtils });
        const ydoc = new Y.Doc();

        console.table({
            'WEAVE Status': 'Connecting...',
            'Room ID': roomId,
            'Signaling Server': signalingUrl,
            'Mode': window.location.hostname === 'localhost' ? 'Development' : 'Production'
        });

        const provider = new WebrtcProvider(roomId, ydoc, {
            signaling: [signalingUrl],
        });

        provider.on('status', (event: any) => {
            console.log('📡 WebRTC Status:', event.status);
            if (event.status === 'connected') {
                console.log('✅ WebRTC Connected to signaling server.');
            }
        });

        const yStore = ydoc.getMap<TLRecord>('tldraw');
        const yChat = ydoc.getArray<any>('chat_messages');
        const updateHistory: Uint8Array[] = [];
        let isPaused = false;

        updateHistory.push(Y.encodeStateAsUpdate(ydoc));

        const handleAwareness = () => {
            const count = provider.awareness.getStates().size;
            setStoreWithStatus(s => ({ ...s, peerCount: count || 1 }));
        };
        provider.awareness.on('change', handleAwareness);

        const isLocalOnly = (record: TLRecord) => {
            return [
                'camera', 'instance', 'instance_page_state', 'page_states', 'pointer', 'instance_presence'
            ].includes(record.typeName);
        };

        const handleSync = () => {
            console.log('📦 Board Synced with peers.');
            const records = Array.from(yStore.values()).filter(r => !isLocalOnly(r));
            if (records.length > 0) {
                store.mergeRemoteChanges(() => {
                    store.put(records);
                });
            }
            setStoreWithStatus(s => ({
                ...s,
                status: 'synced-remote',
                connectionStatus: 'online',
                store,
                provider,
                ydoc,
                yChat,
                updateHistory,
                setSyncPaused: (paused: boolean) => { isPaused = paused; }
            } as any));
        };

        ydoc.on('update', (update) => {
            updateHistory.push(update);
            setStoreWithStatus(s => ({ ...s, historyTriggers: (s.historyTriggers || 0) + 1 }));
        });

        const unlisten = store.listen(
            throttle((history: any) => {
                if (history.source === 'remote' || isPaused) return;

                const { added, updated, removed } = history.changes;
                ydoc.transact(() => {
                    if (added) {
                        Object.values(added).forEach((record) => {
                            const r = record as TLRecord;
                            if (!isLocalOnly(r)) yStore.set(r.id, r);
                        });
                    }
                    if (updated) {
                        Object.values(updated).forEach((update) => {
                            const [, record] = update as [TLRecord, TLRecord];
                            if (!isLocalOnly(record)) yStore.set(record.id, record);
                        });
                    }
                    if (removed) {
                        Object.values(removed).forEach((record) => {
                            const r = record as TLRecord;
                            if (!isLocalOnly(r)) yStore.delete(r.id);
                        });
                    }
                });
            }, 16)
        );

        const handleYUpdate = (e: Y.YMapEvent<TLRecord>) => {
            if (e.transaction.local) return;
            const toPut: TLRecord[] = [];
            const toRemove: string[] = [];
            e.changes.keys.forEach((change, id) => {
                switch (change.action) {
                    case 'add':
                    case 'update': {
                        const record = yStore.get(id);
                        if (record) toPut.push(record);
                        break;
                    }
                    case 'delete': {
                        toRemove.push(id as any);
                        break;
                    }
                }
            });
            if (toPut.length > 0 || toRemove.length > 0) {
                store.mergeRemoteChanges(() => {
                    if (toRemove.length > 0) store.remove(toRemove as any);
                    if (toPut.length > 0) store.put(toPut);
                });
            }
        };

        yStore.observe(handleYUpdate);
        provider.on('synced', handleSync);

        return () => {
            unlisten();
            yStore.unobserve(handleYUpdate);
            provider.awareness.off('change', handleAwareness);
            provider.off('synced', handleSync);
            provider.destroy();
            ydoc.destroy();
        };
    }, [roomId, hostUrl, signalingUrl]);

    return storeWithStatus;
}

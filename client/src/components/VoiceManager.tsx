import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { WebrtcProvider } from 'y-webrtc';

interface VoiceManagerProps {
    provider: WebrtcProvider | undefined;
    isMuted: boolean;
}

export default function VoiceManager({ provider, isMuted }: VoiceManagerProps) {
    // Current active audio streams from our peers
    const [streams, setStreams] = useState<{ [id: string]: MediaStream }>({});
    const myStreamRef = useRef<MediaStream | null>(null);
    const peersRef = useRef<{ [id: string]: Peer.Instance }>({});
    const processedSignalsRef = useRef<{ [peerId: string]: Set<string> }>({});
    const myId = provider?.awareness.clientID.toString();

    useEffect(() => {
        if (!provider || !myId) return;

        const setupMic = async () => {
            console.log('🎙️ VoiceManager: Setting up microphone...');
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    console.error('❌ Browser does not support getUserMedia. (Check if using HTTPS!)');
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                console.log('✅ Microphone access granted.');
                myStreamRef.current = stream;

                // Set initial mute state
                stream.getAudioTracks().forEach(t => t.enabled = !isMuted);

                const awareness = provider.awareness;

                const handleAwarenessUpdate = () => {
                    const states = awareness.getStates();
                    states.forEach((state: any, clientId: any) => {
                        const peerId = clientId.toString();
                        if (peerId === myId) return;

                        // Check if this peer is ready for a voice call
                        if (!peersRef.current[peerId] && state.voiceSignalInit) {
                            // Deterministic initiator: the one with the higher ID starts
                            const isInitiator = parseInt(myId!) > parseInt(peerId);
                            console.log(`🤝 VoiceManager: Found peer ${peerId}. Initiating: ${isInitiator}`);
                            initiatePeer(peerId, isInitiator);
                        }
                    });
                };

                const initiatePeer = (peerId: string, initiator: boolean) => {
                    if (peersRef.current[peerId]) return;

                    console.log(`📡 VoiceManager: Creating peer object for ${peerId} (Initiator: ${initiator})`);
                    const p = new Peer({
                        initiator,
                        trickle: false,
                        stream: myStreamRef.current!,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:global.stun.twilio.com:3478' }
                            ]
                        }
                    });

                    p.on('signal', (data) => {
                        /**
                         * 💡 COOL HACK: Signaling via Yjs Awareness!
                         * Usually WebRTC needs a signaling server. We're using Yjs Awareness
                         * to broadcast our WebRTC handshake signals to each other.
                         * This avoids a complex backend setup.
                         */
                        console.log(`📤 VoiceManager: Sending signal to ${peerId}`);
                        awareness.setLocalStateField(`signal_${peerId}`, data);
                        if (initiator) {
                            awareness.setLocalStateField('voiceSignalInit', true);
                        }
                    });

                    p.on('connect', () => {
                        console.log(`🎉 VoiceManager: P2P Connected with ${peerId}!`);
                    });

                    p.on('stream', (remoteStream) => {
                        console.log(`🎵 VoiceManager: Receiving audio stream from ${peerId}`);
                        setStreams(prev => ({ ...prev, [peerId]: remoteStream }));
                    });

                    p.on('error', (err) => {
                        console.error(`❌ VoiceManager: Peer error with ${peerId}:`, err);
                    });

                    p.on('close', () => {
                        console.log(`👋 VoiceManager: Connection closed with ${peerId}`);
                        delete peersRef.current[peerId];
                        delete processedSignalsRef.current[peerId];
                        setStreams(prev => {
                            const newStreams = { ...prev };
                            delete newStreams[peerId];
                            return newStreams;
                        });
                    });

                    peersRef.current[peerId] = p;
                };

                // Trigger initiation for others
                console.log('📢 VoiceManager: Broadcasting that I am ready for voice.');
                awareness.setLocalStateField('voiceSignalInit', true);

                awareness.on('change', () => {
                    const states = awareness.getStates();
                    states.forEach((state: any, clientId: any) => {
                        const peerId = clientId.toString();
                        if (peerId === myId) return;

                        const incomingSignal = state[`signal_${myId}`];
                        if (incomingSignal) {
                            const signalStr = JSON.stringify(incomingSignal);
                            if (!processedSignalsRef.current[peerId]) {
                                processedSignalsRef.current[peerId] = new Set();
                            }

                            // Only process this specific signal if we haven't seen it before
                            if (!processedSignalsRef.current[peerId].has(signalStr)) {
                                processedSignalsRef.current[peerId].add(signalStr);

                                if (peersRef.current[peerId]) {
                                    try {
                                        console.log(`📥 VoiceManager: Processing NEW incoming signal from ${peerId}`);
                                        (peersRef.current[peerId] as any).signal(incomingSignal);
                                    } catch (e) {
                                        console.error(`❌ VoiceManager: Signal error with ${peerId}:`, e);
                                    }
                                } else {
                                    console.log(`📥 VoiceManager: Received NEW signal from ${peerId} before peer creation. Creating now...`);
                                    initiatePeer(peerId, false);
                                    (peersRef.current[peerId] as any).signal(incomingSignal);
                                }
                            }
                        }
                    });
                    handleAwarenessUpdate();
                });

            } catch (err: any) {
                console.error('❌ VoiceManager: Microphone access denied or Error:', err);
                if (err.name === 'NotAllowedError') {
                    alert('Please allow microphone access in your browser to use Voice Chat.');
                }
            }
        };

        setupMic();

        return () => {
            console.log('🧹 VoiceManager: Cleaning up...');
            myStreamRef.current?.getTracks().forEach(track => track.stop());
            Object.values(peersRef.current).forEach(p => p.destroy());
        };
    }, [provider, myId]);

    useEffect(() => {
        if (myStreamRef.current) {
            console.log(`🎤 VoiceManager: Mic ${isMuted ? 'MUTED' : 'UNMUTED'}`);
            myStreamRef.current.getAudioTracks().forEach(t => t.enabled = !isMuted);
        }
    }, [isMuted]);

    return (
        <div style={{ display: 'none' }}>
            {Object.entries(streams).map(([id, stream]) => (
                <AudioPlayer key={id} stream={stream} />
            ))}
        </div>
    );
}

function AudioPlayer({ stream }: { stream: MediaStream }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        if (audioRef.current) audioRef.current.srcObject = stream;
    }, [stream]);
    return <audio ref={audioRef} autoPlay />;
}

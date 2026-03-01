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
                    console.error('❌ VoiceManager: Browser does not support getUserMedia. (Check HTTPS!)');
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                console.log('✅ VoiceManager: Microphone access granted.');
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
                            console.log(`🤝 VoiceManager: Peer ${peerId} discovered. Role: ${isInitiator ? 'Initiator' : 'Receiver'}`);
                            initiatePeer(peerId, isInitiator);
                        }
                    });
                };

                const initiatePeer = (peerId: string, initiator: boolean) => {
                    if (peersRef.current[peerId]) return;

                    console.log(`📡 VoiceManager: Spawning Peer for ${peerId}...`);
                    const p = new Peer({
                        initiator,
                        trickle: false,
                        stream: myStreamRef.current!,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:stun1.l.google.com:19302' },
                                { urls: 'stun:stun2.l.google.com:19302' },
                                { urls: 'stun:global.stun.twilio.com:3478' }
                            ]
                        }
                    });

                    p.on('signal', (data) => {
                        console.log(`📤 VoiceManager: Signal generated for ${peerId}, sending via Yjs...`);
                        awareness.setLocalStateField(`signal_${peerId}`, data);
                        if (initiator) {
                            awareness.setLocalStateField('voiceSignalInit', true);
                        }
                    });

                    p.on('connect', () => {
                        console.log(`🎉 VoiceManager: WebRTC P2P CONNECTED with ${peerId}!`);
                    });

                    p.on('stream', (remoteStream) => {
                        console.log(`🎵 VoiceManager: REMOTE STREAM DETECTED from ${peerId}`);
                        setStreams(prev => ({ ...prev, [peerId]: remoteStream }));
                    });

                    p.on('error', (err) => {
                        console.error(`❌ VoiceManager: Peer ${peerId} error:`, err);
                    });

                    p.on('close', () => {
                        console.log(`👋 VoiceManager: Connection with ${peerId} closed.`);
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
                console.log('📢 VoiceManager: Signating readiness for voice calls.');
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

                            if (!processedSignalsRef.current[peerId].has(signalStr)) {
                                processedSignalsRef.current[peerId].add(signalStr);

                                if (peersRef.current[peerId]) {
                                    try {
                                        console.log(`📥 VoiceManager: Applying incoming signal from ${peerId}`);
                                        (peersRef.current[peerId] as any).signal(incomingSignal);
                                    } catch (e) {
                                        console.error(`❌ VoiceManager: Failed to apply signal from ${peerId}:`, e);
                                    }
                                } else {
                                    console.log(`📥 VoiceManager: Late signal received from ${peerId}, force-creating receiver peer.`);
                                    initiatePeer(peerId, false);
                                    (peersRef.current[peerId] as any).signal(incomingSignal);
                                }
                            }
                        }
                    });
                    handleAwarenessUpdate();
                });

            } catch (err: any) {
                console.error('❌ VoiceManager: Critical Error:', err);
                if (err.name === 'NotAllowedError') {
                    alert('Microphone access is blocked! Please enable it in browser settings.');
                }
            }
        };

        setupMic();

        return () => {
            console.log('🧹 VoiceManager: Destroying all voice connections...');
            myStreamRef.current?.getTracks().forEach(track => track.stop());
            Object.values(peersRef.current).forEach(p => p.destroy());
        };
    }, [provider, myId]);

    useEffect(() => {
        if (myStreamRef.current) {
            console.log(`🎤 VoiceManager: Local Mic ${isMuted ? 'MUTED' : 'UNMUTED'}`);
            myStreamRef.current.getAudioTracks().forEach(t => t.enabled = !isMuted);
        }
    }, [isMuted]);

    return (
        <div style={{ display: 'none' }}>
            {Object.entries(streams).map(([id, stream]) => (
                <AudioPlayer key={id} stream={stream} peerId={id} />
            ))}
        </div>
    );
}

function AudioPlayer({ stream, peerId }: { stream: MediaStream; peerId: string }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current) {
            console.log(`🔊 AudioPlayer: Attaching stream for peer ${peerId}`);
            audioRef.current.srcObject = stream;

            // Explicitly call play to handle browser autoplay policies
            const playAudio = async () => {
                try {
                    await audioRef.current?.play();
                    console.log(`▶️ AudioPlayer: Playing audio for ${peerId}`);
                } catch (err) {
                    console.warn(`⚠️ AudioPlayer: Autoplay blocked for ${peerId}. User interaction required.`);
                }
            };
            playAudio();
        }
    }, [stream, peerId]);

    return (
        <audio
            ref={audioRef}
            autoPlay
            playsInline
            controls={false}
            style={{ display: 'none' }}
        />
    );
}

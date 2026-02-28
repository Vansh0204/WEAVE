import { useState } from 'react';
import './LandingPage.css';
import { v4 as uuidv4 } from 'uuid';

interface LandingPageProps {
    onJoinSession: (userName: string, sessionId: string) => void;
}

export default function LandingPage({ onJoinSession }: LandingPageProps) {
    const [name, setName] = useState('');
    const [room, setRoom] = useState('');

    const handleCreate = () => {
        if (!name.trim()) return alert("Please enter your name");
        const newRoomId = uuidv4().slice(0, 8); // Short memorable ID
        onJoinSession(name, newRoomId);
    };

    const handleJoin = () => {
        if (!name.trim()) return alert("Please enter your name");
        if (!room.trim()) return alert("Please enter a Session ID");
        onJoinSession(name, room);
    };

    return (
        <div className="landing-container">
            <div className="landing-card">
                <h1>WEAVE</h1>
                <p>Decentralized Real-Time Collaboration</p>

                <div className="input-group">
                    <input
                        type="text"
                        className="landing-input"
                        placeholder="Your Name (e.g. Alice)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <input
                        type="text"
                        className="landing-input"
                        placeholder="Session ID (to join)"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button className="btn-primary" onClick={handleJoin}>
                        Join Session
                    </button>
                    <div style={{ color: '#475569', fontSize: '0.875rem', margin: '0.5rem 0' }}>OR</div>
                    <button className="btn-secondary" onClick={handleCreate}>
                        Create New Session
                    </button>
                </div>
            </div>
        </div>
    );
}

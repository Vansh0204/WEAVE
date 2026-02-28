# WEAVE: Decentralized Real-Time Collaborative Whiteboard

## 1. Problem
Modern collaborative whiteboards rely on centralized servers for every interaction (drawing, cursor movement), causing:
- High latency for distributed users  
- Expensive server infrastructure  
- Single point of failure  

**Target Users:** Remote teams, designers, students  
**Existing Gaps:** Poor performance on low-bandwidth networks, costly WebSocket infrastructure, database conflicts during concurrent edits  

---

## 2. Approach
The core issue is centralized conflict resolution.

**Solution:** Use CRDTs (Conflict-Free Replicated Data Types) to enable a Peer-to-Peer (P2P) architecture via WebRTC, removing the need for a central synchronization server.

---

## 3. Proposed Solution
A **hybrid architecture**:
- Centralized backend → Authentication & room management  
- P2P WebRTC → Real-time data synchronization  

**Core Idea:** Decentralize the drawing engine for near zero-latency collaboration while keeping centralized security and persistence.

### Key Features:
- Infinite canvas (Tldraw)
- Conflict-free concurrent editing (Yjs CRDTs)
- Live multiplayer cursors & awareness
- AI-powered sticky note summarization (LLM integration)

---

## 4. System Architecture

**High-Level Flow:**

User → React/Tldraw → P2P WebRTC (Sync)  
OR  
User → REST API → Node Backend → MongoDB  

**Description:**
- Backend handles authentication and room metadata.
- After joining a room, browsers establish WebRTC peer connections.
- Drawing actions update a local `Y.Doc` CRDT, which calculates deltas and syncs P2P without routing through the Node server.

---

## 5. Database Design

Minimal persistent state for efficiency:

- **Users:** ID, Name, Email, PasswordHash  
- **Rooms:** RoomID, HostID, CreatedAt, SerializedCRDTState  

---

## 6. Dataset
Real-time user-generated text (sticky notes and canvas text nodes).

**Reason:** Brainstorming sessions produce unstructured data, ideal for AI-powered summarization.

---

## 7. Model
**LLM Integration (OpenAI / Gemini API)**  

**Purpose:** Summarize and extract insights from unstructured brainstorming content without training a custom ML model.

---

## 8. Technology Stack

**Frontend:** React (Vite), Tldraw, Yjs, y-webrtc  
**Backend:** Node.js, Express.js  
**Database:** MongoDB  
**AI/ML:** OpenAI API / Gemini API  
**Deployment:** Vercel (Frontend), Render/Railway (Backend)

---

---
name: "How a video chat works"
date: "2026-08-14"
desc: "A compact architecture tour of signaling, WebRTC, TURN, audio processing, and deployment"
---

I've put myself through the process of making a video chat so you don't have to.

You can try it out at [vivid.raafat.io](https://vivid.raafat.io) or view the source code at [github.com/raafatTurki/vivid](https://github.com/raafatTurki/vivid).

Vivid is a video chat, but the longer, more apt description would be **"A small-room, full-mesh WebRTC video-chat web-app"**.

It consists of a frontend, a signaling server, and a few pieces of tech here and there. The idea is to click and connect with another person, so it has no auth and no database.

---

## TL;DR

The signaling server introduces browsers and relays control messages; the browsers carry encrypted audio and video directly whenever possible, with `coturn` as the fallback relay.

```text
┌───────────────┐   WSS   ┌──────────────────────┐   WSS   ┌───────────────┐
│ Alice         │◄───────►│ Go signaling server  │◄───────►│ Bob           │
│ Svelte/WebRTC │         │ rooms / SDP / ICE    │         │ Svelte/WebRTC │
└──────┬────────┘         │ state / chat         │         └──────┬────────┘
       │                  └──────────────────────┘                │
       │                                                          │
       ├══════════════════════ direct WebRTC ═════════════════════┤
       │                                                          │
       │                                                          │
       ├═══════════ STUN hole punching + direct WebRTC ═══════════┤
       │                                                          │
       │                                                          │
       ╰═══════════════ WebRTC relayed via TURN-UDP ══════════════╯
```

---

## Advantages of P2P Full Mesh

The P2P architecture brings some advantages to the table:

- **The lowest latency possible**: Clients directly connect to each other with no man-in-the-middle relaying streams, connecting via the shortest path.
- **The lowest server cost possible**: The signaling server only introduces clients to each other, so server-side media bandwidth is zero.
- **No single point of failure**: If the signaling server shuts down after connection, users can still see and hear each other.
- **Privacy**: All media is end-to-end encrypted via DTLS-SRTP.

---

## Drawbacks & Trade-offs

However, it is a bit more complex to set up than a central media server (e.g. SFU) and has drawbacks:

- **Increased client-side bandwidth use**: Connection count scales with the number of clients in a room ($N$). Total links = $\frac{N(N - 1)}{2}$.

```text
       P2P FULL MESH                        CENTRAL SFU

          Alice                                Alice
         ╱  │  ╲                                 │
        ╱   │   ╲                                ▼
      Bob───┼───Carol                       ┌─────────┐
        ╲   │   ╱                           │   SFU   │
         ╲  │  ╱                            └─────────┘
          Dave                              ╱    │    ╲
                                           ▼     ▼     ▼
                                          Bob  Carol  Dave

      4 users : 6 connections             4 users : 4 connections
      8 users : 28 connections            8 users : 8 connections
```

- **Harder to implement media moderation/recording**: Because media is P2P and end-to-end encrypted, operations that usually require a central server are difficult.
- **Must bypass NAT and firewalls**: Direct connections may fail and must fall back to TURN, which requires a public server.

---

## How a Call Starts

Assume Bob joins a room where Alice is already inside waiting. The existing peer becomes the initial offerer after Bob announces that his peer connection is ready.

```text
Bob              Signaling Server        Alice                 STUN              TURN
 │                    │                    │                    │                 │
 │── open WSS(room) ─►│                    │                    │                 │
 │◄─ welcome + peers ─│                    │                    │                 │
 │                    │── peer-joined ────►│                    │                 │
 │── peer-ready ─────►│───────────────────►│                    │                 │
 │                    │                    │                    │                 │
 │◄───────────────────│◄────── SDP offer ──│                    │                 │
 │── SDP answer ─────►│───────────────────►│                    │                 │
 │                    │                    │                    │                 │
 │                    │                    │── STUN binding ───►│                 │
 │                    │                    │◄──── public addr ──│                 │
 │── STUN binding ─────────────────────────────────────────────►│                 │
 │◄────────────────────────────────────────────── public addr ──│                 │
 │                    │                    │                    │                 │
 │                    │                    │── TURN allocate ────────────────────►│
 │                    │                    │◄─────────────────────── relay addr ──│
 │── TURN allocate ──────────────────────────────────────────────────────────────►│
 │◄───────────────────────────────────────────────────────────────── relay addr ──│
 │                    │                    │                    │                 │
 │◄───────────────────│◄── ICE candidate ──│                    │                 │
 │── ICE candidate ──►│───────────────────►│                    │                 │
 │                    │                    │                    │                 │
 │◄────────────────────── ICE conn check ──│                    │                 │
 │── ICE conn response ───────────────────►│                    │                 │
 │── ICE conn check ──────────────────────►│                    │                 │
 │◄─────────────────── ICE conn response ──│                    │                 │
 │                    │                    │                    │                 │
 │             [ICE selects best working candidate pair]        │                 │
 │                    │                    │                    │                 │
 │◄═════════════ DTLS-SRTP media ═════════►│                    │                 │
 │          (if direct pair selected)      │                    │                 │
```

> **Note on sequence diagrams:** Sequence diagrams are slightly awkward for ICE because the destination of an ICE check is an IP:PORT represented by one of Alice's ICE candidates, but this illustrates the protocol flow.
> 
> TURN and STUN ordering is arbitrary since both are attempted in parallel.
> `coturn` is the TURN implementation used (VoIP media NAT traversal gateway). While coturn can provide STUN, Vivid uses `stun.cloudflare.com` for STUN resolution.

---

## ICE Candidate Hierarchy

ICE attempts to find a valid network path between peers:

```text
              ICE gathering
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
  local          STUN            TURN
    │              │              │
    ▼              ▼              ▼
  host           srflx          relay
candidate      candidate      candidate
```

---

## Why both WebSocket and WebRTC?

- **WebSocket** gives Vivid a reliable, ordered, centralized control channel for room coordination.
- **WebRTC** supplies real-time media transport, encryption, codec negotiation, congestion control, and NAT traversal.
- WebRTC deliberately leaves signaling to the application, so Vivid defines its own lightweight JSON protocol.
- **Chat** intentionally stays on WebSocket instead of `RTCDataChannel`. That keeps room broadcasting and in-memory history simple.

---

## Key Implementation Details

### 1. Perfect Negotiation Prevents Offer Collisions

Adding a screen share, camera, or microphone can trigger renegotiation. If both peers create an offer at once, Vivid uses the WebRTC **perfect-negotiation** pattern:

```text
  Alice changes tracks                 Bob changes tracks
          │                                   │
     createOffer()                       createOffer()
          │                                   │
          └─────────── collision ─────────────┘
                           │
             ┌─────────────┴─────────────┐
             │ polite peer rolls back    │
             │ impolite peer ignores     │
             │ one offer wins cleanly    │
             └───────────────────────────┘
```

The role is deterministic: one peer is polite and one is impolite based on their random peer IDs. The polite side yields, and the impolite side's offer proceeds cleanly.

### 2. ICE Candidates Are Buffered Until SDP Is Ready

```text
      ICE candidate arrives
                │
  ┌─────────────┴───────────────┐
  │ remoteDescription present?  │
  └───┬─────────────────────┬───┘
     yes                    no
      │                     │
  addIceCandidate()   queue candidate
                            │
                  flush after offer/answer
```

Candidate and SDP delivery are asynchronous. Buffering avoids calling `addIceCandidate()` before the remote description establishes the matching ICE context.

### 3. TURN Access Uses Short-Lived Credentials

```text
username   = <expiry Unix timestamp>:<peerID>
credential = Base64(HMAC-SHA1(sharedSecret, username))
```

Go and `coturn` share a static secret. The browser receives only a temporary username and credential. HMAC-SHA1 authenticates TURN access; it does not encrypt the media itself.

### 4. Full-Mesh Limits

- Pairwise links: $\frac{N(N - 1)}{2}$
- 8 participants = 28 links (7 remote peer connections per browser)

Mesh keeps the server architecture lean, but browser upload, decoding, and CPU scale quickly. The default 8-peer room limit is an intentional architectural guardrail.

### 5. Independent Server-Side Data Paths

```text
                              Hub
                    ┌──────────────────────┐
                    │ rooms + chat history │
                    │ protected by RWMutex │
                    └────▲─────────────┬───┘
                         │             │
                   validate/relay    outbound message
                         │             │
  ┌─────────┐      ┌─────┴──────┐    ┌─▼────────────────┐
  │ Network ├──────► readPump   │    │ buffered channel │
  │ Socket  ◄──────┤ writePump  ◄────┤ capacity: 256    │
  └─────────┘      └────────────┘    └──────────────────┘
```

---

## Microphone Audio Processing Pipeline

```text
  Physical microphone
        │
  getUserMedia()
        │
  48 kHz AudioContext
        │
  RNNoise WASM AudioWorkletNode
        │
  ChannelMergerNode (mono ─► left + right)
        │
  processed MediaStreamTrack
        │
  Web Audio mixer ◄── audio from screen sharing (Chromium single-tab audio)
        │
        ├────► RTCRtpSender for Alice
        ├────► RTCRtpSender for Bob
        └────► RTCRtpSender for ...
```

> Screensharing video creates its own separate video track per peer using the WebRTC `getDisplayMedia` API and renegotiates a new SDP.

---

## Noise Suppression with RNNoise & WASM

Browser built-in `echoCancellation` and `autoGainControl` are enabled, but built-in `noiseSuppression` is disabled in favor of client-side **RNNoise** (a stateless neural noise reduction algorithm in C running via WebAssembly).

Vivid uses `@timephy/rnnoise-wasm`, an `AudioWorkletNode` port of RNNoise 0.2 that runs real-time ML audio filtering directly in the browser.

---

## Deployment Architecture

Docker Compose manages 3 containers:
1. **Frontend server**: Svelte static bundle served via Caddy
2. **Signaling server**: Go distroless binary
3. **TURN server**: coturn

```text
  Internet
   │
   ▼
  ┌───────────────────────────────────────┐
  │ Caddy as an HTTPS / WSS reverse proxy │
  └─────────────┬─────────────────────────┘
          ┌─────┴─────┐
          ▼           ▼
  ┌───────────┐  ┌─────────────────────┐
  │ Caddy web │  │ Go signaling server │
  │ :8000     │  │ :8080               │
  └───────────┘  └─────────────────────┘

  Browsers ── UDP/STUN/TURN ──► coturn:3478 + relay ports
```

- Multi-stage Docker builds for minimal container size.
- Go signaling server runs in a non-root distroless container.
- Caddy serves Vite build assets and rewrites room paths like `/A1b2C3` to `index.html`.

---

## Boundaries & Future Considerations

- **Media is WebRTC-encrypted**, while signaling metadata (chat, SDP, ICE candidates) is relayed through Go.
- **Rooms and chat live in Go memory**, with no persistent database dependencies.
- **TURN uses UDP by default**; restrictive enterprise firewalls may require TURN over TCP/TLS (port 443).

---

And that concludes our tour!

*Box-drawing diagrams created with [asciiflow.com](https://asciiflow.com).*

— **Raafat**

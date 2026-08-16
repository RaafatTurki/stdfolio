---
name: "How a video chat works"
date: "2026-08-14"
desc: "I made a video chat so you don't have to"
---

I built [Vivid](https://vivid.raafat.io), a small video chat application,
mostly because I wanted to understand what actually happens between clicking Join and seeing another person's face on the screen.

The source code is available [here](https://github.com/raafatTurki/vivid).

For the rest of this article I'll be walking you through what I've learned and how video chatting works in general.


---
## In a nutshell

At first glance, a video call sounds straightforward:

1. Get video and audio from the camera.
1. Send it to someone else.
1. Display and Play them.

The first and third steps really are fairly straightforward. The second one is where almost all of the interesting problems live.

Browsers usually cannot simply open a connection to each other.
They're behind routers, NATs, firewalls, VPNs, corporate networks, mobile carriers,
and various other pieces of networking infrastructure that would rather not accept arbitrary incoming traffic.

[WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) solves a lot of this, but it doesn't do so with a single protocol or API.
Establishing a call involves signaling, SDP, ICE, STUN, TURN, NAT traversal, media tracks, and a surprising number of state machines.

Vivid is my attempt at putting those pieces together while keeping the architecture relatively small.

The big picture looks roughly like this:

```ascii
┌─────────┐   signaling   ┌───────────┐   signaling   ┌─────────┐
│  Alice  │◄─────────────►│ Go Server │◄─────────────►│   Bob   │
└────┬────┘               └───────────┘               └────┬────┘
     │                                                     │
     ├════════════════════ direct WebRTC ══════════════════┤ attempt #1
     │                                                     │
     ├══════════ STUN hole punching + direct WebRTC ═══════┤ attempt #2
     │                                                     │
     ╰══════════════ WebRTC relayed via TURN-UDP ══════════╯ attempt #3
```

The server helps the browsers find and negotiate with each other.

Once that succeeds, audio and video normally travel directly between the browsers.

When a direct connection isn't possible, the media can instead travel through a TURN relay:

Browser A ◄──► TURN ◄──► Browser B

That distinction between signaling and media is the useful mental model for everything that follows.

---

## Starting with a camera and microphone

Before worrying about networks, we need something to send.

Browsers expose cameras and microphones through [navigator.mediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia):

```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
```
The resulting `MediaStream` contains individual `MediaStreamTrack`s.

Usually that means something roughly like:
```ascii
MediaStream
├── audio track
└── video track
```
There are already some annoying details here.

Permission can be denied. The requested camera may no longer exist. Another application might be using it. Mobile devices may have multiple front and rear cameras. A device may disappear while the call is running.

Those problems matter when building the application, but they're not really WebRTC problems yet.

At this point we just have local media.

We still need another browser to send it to.

---

## How does one browser find another?

Suppose Alice and Bob both open Vivid and enter the same room.

Alice's browser doesn't know Bob exists.\
Bob's browser doesn't know Alice exists.\
And neither browsers initially knows how to contact the other.

This is where a **signaling server** comes in.

Vivid runs a small Go server that accepts WebSocket connections.
When a browser joins, it connects to the signaling server with the room ID:
`wss://signal.example.com/v1/ws?room=ABC123`

The server assigns the client a peer ID and places it into an in-memory room.

Say Alice joins first then Bob joins afterwards,
The server tells Bob which peers are already there and tells Alice that Bob has joined.

Conceptually:

```ascii
Alice           Server              Bob
  │                 │                │
  │─ join room ────►│                │
  │◄────── welcome ─│                │
  │                 │                │
  │                 │◄─── join room ─│
  │                 │─ welcome ─────►│
  │◄── peer joined ─│                │
```
Nothing resembling a video stream has passed through the server.\
The server is only introducing peers and relaying messages between them.\
And that process is called **signaling**.

Interestingly, WebRTC itself doesn't specify how signaling should work.\
You can use WebSockets, HTTP, server-sent events, Firebase, carrier pigeons encoded as JSON, or whatever else allows the two peers to exchange messages.

I used WebSockets because the connection is bidirectional and that's useful for some other application state.

---

## Creating a peer connection

When Alice and Bob know about the existence of each other they create an `RTCPeerConnection`
adding their local media tracks:

```js
for (const track of localStream.getTracks()) {
  connection.addTrack(track, localStream)
}
```

At this point we have something like the following on each browser:
```
Camera ──┐
         ├──► RTCPeerConnection
Mic ─────┘
```
But the two RTCPeerConnections still haven't agreed on what they're doing.\
They need to **negotiate**.

---

## Offers, answers, and SDP

WebRTC uses an offer/answer negotiation model.

One peer creates an offer:
```js
const offer = await connection.createOffer()
await connection.setLocalDescription(offer)
```
The offer contains an SDP document.\
SDP stands for `Session Description Protocol`.

Despite the name, SDP isn't responsible for transporting media.
It's a description of the session the peer wants to establish:
what media exists, which codecs are supported, networking information,
and other parameters required to negotiate the connection.

it goes like this:

Alice sends her offer to Bob through the signaling server

Bob installs Alice's description
```js
await connection.setRemoteDescription(offer)
```
Then creates an answer:
```js
const answer = await connection.createAnswer()
await connection.setLocalDescription(answer)
```
And sends that answer back:
```ascii
Alice           Server           Bob
  │               │               │
  │─ SDP offer ──►│─ SDP offer ──►│
  │◄─ SDP answer ─│◄─ SDP answer ─│
```
Alice installs Bob's answer as her remote description.

Now both sides agree on what kind of session they're trying to establish.\
But there is still an important unanswered question:

**Where exactly should they send the packets?**

---

## Knowing Bob exists isn't the same as knowing how to reach Bob

If Alice and Bob were both machines on the public internet with directly reachable IP addresses,
this problem would be considerably easier.

Usually they aren't.

A typical home network looks more like:
```ascii
               Internet
                  │
                 ISP
                  │
                Router
                  │
      ┌───────────┼────────────┐
      │           │            │
192.168.1.4  192.168.1.5  192.168.1.7
   Alice       Smart TV   Smart Fridge
```
Alice's laptop might know itself as `192.168.1.4`\
But that address is only meaningful inside Alice's local network.

Bob can't send packets to `192.168.1.4` and expect them to magically reach Alice.

The router translates traffic between private addresses and its public address.\
This is `Network Address Translation`, or NAT.

There are many variations of NAT and plenty of firewall behavior layered on top of it.

So WebRTC needs to answer a more general question:\
**Out of all the possible ways these two machines might communicate, which one actually works?**

That's what **ICE** is for.

---

## ICE: finding a route between two peers

ICE stands for `Interactive Connectivity Establishment`.\
Instead of assuming a single address will work, each browser gathers multiple possible ways it might be reachable.

These are called ICE candidates.

A candidate might represent:

- a local network address
- a public address discovered through STUN
- an address provided by a TURN relay

The browser gathers candidates:
```ascii
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

And Vivid sends them through the signaling server:

```ascii
Alice               Server                 Bob
  │                    │                    │
  │─ ICE candidates ──►│─ ICE candidates ──►│
  │◄── ICE candidates ─│◄── ICE candidates ─│
```

Once each side has candidates from the other,
ICE tests different candidate pairs until it finds a viable path.

Conceptually:

Alice candidates                    Bob candidates
```
192.168.1.4:51321  ─────x─────  10.0.0.8:63122
203.x.x.x:43182    ─────?─────  198.x.x.x:51031
TURN relay         ─────?─────  TURN relay
```
The first pair that looks obvious to humans may not be usable.\
ICE's job is to figure that out.

There is also a small timing problem worth handling.

ICE candidates can arrive before the peer has finished installing its remote SDP description.
In Vivid, those candidates are temporarily queued:
```js
if (peer.connection.remoteDescription) {
  await peer.connection.addIceCandidate(candidate)
} else {
  peer.pendingCandidates.push(candidate)
}
```
After the remote description is installed, the queued candidates can be applied.

It's a small implementation detail, but one that demonstrates something important about WebRTC:\
**many parts of negotiation happen concurrently**.

---

## STUN: what do I look like from outside?

One source of ICE candidates is STUN.\
STUN stands for `Session Traversal Utilities for NAT`.

A STUN server answers a fairly simple question:
**What public IP address and port do you see me coming from?**

Alice sends a request to a STUN server:
```ascii
Alice                  Router                   STUN
  │                      │                       │
  │─────────────────────►│──────────────────────►│
  │◄─────────────────────│◄──────────────────────│
  │                      │ "I see you as         │
  │                      │  203.x.x.x:43182"     │
```
The browser can then advertise that mapping as another ICE candidate.

I initially hosted my own STUN server however after some testing
I switched to a public STUN server provided by cloudflare `stun.cloudflare.com`.

For many users, STUN is enough to establish a direct connection.

But not always.

---

## TURN: when peer-to-peer isn't possible

Some networks simply won't allow the two peers to establish a direct path.\
This is common enough that a real WebRTC application can't assume STUN will always succeed.

That's what TURN is for.\
TURN stands for `Traversal Using Relays around NAT`

Instead of the peers communicating directly:\
Alice ◄────────────────────────────────► Bob

a TURN server would become a relay between them:\
Alice ◄────────────► TURN ◄────────────► Bob

TURN is therefore different from STUN in an important way.

STUN helps peers discover a route.\
TURN becomes the route.

That also means TURN is considerably more expensive to operate!

A signaling server handles relatively small JSON messages such as:\
`offer`, `answer`, `candidate`, `peer-joined`, `peer-left` ... etc

A TURN server handles the actual audio and video traffic for the entire duration of a call.\
If Alice sends a 2 Mbps video stream through TURN, those video bytes are actually passing through your TURN server.

For Vivid I run `coturn` (which is a TURN server written in C) alongside the signaling backend.

The signaling server gives each participant temporary TURN credentials rather than embedding a permanent TURN password in the frontend.

The username contains an expiry time and peer ID, and the credential is generated from a shared secret.

A simplified version looks like:
```
username = expiration + ":" + peerID
credential = HMAC(sharedSecret, username)
```

coturn knows the same shared secret and can verify the credentials.\
This lets the browser use TURN without exposing the long-lived secret needed to generate future credentials.

---

## The full picture

Putting everything together, Say alice is already waiting in a room\
Bob joining a Vivid call would look roughly like this:

```ascii
Bob              Signaling Server        Alice                 STUN              TURN
 │                    │                    │                    │                 │
 │─ join room ───────►│                    │                    │                 │
 │◄─ welcome + peers ─│                    │                    │                 │
 │                    │─ peer-joined ─────►│                    │                 │
 │─ peer-ready ──────►│───────────────────►│                    │                 │
 │                    │                    │                    │                 │
 │◄───────────────────│◄─────── SDP offer ─│                    │                 │
 │─ SDP answer ──────►│───────────────────►│                    │                 │
 │                    │                    │                    │                 │
 │                    │                    │─ STUN binding ────►│                 │
 │                    │                    │◄───── public addr ─│                 │
 │─ STUN binding ──────────────────────────────────────────────►│                 │
 │◄─────────────────────────────────────────────── public addr ─│                 │
 │                    │                    │                    │                 │
 │                    │                    │─ TURN allocate ─────────────────────►│
 │                    │                    │◄──────────────────────── relay addr ─│
 │─ TURN allocate ───────────────────────────────────────────────────────────────►│
 │◄────────────────────────────────────────────────────────────────── relay addr ─│
 │                    │                    │                    │                 │
 │◄───────────────────│◄── ICE candidates ─│                    │                 │
 │─ ICE candidates ──►│───────────────────►│                    │                 │
 │                    │                    │                    │                 │
 │◄────────────────────── ICE conn checks ─│                    │                 │
 │─ ICE conn response ────────────────────►│                    │                 │
 │─ ICE conn checks ──────────────────────►│                    │                 │
 │◄──────────────────── ICE conn response ─│                    │                 │
 │                    │                    │                    │                 │
 │                    │                    │                    │                 │
 ......................[ICE selects best working candidate pair]...................
 │                    │                    │                    │                 │
 │                    │                    │                    │                 │
 │◄═══════ WebRTC media connection ═══════►│                    │                 │
 │       (direct or relayed via TURN)      │                    │                 │
```

This diagram also highlights an important property of the architecture.\
Once negotiation has completed, the signaling server is not sitting in the middle of the media connection.

control plane\
Alice ◄────────► signaling server ◄────────► Bob

media plane\
Alice ◄════════════════════════════════════► Bob

Or, if a relay is necessary:\
Alice ◄═══════════► TURN server ◄══════════► Bob

Signaling and media are separate concerns.

---

## What happens when a third person joins?

Everything so far described a two-person call.\
Vivid supports small group calls, which introduces another architectural decision.

There are several ways to build multiparty WebRTC calls.\
Vivid uses the simplest one: a mesh.\
Every participant creates a separate peer connection to every other participant.

```
 For three people:            For four:

                            ┌──►Alice◄──┐
   ┌─►Alice◄─┐              │     ▲     │
   │         │              ▼     │     ▼
   ▼         ▼             Bob◄───┼──►Carol
  Bob◄────►Carol            ▲     │     ▲
                            │     ▼     │
                            └──►David◄──┘
```
This architecture has a very attractive property: there is no media server to build.\
The signaling server introduces the peers, and they establish WebRTC connections amongst themselves.\
But the simplicity comes with a cost.

For `n` participants, a full mesh requires: `n(n-1)/2` p2p connections which grows quadratically.\
So in a 1-on-1 call, there is only one connection, but in an 8-on-8 call, there are 28 connections!\
And those numbers increase further when we add more connections per participant such as screensharing.

That increases the recources needed per client but the more significant problem is usually upload bandwidth.\
Suppose Alice's outgoing camera stream is 1 Mbps.\
With one remote participant, she sends only one copy:

Alice ── 1 Mbps ──► Bob

With three remote participants:
```
          ┌──1 Mbps──► Bob
Alice ────┼──1 Mbps──► Carol
          └──1 Mbps──► David
```
Alice is now uploading roughly 6 Mbps worth of video.\
And each additional participant adds another outgoing copy.

That's one reason Vivid intentionally treats rooms as small and currently defaults to a maximum of 8 participants.

---

## Why not use an SFU?

Most larger video conferencing applications don't use a full mesh.
A common alternative is an SFU, or `Selective Forwarding Unit`.

Instead of uploading a separate stream directly to each peer, participants upload to a media server.

Alice can upload one stream to the SFU, and the SFU forwards it to the other participants.
That makes much larger calls practical.
It also means building or operating a media server with substantially more bandwidth and complexity than Vivid's signaling server.

For the sort of small calls Vivid is intended for, I preferred the mesh.\
It's a useful example of an architectural choice being determined by the expected scale rather than one design being universally "better".

If Vivid needed to support dozens or hundreds of participants,
moving away from the mesh would be one of the first major architectural changes required.

```ascii
  P2P FULL MESH                      CENTRAL SFU

                                        Alice
  ┌──►Alice◄──┐                           ▲
  │     ▲     │                           │
  ▼     │     ▼                       ┌───▼───┐
Dave◄───┼──►Carol             Dave◄──►│  SFU  │◄──►Carol
  ▲     │     ▲                       └───▲───┘
  │     ▼     │                           │
  └──► Bob◄───┘                           ▼
                                         Bob

  Users │ Links                     Users │ Links
 ───────┼───────                   ───────┼───────
      2 │ 1                             2 │ 2
      3 │ 3                             3 │ 3
      4 │ 6                             4 │ 4
      5 │ 10                            5 │ 5
      6 │ 15                            6 │ 6
      7 │ 11                            7 │ 7
      8 │ 28                            8 │ 8
```

---

## Polite and impolite peers

The nice sequence diagrams above hide one of the uglier parts of WebRTC.
They assume one peer politely creates an offer while the other patiently waits for it.
Real applications don't always behave that neatly.

Imagine Alice and Bob both decide they need to renegotiate at approximately the same time!\
Now both peers have a local offer and both receive another offer.

This is known as glare, or an offer collision.
Vivid deals with this using the WebRTC **perfect negotiation pattern**.

Each peer connection is assigned a polite or impolite role.\
The connection also tracks state like:

```json
{
  makingOffer: false,
  ignoreOffer: false,
  isPolite: true
}
```

When an offer arrives, Vivid checks whether it collides with an offer the local peer is already making.

Roughly:
```js
const collision = peer.makingOffer || peer.connection.signalingState !== "stable"
```
An impolite peer can ignore the colliding offer.\
A polite peer rolls back its own negotiation and accepts the incoming one.
```js
if (collision) {
  await connection.setLocalDescription({
    type: "rollback",
  })
}

await connection.setRemoteDescription(description)
```

So:
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
Politeness is assigned deterministically from the two peer IDs:
```js
let isPolite = selfPeerID > peerID
```
The choice itself is arbitrary; what matters is that both peers reach opposite conclusions consistently

This isn't particularly visible to someone using Vivid. Which is exactly the point.\
A lot of networking code exists to make race conditions that absolutely do happen look like they never happened.

---

## Audio & Noise Suppression

For noise suppression, Vivid uses RNNoise compiled to WebAssembly running inside an AudioWorklet on the browser.

[Jitsi](https://meet.jit.si) thanklessly published their [own port](https://github.com/jitsi/rnnoise-wasm) of RNNoise which I used at first.\
I later switched to [@timephy/rnnoise-wasm](https://www.npmjs.com/package/@timephy/rnnoise-wasm),
which is a fork which upgrades RNNoise to 0.2 and adds an `AudioWorkletNode`.

Using the library was simpler that expected:
```js
```

Which would be added as another step in the audio processing pipeline:
```ascii
    Alice
      │
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
Web Audio mixer ◄── audio from screen sharing (chromium single-tab audio only)
      │
      ├────► RTCRtpSender for Bob
      ├────► RTCRtpSender for David
      └────► RTCRtpSender for ...
```

Because the processing happens client-side, the signaling server and remote peers don't need to know anything about RNNoise.\
If WASM/audio processing isn't available, Vivid falls back to sending the original microphone track instead.

---

## Screen sharing is just another media track

Once the peer connection machinery exists, features like screen sharing are less mysterious.

The browser provides another media stream through:
```js
navigator.mediaDevices.getDisplayMedia()
```
That produces another video track. Then vivid can attach that track to the existing peer connections and renegotiate where necessary.

Conceptually:
```ascii
Camera ──────────┐
Microphone ──────┼──► PeerConnection
Screen ──────────┘
```
The same underlying WebRTC connection isn't limited to one camera stream. It's transporting media tracks.

That distinction becomes useful when implementing things such as camera switching, screen sharing, muting, and audio processing.

---

## Chat: Not everything needs WebRTC

Vivid also has text chat.
My first instinct when I thought about implementing it was that chat should naturally use an `RTCDataChannel`.

WebRTC data channels let peers exchange arbitrary application data over the peer connection, so they would certainly work.\
Vivid doesn't use one.

The application already needs a persistent WebSocket connection for signaling.
Chat messages are tiny compared with audio and video,
so sending them through the existing signaling infrastructure is much simpler.

Alice ── chat ──► signaling server ── chat ──► Bob

The server keeps a small in-memory history for each active room and sends it to participants when they join.\
When the last participant leaves, the room disappears and its chat history goes with it.\
That happens to fit the semantics I wanted for Vivid: rooms are ephemeral.

It also illustrates a useful engineering lesson from the project:

using WebRTC doesn't mean everything in a video chat application should use WebRTC.

Use it where it solves a problem.

---

## The server is boring

Before building Vivid, "video chat backend" sounded like something that would necessarily involve receiving, processing, and redistributing video streams.
For this architecture, it doesn't.

The signaling backend mostly needs to know rooms have peers and how to relay signaling messages between them.

That keeps the Go server fairly boring.\
And boring servers are often good servers.

---

## Deployment

Vivid is deployed as three separate Docker services:
```
vivid-web       Svelte frontend
vivid-backend   Go signaling server
vivid-coturn    TURN relay
```
The web frontend and Go signaling server sit behind the external proxy network,
while coturn uses the host network because TURN needs direct access to its UDP relay ports. STUN/TURN configuration and the shared TURN authentication secret are injected through environment variables.

Deployment itself is intentionally small: the server updates the Git checkout and runs `docker compose up -d --build`, rebuilding and restarting the services from the latest source.

---

## A future consideration

Vivid currently uses TURN over UDP, which is generally the preferred path because real-time audio and video benefit from avoiding TCP's retransmission behavior and head-of-line blocking.

The downside is that some restrictive corporate, hotel, university, or public networks block outbound UDP entirely. In those environments, a perfectly functional TURN server may still be unreachable.

A future improvement would be to expose TURN over TLS, typically on port `:443`\
Using port `:443` makes TURN traffic look much more like ordinary HTTPS traffic from the network's point of view,
Which gives it a better chance of passing through restrictive firewalls.

Supporting this would require enabling TLS on coturn,
providing a certificate for the TURN hostname, and advertising additional turns: URLs in Vivid's ICE server configuration.

It adds some deployment and certificate-management complexity,
but would make Vivid considerably more reliable on networks where UDP traffic is blocked

---

## Closing

Thanks for reading.\
I hope this made some of the moving parts behind video chats, WebRTC, and Vivid a little clearer.

Which was ultimately the point of the project: not just to build a video chat, but to understand why each piece is there.

*Box-drawing diagrams created with [asciiflow.com](https://asciiflow.com).*

— **Raafat**

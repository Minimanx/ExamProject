/**
 * A voice call in a lobby, as a mesh of peer connections.
 *
 * Every participant connects to every other, so this holds one RTCPeerConnection
 * per peer and no media ever reaches the server. That is the whole reason the
 * roadmap picks a mesh — no media servers to run — and also why the server caps
 * the call: the number of connections grows with the square of the group.
 *
 * Who offers and who answers is decided by the server, not negotiated here. On
 * joining, a client is told who is already present and offers to each of them;
 * everyone already present waits to be offered to. Both sides offering is the
 * classic way a mesh ends up with two half-open connections between one pair.
 *
 * Nothing here reaches for the browser directly: the peer connection factory and
 * the microphone both arrive as arguments, so the whole negotiation can be
 * driven in a test without a media device or a network.
 */

export const DEFAULT_VOLUME = 1;

export function createVoiceCall({
    socket,
    createPeerConnection,
    getLocalStream,
    getCameraStream,
    createStream = () => new MediaStream(),
}) {
    /** Peers, keyed by socket id, as the UI needs to see them. */
    let peers = $state({});

    let active = $state(false);
    let muted = $state(false);
    let failure = $state(null);

    /**
     * Not $state, and deliberately a plain Map: connections are never rendered,
     * only used, so making them reactive would re-render the peer list every
     * time one was opened or closed for no visible difference. The lint rule
     * that asks for SvelteMap is about maps the markup reads.
     */
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const connections = new Map();
    let localStream = null;

    /**
     * The reserved video slot per peer.
     *
     * Because the slot is negotiated once, when the connection opens, there is
     * exactly one offer per connection and two offers can never cross. That is
     * why there is no politeness dance here.
     */
    /** The reserved video slot per peer, filled when the camera goes on. */
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const videoSenders = new Map();
    let cameraStream = null;
    let cameraOn = $state(false);

    function upsert(id, patch) {
        peers[id] = { ...(peers[id] ?? { id, volume: DEFAULT_VOLUME }), ...patch };
    }

    /**
     * What the server says about a peer: who they are, and whether the camera is
     * allowed with them.
     *
     * Kept apart from opening a connection, which happens later and separately —
     * when they offer — and knows only a socket id. Recording the peer from that
     * put `cameraAllowed` back to false for people who are friends, and the
     * camera button quietly disappeared.
     */
    function rememberPeer(peer) {
        upsert(peer.id, {
            id: peer.id,
            username: peer.username ?? peers[peer.id]?.username ?? null,
            cameraAllowed: peer.cameraAllowed === true,
        });
    }

    /**
     * The microphone, opened once and shared by every connection.
     *
     * Asking per peer would mean one permission prompt per person in the call,
     * and four copies of the same audio being encoded.
     */
    async function microphone() {
        if (localStream === null) {
            localStream = await getLocalStream();
            // Whatever the mute state was before the microphone opened.
            applyMute();
        }
        return localStream;
    }

    function applyMute() {
        for (const track of localStream?.getAudioTracks() ?? []) {
            track.enabled = !muted;
        }
    }

    /**
     * Open a connection to one peer.
     *
     * `polite` decides who offers: the arriving client offers to everyone
     * already there, and they answer.
     */
    async function connectTo(peer, { offer }) {
        const connection = createPeerConnection();
        connections.set(peer.id, connection);
        // Only what opening a connection knows. Who they are was recorded when
        // the server named them.
        upsert(peer.id, { id: peer.id, stream: peers[peer.id]?.stream ?? null });

        const stream = await microphone();
        for (const track of stream.getTracks()) {
            connection.addTrack(track, stream);
        }

        /**
         * A place for video, reserved now and filled later.
         *
         * Adding a camera track to a live connection means offering again, and
         * an offer that introduces a media section reorders them — which the far
         * end refuses outright: "the order of m-lines in subsequent offer
         * doesn't match". Reserving the section up front and swapping a track
         * into it needs no renegotiation at all, so turning the camera on is
         * immediate and there is only ever one offer per connection.
         *
         * Only the side that offers reserves it. An answerer cannot introduce a
         * media section — it can only reply to the ones it was sent — so a slot
         * created here would sit unnegotiated beside the one the offer brings,
         * and the camera would have nowhere to go. See adoptVideoSlot.
         *
         * And only for peers the camera is allowed with: for anyone else the
         * connection has no video section at all, which is a path that is not
         * there rather than one that is refused on the way out.
         */
        if (offer && peers[peer.id]?.cameraAllowed === true) {
            const transceiver = connection.addTransceiver("video", { direction: "sendrecv" });
            await fillVideoSlot(peer.id, transceiver.sender);
        }

        connection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("voiceSignal", { to: peer.id, candidate: event.candidate });
            }
        };

        /**
         * Tracks arrive one at a time and are collected into one stream.
         *
         * `event.streams[0]` is only there when the far end associated the track
         * with a stream, and a track from a reserved transceiver has no stream
         * at all — so reading that field replaced the audio the tile was already
         * playing with nothing.
         */
        connection.ontrack = (event) => {
            const stream = peers[peer.id]?.stream ?? createStream();
            stream.addTrack(event.track);

            if (event.track.kind === "video") {
                // Whether video is flowing, not whether a place for it exists.
                // The slot is negotiated when the connection opens and sits
                // there muted until somebody turns a camera on; a tile that
                // appeared then would be a black rectangle.
                const follow = () => upsert(peer.id, { hasVideo: !event.track.muted });
                event.track.addEventListener("unmute", follow);
                event.track.addEventListener("mute", follow);
                follow();
            }

            upsert(peer.id, { stream });
        };

        connection.onconnectionstatechange = () => {
            const state = connection.connectionState;
            if (state === "failed" || state === "closed") {
                // Kept in the list rather than dropped: the person is still in
                // the lobby, and a tile that vanishes reads as them leaving.
                upsert(peer.id, { stream: null, connectionFailed: true });
            }
        };

        if (offer) {
            await offerTo(peer.id);
        }

        return connection;
    }

    /**
     * Offer to one peer, recording that an offer is outstanding.
     *
     * The flag is what lets the other side tell a genuine offer from one that
     * crossed with its own.
     */
    async function offerTo(id) {
        const connection = connections.get(id);
        if (connection === undefined) return;

        const description = await connection.createOffer();
        await connection.setLocalDescription(description);
        socket.emit("voiceSignal", { to: id, description: connection.localDescription });
    }

    /** Record a slot, and put the camera in it if the camera is already on. */
    async function fillVideoSlot(id, sender) {
        videoSenders.set(id, sender);

        const [videoTrack] = cameraStream?.getVideoTracks() ?? [];
        if (cameraOn && videoTrack !== undefined) {
            await sender.replaceTrack(videoTrack);
        }
    }

    /**
     * Take the video section an offer brought, and make it two-way.
     *
     * The answering side gets its slot from the offer rather than making one.
     * Left alone it would be receive-only — the answerer has nothing to send
     * yet — and turning the camera on later would need another round of
     * negotiation. Asking for sendrecv before answering settles both directions
     * in the one exchange.
     */
    async function adoptVideoSlot(id, connection) {
        if (peers[id]?.cameraAllowed !== true) return;
        if (videoSenders.has(id)) return;

        const video = connection
            .getTransceivers()
            .find((transceiver) => transceiver.receiver?.track?.kind === "video");
        if (video === undefined) return;

        video.direction = "sendrecv";
        await fillVideoSlot(id, video.sender);
    }

    /**
     * Put this client's camera into every slot reserved for it, or take it out.
     *
     * `replaceTrack` on a sender that is already negotiated changes what flows
     * without changing the shape of the connection, so nothing has to be
     * offered again and there is no moment where the two ends disagree.
     */
    async function applyCamera() {
        const [videoTrack] = cameraStream?.getVideoTracks() ?? [];
        for (const sender of videoSenders.values()) {
            await sender.replaceTrack(videoTrack ?? null);
        }
    }

    /** What to tell someone whose call did not start. */
    function describeFailure(err) {
        // The message shown is deliberately plain; the reason is worth keeping
        // for whoever has to work out why a call would not start.
        console.error("voice call failed", err);

        if (err?.name === "NotAllowedError") {
            return "Microphone permission was refused, so nobody can hear you.";
        }
        if (err?.name === "NotFoundError") {
            return "No microphone was found.";
        }
        return "Could not start the call.";
    }

    async function onSignal({ from, description, candidate }) {
        let connection = connections.get(from);

        if (description !== undefined) {
            if (connection === undefined) {
                // Somebody we were told about is offering to us.
                connection = await connectTo({ id: from }, { offer: false });
            }

            await connection.setRemoteDescription(description);
            if (description.type === "offer") {
                await adoptVideoSlot(from, connection);
                const answer = await connection.createAnswer();
                await connection.setLocalDescription(answer);
                socket.emit("voiceSignal", {
                    to: from,
                    description: connection.localDescription,
                });
            }
            return;
        }

        if (candidate !== undefined && connection !== undefined) {
            // A candidate that arrives before the description it belongs to is
            // an ordinary race, not a failure worth showing anyone.
            await connection.addIceCandidate(candidate).catch(() => {});
        }
    }

    function stopCamera() {
        for (const track of cameraStream?.getVideoTracks() ?? []) {
            track.stop();
        }
        cameraStream = null;
        cameraOn = false;
    }

    function drop(id) {
        connections.get(id)?.close();
        connections.delete(id);
        videoSenders.delete(id);
        delete peers[id];
    }

    const handlers = {
        voiceJoined: async ({ peers: present }) => {
            active = true;
            failure = null;
            try {
                for (const peer of present) {
                    rememberPeer(peer);
                    await connectTo(peer, { offer: true });
                }
            } catch (err) {
                // Chiefly a refused or missing microphone. Swallowed, this is a
                // call that joins, lists everyone, and is silent both ways with
                // nothing on screen to say why.
                failure = describeFailure(err);
                active = false;
            }
        },
        voicePeerJoined: (peer) => {
            // Told about them, but not connecting: they are the ones arriving,
            // so they offer. Recorded now so their name — and whether the camera
            // is allowed with them — is known by the time they do.
            rememberPeer(peer);
        },
        voicePeerLeft: ({ id }) => drop(id),
        voiceSignal: (payload) =>
            onSignal(payload).catch((err) => {
                failure = describeFailure(err);
            }),
        voiceFull: ({ message }) => {
            failure = message;
            active = false;
        },
        voiceCameraRefused: () => {
            // The server would not carry it, so the camera is not on with
            // anyone. Saying so beats a control that claims otherwise.
            failure = "The camera is only available with friends.";
            stopCamera();
        },
    };

    return {
        get peers() {
            return peers;
        },
        get active() {
            return active;
        },
        get muted() {
            return muted;
        },
        get failure() {
            return failure;
        },

        /** Wire the socket up. Returns the teardown, so a caller cannot forget half. */
        listen() {
            for (const [event, handler] of Object.entries(handlers)) {
                socket.on(event, handler);
            }
            return () => {
                for (const [event, handler] of Object.entries(handlers)) {
                    socket.off(event, handler);
                }
                this.leave();
            };
        },

        join() {
            socket.emit("voiceJoin");
        },

        leave() {
            for (const id of [...connections.keys()]) {
                drop(id);
            }
            for (const track of localStream?.getTracks() ?? []) {
                track.stop();
            }
            localStream = null;
            stopCamera();
            if (active) {
                socket.emit("voiceLeave");
            }
            active = false;
        },

        /**
         * Mute by disabling the track rather than removing it.
         *
         * Removing it renegotiates the connection with every peer, which takes a
         * moment and is audible. A disabled track keeps sending silence.
         */
        setMuted(next) {
            muted = next;
            applyMute();
        },

        /** Push-to-talk is mute, driven by a key rather than a button. */
        talkWhile(held) {
            this.setMuted(!held);
        },

        get cameraOn() {
            return cameraOn;
        },

        /**
         * Turn the camera on or off for everyone it is allowed with.
         *
         * Off by default and never opened on join: a call that lights the camera
         * because somebody wanted to talk is a different product from one that
         * asks first.
         */
        async setCamera(on) {
            if (on === cameraOn) return;

            if (on) {
                try {
                    cameraStream = await getCameraStream();
                } catch (err) {
                    failure =
                        err?.name === "NotAllowedError"
                            ? "Camera permission was refused."
                            : "Could not open the camera.";
                    return;
                }
                cameraOn = true;
            } else {
                stopCamera();
            }

            await applyCamera();
        },

        setVolume(id, volume) {
            const clamped = Math.min(Math.max(volume, 0), 1);
            upsert(id, { volume: clamped });
        },
    };
}

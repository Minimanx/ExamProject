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

export function createVoiceCall({ socket, createPeerConnection, getLocalStream }) {
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

    function upsert(id, patch) {
        peers[id] = { ...(peers[id] ?? { id, volume: DEFAULT_VOLUME }), ...patch };
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
        upsert(peer.id, {
            id: peer.id,
            username: peer.username,
            cameraAllowed: peer.cameraAllowed === true,
            speaking: false,
            stream: null,
        });

        const stream = await microphone();
        for (const track of stream.getTracks()) {
            connection.addTrack(track, stream);
        }

        connection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("voiceSignal", { to: peer.id, candidate: event.candidate });
            }
        };

        connection.ontrack = (event) => {
            upsert(peer.id, { stream: event.streams[0] ?? null });
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
            const description = await connection.createOffer();
            await connection.setLocalDescription(description);
            socket.emit("voiceSignal", { to: peer.id, description: connection.localDescription });
        }

        return connection;
    }

    /** What to tell someone whose call did not start. */
    function describeFailure(err) {
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
                connection = await connectTo(
                    { id: from, username: peers[from]?.username },
                    {
                        offer: false,
                    }
                );
            }

            await connection.setRemoteDescription(description);
            if (description.type === "offer") {
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

    function drop(id) {
        connections.get(id)?.close();
        connections.delete(id);
        delete peers[id];
    }

    const handlers = {
        voiceJoined: async ({ peers: present }) => {
            active = true;
            failure = null;
            try {
                for (const peer of present) {
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
            // so they offer. Recorded now so their name is known when they do.
            upsert(peer.id, {
                id: peer.id,
                username: peer.username,
                cameraAllowed: peer.cameraAllowed === true,
                stream: null,
            });
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
            failure = "The camera is only available with friends.";
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

        setVolume(id, volume) {
            const clamped = Math.min(Math.max(volume, 0), 1);
            upsert(id, { volume: clamped });
        },
    };
}

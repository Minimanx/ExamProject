import { describe, it, expect, vi } from "vitest";
import { createVoiceCall, DEFAULT_VOLUME } from "./voiceCall.svelte.js";

/**
 * The mesh, driven without a media device or a network.
 *
 * Everything that touches the browser — the peer connections and the microphone
 * — arrives as an argument, so the negotiation these tests care about can be run
 * directly. What is being checked is who offers to whom, what is sent, and what
 * is cleaned up: the parts that are painful to reach from a browser and easy to
 * get wrong.
 */
function fakeSocket() {
    const handlers = new Map();
    const sent = [];
    return {
        sent,
        emit: (event, payload) => sent.push({ event, payload }),
        on: (event, handler) => handlers.set(event, handler),
        off: (event) => handlers.delete(event),
        /** Deliver a server event, as socket.io would. */
        fire: (event, payload) => handlers.get(event)?.(payload),
        listening: () => [...handlers.keys()],
    };
}

function fakeTrack(kind = "audio") {
    return { kind, enabled: true, stop: vi.fn() };
}

function fakeStream(tracks = [fakeTrack()]) {
    return {
        getTracks: () => tracks,
        getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
    };
}

function fakeConnection() {
    const connection = {
        added: [],
        localDescription: null,
        remoteDescription: null,
        candidates: [],
        closed: false,
        connectionState: "new",
        addTrack: (track, stream) => connection.added.push({ track, stream }),
        createOffer: async () => ({ type: "offer", sdp: "offer-sdp" }),
        createAnswer: async () => ({ type: "answer", sdp: "answer-sdp" }),
        setLocalDescription: async (description) => {
            connection.localDescription = description;
        },
        setRemoteDescription: async (description) => {
            connection.remoteDescription = description;
        },
        addIceCandidate: async (candidate) => {
            connection.candidates.push(candidate);
        },
        close: () => {
            connection.closed = true;
        },
    };
    return connection;
}

function makeCall({ tracks } = {}) {
    const socket = fakeSocket();
    const made = [];
    const stream = fakeStream(tracks);
    const call = createVoiceCall({
        socket,
        createPeerConnection: () => {
            const connection = fakeConnection();
            made.push(connection);
            return connection;
        },
        getLocalStream: async () => stream,
    });
    return { call, socket, made, stream };
}

const PEER = { id: "peer-1", username: "Wanda", cameraAllowed: false };

describe("joining a call", () => {
    it("asks the server to let it in", () => {
        const { call, socket } = makeCall();

        call.join();

        expect(socket.sent).toEqual([{ event: "voiceJoin", payload: undefined }]);
    });

    // The arriving client offers to everyone already there; they answer. Both
    // sides offering leaves a pair with two half-open connections.
    it("offers to everyone who was already there", async () => {
        const { call, socket, made } = makeCall();
        call.listen();

        await socket.fire("voiceJoined", { peers: [PEER, { id: "peer-2", username: "Ada" }] });

        expect(made).toHaveLength(2);
        const offers = socket.sent.filter((message) => message.payload?.description);
        expect(offers.map((message) => message.payload.to)).toEqual(["peer-1", "peer-2"]);
        expect(offers[0].payload.description.type).toBe("offer");
    });

    it("does not offer to somebody who arrives after it", async () => {
        const { call, socket, made } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [] });

        await socket.fire("voicePeerJoined", {
            id: "late",
            username: "Late",
            cameraAllowed: false,
        });

        expect(made).toHaveLength(0);
        expect(socket.sent.filter((message) => message.payload?.description)).toEqual([]);
        // But it knows who they are, so their name is ready when they offer.
        expect(call.peers.late.username).toBe("Late");
    });

    it("sends the microphone to each peer", async () => {
        const { call, socket, made, stream } = makeCall();
        call.listen();

        await socket.fire("voiceJoined", { peers: [PEER] });

        expect(made[0].added).toHaveLength(1);
        expect(made[0].added[0].stream).toBe(stream);
    });

    // One prompt and one encode, however many people are in the call.
    it("opens the microphone once for the whole mesh", async () => {
        const socket = fakeSocket();
        const getLocalStream = vi.fn(async () => fakeStream());
        const call = createVoiceCall({
            socket,
            createPeerConnection: fakeConnection,
            getLocalStream,
        });
        call.listen();

        await socket.fire("voiceJoined", {
            peers: [PEER, { id: "peer-2" }, { id: "peer-3" }],
        });

        expect(getLocalStream).toHaveBeenCalledTimes(1);
    });

    it("reports a full call rather than failing silently", async () => {
        const { call, socket } = makeCall();
        call.listen();

        await socket.fire("voiceFull", { message: "This call is full (5 people)." });

        expect(call.active).toBe(false);
        expect(call.failure).toMatch(/full/i);
    });
});

describe("answering an offer", () => {
    it("answers a peer that offers to it, and sends the answer back", async () => {
        const { call, socket, made } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [] });

        await socket.fire("voiceSignal", {
            from: "peer-1",
            description: { type: "offer", sdp: "their-offer" },
        });

        expect(made).toHaveLength(1);
        expect(made[0].remoteDescription.sdp).toBe("their-offer");
        const answer = socket.sent.at(-1);
        expect(answer.payload.to).toBe("peer-1");
        expect(answer.payload.description.type).toBe("answer");
    });

    it("does not answer an answer, which would negotiate forever", async () => {
        const { call, socket } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });
        const before = socket.sent.length;

        await socket.fire("voiceSignal", {
            from: "peer-1",
            description: { type: "answer", sdp: "their-answer" },
        });

        expect(socket.sent).toHaveLength(before);
    });

    it("passes on ice candidates as they are found", async () => {
        const { call, socket, made } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });

        made[0].onicecandidate({ candidate: { candidate: "a=candidate:1" } });

        expect(socket.sent.at(-1).payload).toEqual({
            to: "peer-1",
            candidate: { candidate: "a=candidate:1" },
        });
    });

    it("says nothing when candidate gathering finishes", async () => {
        const { call, socket, made } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });
        const before = socket.sent.length;

        made[0].onicecandidate({ candidate: null });

        expect(socket.sent).toHaveLength(before);
    });

    // A candidate for a peer we have not started negotiating with is an
    // ordinary race, not something to show anyone.
    it("ignores a candidate for a peer it has no connection to", async () => {
        const { call, socket } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [] });

        await expect(
            socket.fire("voiceSignal", { from: "stranger", candidate: { candidate: "x" } })
        ).resolves.not.toThrow();
    });
});

describe("the microphone", () => {
    it("mutes by silencing the track rather than renegotiating", async () => {
        const track = fakeTrack();
        const { call, socket } = makeCall({ tracks: [track] });
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });

        call.setMuted(true);
        expect(track.enabled).toBe(false);
        expect(call.muted).toBe(true);

        call.setMuted(false);
        expect(track.enabled).toBe(true);
    });

    // Push-to-talk is mute the other way up: silent unless the key is held.
    it("talks only while the key is held", async () => {
        const track = fakeTrack();
        const { call, socket } = makeCall({ tracks: [track] });
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });

        call.talkWhile(false);
        expect(track.enabled).toBe(false);

        call.talkWhile(true);
        expect(track.enabled).toBe(true);
    });

    // Muting before the first peer arrives must not be forgotten when the
    // microphone finally opens.
    it("remembers a mute set before the microphone was open", async () => {
        const track = fakeTrack();
        const { call, socket } = makeCall({ tracks: [track] });
        call.listen();

        call.setMuted(true);
        await socket.fire("voiceJoined", { peers: [PEER] });

        expect(track.enabled).toBe(false);
    });
});

describe("per-person volume", () => {
    it("starts everyone at full volume", async () => {
        const { call, socket } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });

        expect(call.peers["peer-1"].volume).toBe(DEFAULT_VOLUME);
    });

    it("remembers a volume set for one person", async () => {
        const { call, socket } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER, { id: "peer-2" }] });

        call.setVolume("peer-1", 0.25);

        expect(call.peers["peer-1"].volume).toBe(0.25);
        expect(call.peers["peer-2"].volume).toBe(DEFAULT_VOLUME);
    });

    it("keeps a volume inside the range an audio element accepts", async () => {
        const { call, socket } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });

        call.setVolume("peer-1", 5);
        expect(call.peers["peer-1"].volume).toBe(1);

        call.setVolume("peer-1", -2);
        expect(call.peers["peer-1"].volume).toBe(0);
    });
});

describe("people leaving, and leaving yourself", () => {
    it("closes the connection to someone who leaves", async () => {
        const { call, socket, made } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });

        socket.fire("voicePeerLeft", { id: "peer-1" });

        expect(made[0].closed).toBe(true);
        expect(call.peers["peer-1"]).toBeUndefined();
    });

    // A tile that vanishes reads as the person leaving, and they have not.
    it("keeps someone whose connection failed, marked as failed", async () => {
        const { call, socket, made } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });

        made[0].connectionState = "failed";
        made[0].onconnectionstatechange();

        expect(call.peers["peer-1"].connectionFailed).toBe(true);
        expect(call.peers["peer-1"].stream).toBe(null);
    });

    it("closes every connection and releases the microphone on leaving", async () => {
        const track = fakeTrack();
        const { call, socket, made } = makeCall({ tracks: [track] });
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER, { id: "peer-2" }] });

        call.leave();

        expect(made.every((connection) => connection.closed)).toBe(true);
        expect(track.stop).toHaveBeenCalled();
        expect(call.peers).toEqual({});
        expect(call.active).toBe(false);
        expect(socket.sent.at(-1).event).toBe("voiceLeave");
    });

    // A microphone left open is a light on somebody's laptop, and a set of
    // connections left open is a call they think they have left.
    it("hands back a teardown that stops listening and leaves", async () => {
        const track = fakeTrack();
        const { call, socket, made } = makeCall({ tracks: [track] });
        const stop = call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });

        stop();

        expect(socket.listening()).toEqual([]);
        expect(made[0].closed).toBe(true);
        expect(track.stop).toHaveBeenCalled();
    });

    it("says nothing to the server when it was never in a call", () => {
        const { call, socket } = makeCall();
        call.listen();

        call.leave();

        expect(socket.sent).toEqual([]);
    });
});

describe("the camera gate, as the client sees it", () => {
    it("records whether the camera is allowed with each peer", async () => {
        const { call, socket } = makeCall();
        call.listen();

        await socket.fire("voiceJoined", {
            peers: [
                { id: "friend", username: "Ada", cameraAllowed: true },
                { id: "stranger", username: "Someone", cameraAllowed: false },
            ],
        });

        expect(call.peers.friend.cameraAllowed).toBe(true);
        expect(call.peers.stranger.cameraAllowed).toBe(false);
    });

    // The server refuses the offer; this is only about saying so.
    it("explains a refusal rather than leaving the camera looking broken", async () => {
        const { call, socket } = makeCall();
        call.listen();
        await socket.fire("voiceJoined", { peers: [PEER] });

        socket.fire("voiceCameraRefused", { to: "peer-1" });

        expect(call.failure).toMatch(/friends/i);
    });
});

// Socket.io delivers in order, but these handlers are async: the offer's
// handler awaits the microphone, and the candidate that follows it arrives
// while that is still running. Handled as they land, the candidate finds no
// connection yet and is dropped — and a peer connection with no candidates
// never pairs, which looks like silence rather than an error.
describe("signals that arrive faster than they can be handled", () => {
    it("does not lose a candidate that arrives while the offer is still being handled", async () => {
        const socket = fakeSocket();
        const made = [];
        let releaseMicrophone;
        const call = createVoiceCall({
            socket,
            createPeerConnection: () => {
                const connection = fakeConnection();
                made.push(connection);
                return connection;
            },
            // Opening a microphone is slow: a permission prompt, then a device.
            getLocalStream: () =>
                new Promise((resolve) => {
                    releaseMicrophone = () => resolve(fakeStream());
                }),
        });
        call.listen();

        // Both arrive before either can be dealt with, as they do in a browser.
        const offer = socket.fire("voiceSignal", {
            from: "peer-1",
            description: { type: "offer", sdp: "their-offer" },
        });
        const candidate = socket.fire("voiceSignal", {
            from: "peer-1",
            candidate: { candidate: "a=candidate:1" },
        });

        releaseMicrophone();
        await offer;
        await candidate;

        expect(made).toHaveLength(1);
        expect(made[0].candidates).toEqual([{ candidate: "a=candidate:1" }]);
    });
});

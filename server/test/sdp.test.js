import { describe, it, expect } from "vitest";
import { offersVideo, offersLiveVideo } from "../world/sdp.js";

/**
 * The camera gate has to hold against a modified client, and media never
 * reaches this server — a mesh is the point. Signalling does, and an SDP states
 * what it carries.
 */
const AUDIO_ONLY = [
    "v=0",
    "o=- 46117 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "a=rtpmap:111 opus/48000/2",
].join("\r\n");

const WITH_VIDEO = [
    "v=0",
    "o=- 46117 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "a=rtpmap:111 opus/48000/2",
    "m=video 9 UDP/TLS/RTP/SAVPF 96",
    "a=rtpmap:96 VP8/90000",
].join("\r\n");

describe("spotting video in an offer", () => {
    it("sees none in an audio-only offer", () => {
        expect(offersVideo({ sdp: AUDIO_ONLY })).toBe(false);
    });

    it("sees a video section", () => {
        expect(offersVideo({ sdp: WITH_VIDEO })).toBe(true);
    });

    // SDP is specified with CRLF, and plenty of things produce bare LF.
    it("does not care which line ending was used", () => {
        expect(offersVideo({ sdp: WITH_VIDEO.replace(/\r\n/g, "\n") })).toBe(true);
    });

    // The token has to be a media section, not the word appearing somewhere.
    it("is not fooled by the word inside an attribute", () => {
        const sneaky = AUDIO_ONLY + "\r\na=label:m=video is not a section here";
        expect(offersVideo({ sdp: sneaky })).toBe(false);
    });

    it("treats anything that is not an sdp as offering nothing", () => {
        expect(offersVideo(undefined)).toBe(false);
        expect(offersVideo({})).toBe(false);
        expect(offersVideo({ sdp: 42 })).toBe(false);
    });
});

describe("telling live video from video being switched off", () => {
    it("counts a normal video section as live", () => {
        expect(offersLiveVideo({ sdp: WITH_VIDEO })).toBe(true);
    });

    // Renegotiating the camera off leaves the section with a zero port. Reading
    // that as an offer of video would make turning it off impossible once it
    // had been refused.
    it("does not count a section on port zero", () => {
        const turnedOff = WITH_VIDEO.replace(
            "m=video 9 UDP/TLS/RTP/SAVPF 96",
            "m=video 0 UDP/TLS/RTP/SAVPF 96"
        );
        expect(offersLiveVideo({ sdp: turnedOff })).toBe(false);
    });

    it("counts nothing in an audio-only offer", () => {
        expect(offersLiveVideo({ sdp: AUDIO_ONLY })).toBe(false);
    });
});

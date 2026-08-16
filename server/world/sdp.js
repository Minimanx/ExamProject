/**
 * Whether a session description offers video.
 *
 * The camera is gated to friends, and a gate a client enforces is not a gate:
 * the whole point of a mesh is that media never touches this server, so nothing
 * downstream can check what is flowing. What does pass through here is the
 * signalling — a peer connection cannot be established without it — and an SDP
 * says what it carries in the open.
 *
 * A media section is a line beginning `m=`, and the kind is the first token
 * after it. Anchored to the start of a line, because `m=video` can appear
 * harmlessly inside an attribute value, and the CRLF that SDP is specified with
 * is matched as well as the bare LF that turns up in practice.
 */
const VIDEO_SECTION = /^m=video[ \t]/m;

export function offersVideo(description) {
    const sdp = description?.sdp;
    if (typeof sdp !== "string") {
        return false;
    }
    return VIDEO_SECTION.test(sdp);
}

/**
 * Whether a media section has been turned off rather than merely offered.
 *
 * Renegotiating away from camera leaves the video section in place with a zero
 * port, which is how "I have stopped sending video" is spelled. Treating that as
 * an offer of video would make turning the camera off impossible once it had
 * been refused.
 */
const DISABLED_VIDEO_SECTION = /^m=video[ \t]+0[ \t]/m;

export function offersLiveVideo(description) {
    return offersVideo(description) && !DISABLED_VIDEO_SECTION.test(description.sdp);
}

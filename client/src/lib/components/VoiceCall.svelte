<script>
    import { onMount } from "svelte";
    import { apiFetch } from "../services/api.js";
    import { createVoiceCall } from "../world/voiceCall.svelte.js";
    import { playerMovement } from "../stores/stateManagementStore.js";

    let { socket } = $props();

    /**
     * Push-to-talk key.
     *
     * Space is the obvious choice and is taken: it scrolls, and it activates
     * whatever button has focus. `v` is next to the other keys a hand already
     * rests on here, and is not one of WASD.
     */
    const TALK_KEY = "v";

    let call = $state(null);
    let pushToTalk = $state(true);
    let talking = $state(false);
    let unsupported = $state(false);

    /**
     * A tile's audio element, given the peer's stream and volume.
     *
     * An action rather than a bound property: the stream arrives after the
     * element exists, and per-person volume is a property of the element that no
     * attribute sets.
     */
    function playing(node, { stream, volume }) {
        node.srcObject = stream ?? null;
        node.volume = volume;
        return {
            update({ stream: next, volume: nextVolume }) {
                if (node.srcObject !== next) node.srcObject = next ?? null;
                node.volume = nextVolume;
            },
        };
    }

    onMount(() => {
        // getUserMedia is absent outside a secure context, and asking for it
        // there throws rather than being refused.
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            unsupported = true;
            return;
        }

        let stop = () => {};
        let cancelled = false;

        void (async () => {
            const response = await apiFetch("/ice");
            if (!response.ok || cancelled) return;
            const { data } = await response.json();

            call = createVoiceCall({
                socket,
                createPeerConnection: () => {
                    const connection = new RTCPeerConnection({ iceServers: data.iceServers });
                    // Reachable from a console, and from a test that wants to
                    // know what was negotiated rather than what was drawn.
                    (window.__voicePeerConnections ??= []).push(connection);
                    return connection;
                },
                // Audio only. The camera is a separate step, gated to friends,
                // and opening it here would light everyone's camera on join.
                getLocalStream: () => navigator.mediaDevices.getUserMedia({ audio: true }),
                // Asked for separately, and only when somebody turns it on, so
                // joining a call never lights a camera.
                getCameraStream: () => navigator.mediaDevices.getUserMedia({ video: true }),
            });
            stop = call.listen();
            // Silent until the key is held, which is what push-to-talk means —
            // and the safer state to arrive in either way.
            call.setMuted(true);
        })();

        return () => {
            cancelled = true;
            stop();
        };
    });

    function onKeyDown(event) {
        if (!call?.active || !pushToTalk || event.repeat) return;
        if (event.key.toLowerCase() !== TALK_KEY) return;
        // Not while typing in the chat box.
        if (!$playerMovement) return;

        talking = true;
        call.talkWhile(true);
    }

    function onKeyUp(event) {
        if (!call?.active || !pushToTalk) return;
        if (event.key.toLowerCase() !== TALK_KEY) return;

        talking = false;
        call.talkWhile(false);
    }

    function togglePushToTalk() {
        pushToTalk = !pushToTalk;
        talking = false;
        // Leaving push-to-talk opens the microphone; entering it closes it until
        // the key is held.
        call?.setMuted(pushToTalk);
    }

    const peerList = $derived(Object.values(call?.peers ?? {}));
    /**
     * Whether the camera is worth offering at all.
     *
     * The server refuses video to anyone who is not a friend, so a camera button
     * in a room of strangers is a control whose only outcome is a refusal.
     */
    const anyFriendHere = $derived(peerList.some((peer) => peer.cameraAllowed));
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<div class="voice">
    {#if unsupported}
        <p class="note">Voice needs a secure connection (https).</p>
    {:else if call === null}
        <p class="note">Getting ready...</p>
    {:else if !call.active}
        <button class="voiceButton" name="joinVoice" onclick={() => call.join()}>
            Join voice
        </button>
        {#if call.failure}
            <p class="note failure">{call.failure}</p>
        {/if}
    {:else}
        <div class="row">
            <button class="voiceButton" name="leaveVoice" onclick={() => call.leave()}>
                Leave voice
            </button>
            <label class="check">
                <input type="checkbox" checked={pushToTalk} onchange={togglePushToTalk} />
                Push to talk ({TALK_KEY.toUpperCase()})
            </label>
        </div>

        {#if pushToTalk}
            <p class="note" class:talking>
                {talking ? "Talking..." : `Hold ${TALK_KEY.toUpperCase()} to talk`}
            </p>
        {:else}
            <button
                class="voiceButton"
                name="toggleMute"
                onclick={() => call.setMuted(!call.muted)}
            >
                {call.muted ? "Unmute" : "Mute"}
            </button>
        {/if}

        {#if anyFriendHere}
            <button
                class="voiceButton"
                name="toggleCamera"
                onclick={() => call.setCamera(!call.cameraOn)}
            >
                {call.cameraOn ? "Turn camera off" : "Turn camera on"}
            </button>
        {:else}
            <p class="note">The camera is only available with friends.</p>
        {/if}

        {#if call.failure}
            <p class="note failure">{call.failure}</p>
        {/if}

        <ul class="peers">
            {#each peerList as peer (peer.id)}
                <li data-peer={peer.id} data-connected={peer.stream ? "yes" : "no"}>
                    <span class="who">{peer.username ?? "Someone"}</span>
                    {#if peer.connectionFailed}
                        <span class="note">could not connect</span>
                    {/if}
                    <audio autoplay use:playing={{ stream: peer.stream, volume: peer.volume }}
                    ></audio>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={peer.volume}
                        aria-label="Volume for {peer.username ?? 'this person'}"
                        oninput={(event) => call.setVolume(peer.id, Number(event.target.value))}
                    />
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .voice {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        border-top: 3px solid rgb(27, 27, 27);
    }

    .row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .check {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: rgb(100, 100, 100);
    }

    .voiceButton {
        font-family: inherit;
        font-size: 14px;
        padding: 6px 10px;
        border: 3px solid rgb(204, 204, 204);
        background-color: rgb(228, 228, 228);
        color: rgb(100, 100, 100);
        cursor: pointer;
    }

    .voiceButton:hover {
        background-color: rgb(204, 204, 204);
    }

    .note {
        margin: 0;
        font-size: 12px;
        color: rgb(110, 110, 110);
    }

    .talking {
        color: green;
    }

    .failure {
        color: rgb(170, 40, 40);
    }

    .peers {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .peers li {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
    }

    /* A camera tile stays small: this is a sidebar beside a film, not a
       meeting. Someone with their camera on is a face, not the main event. */
    .tile {
        width: 96px;
        height: 72px;
        object-fit: cover;
        background: rgb(27, 27, 27);
    }

    .who {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>

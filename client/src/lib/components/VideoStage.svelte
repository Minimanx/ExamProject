<script>
    import { onDestroy } from "svelte";
    import { targetPosition, correctionFor } from "../services/playbackSync.js";

    let { socket, isHost = false } = $props();

    // The film is a file on this machine. createObjectURL makes it playable
    // without it going anywhere — nothing is uploaded, and the server only ever
    // learns a number of seconds.
    let objectUrl = $state("");
    let fileName = $state("");
    let video = $state();

    let playing = $state(false);
    let countdown = $state(0);
    let readyCount = $state(0);
    let readyCheckOpen = $state(false);
    let iAmReady = $state(false);

    let countdownTimer;

    function chooseFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        fileName = file.name;
    }

    async function applyState(state) {
        playing = state.playing;
        readyCount = state.ready.length;
        readyCheckOpen = state.readyCheckOpen;
        if (!state.readyCheckOpen) iAmReady = false;

        if (!video) return;

        const { seekTo, playbackRate } = correctionFor({
            currentTime: video.currentTime,
            target: targetPosition(state),
            playing: state.playing,
        });
        if (seekTo !== null) video.currentTime = seekTo;
        video.playbackRate = playbackRate;

        if (state.playing && video.paused) {
            // A browser may refuse to start a video without a gesture. The
            // person still has the controls; nothing else is broken by it.
            await video.play().catch(() => {});
        }
        if (!state.playing && !video.paused) {
            video.pause();
        }
    }

    function runCountdown({ seconds }) {
        clearInterval(countdownTimer);
        countdown = seconds;

        countdownTimer = setInterval(() => {
            countdown -= 1;
            if (countdown > 0) return;

            clearInterval(countdownTimer);
            // Only the host announces the start; everyone else is already being
            // steered by the state that follows it.
            if (isHost) socket.emit("playbackPlay", { positionSeconds: video?.currentTime ?? 0 });
        }, 1000);
    }

    socket.on("playbackState", applyState);
    socket.on("playbackCountdown", runCountdown);
    socket.emit("playbackSync");

    onDestroy(() => {
        socket.off("playbackState", applyState);
        socket.off("playbackCountdown", runCountdown);
        clearInterval(countdownTimer);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    });

    const position = () => video?.currentTime ?? 0;
</script>

<div class="videoStage">
    {#if !objectUrl}
        <div class="chooser">
            <label for="filmFile">Open your copy of the film</label>
            <input
                id="filmFile"
                name="filmFile"
                type="file"
                accept="video/*"
                onchange={chooseFile}
            />
            <p class="note">It stays on your machine — only the playhead is shared.</p>
        </div>
    {:else}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={video} src={objectUrl} class="film" controls={isHost}></video>
        <p class="fileName">{fileName}</p>
    {/if}

    {#if countdown > 0}
        <div class="countdown" data-testid="countdown">{countdown}</div>
    {/if}

    <div class="controls">
        {#if isHost}
            <button
                name="play"
                onclick={() => socket.emit("playbackPlay", { positionSeconds: position() })}
            >
                Play
            </button>
            <button
                name="pause"
                onclick={() => socket.emit("playbackPause", { positionSeconds: position() })}
            >
                Pause
            </button>
            <button name="readyCheck" onclick={() => socket.emit("readyCheck")}>Ready check</button>
            <button name="startCountdown" onclick={() => socket.emit("startCountdown")}>
                Start countdown
            </button>
            <span class="readyCount">{readyCount} ready</span>
        {:else}
            <span class="hostOnly"
                >{playing ? "Playing" : "Paused"} — the host has the controls</span
            >
            {#if readyCheckOpen}
                <button
                    name="ready"
                    disabled={iAmReady}
                    onclick={() => {
                        iAmReady = true;
                        socket.emit("ready");
                    }}
                >
                    {iAmReady ? "Ready" : "I'm ready"}
                </button>
            {/if}
        {/if}
    </div>
</div>

<style>
    .videoStage {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .film {
        width: 100%;
        max-height: 40vh;
        background: #000000;
    }

    .chooser {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px;
        border: 2px dashed #331b02;
        border-radius: 8px;
        text-align: center;
    }

    .note,
    .fileName {
        margin: 0;
        font-size: 11px;
        opacity: 0.75;
    }

    .countdown {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 72px;
        font-weight: bold;
        color: #ffffff;
        text-shadow: 0 0 12px #000000;
        pointer-events: none;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        font-size: 12px;
    }
</style>

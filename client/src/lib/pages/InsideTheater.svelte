<script>
    import { onMount } from "svelte";
    import { resolve } from "$app/paths";
    import { apiFetch, createSocket } from "../services/api.js";
    import { user } from "../stores/userStore.js";
    import { error, success } from "../components/toasts/toastThemes.js";
    import { Pulse } from "svelte-loading-spinners";
    import { formatDuration, formatTimeOfDay } from "../services/duration.js";
    import VideoStage from "../components/VideoStage.svelte";
    import VoiceCall from "../components/VoiceCall.svelte";

    const socket = createSocket();

    let { id } = $props();
    let theater = $state();
    let messages = $state([]);
    let sendMessage = $state();
    // bind:this targets must be state in runes mode.
    let sendMessageButton = $state();
    let scrollContainer = $state();
    let currentTime = $state(new Date());
    /** Why the theater could not be shown, if it could not. */
    let loadFailure = $state("");

    /**
     * How much backscroll the chat keeps.
     *
     * Enough that nobody scrolls past it during a film, and few enough that a
     * three-hour showing does not accumulate a DOM node per message all evening.
     */
    const MAX_VISIBLE_MESSAGES = 200;
    // Animation-frame handle only, never read in the template.
    let scrollFrameId;

    function handleNewMessage({ text, username, color }) {
        // Capped. A showing runs for hours with the chat open, and every message
        // was kept forever — both in memory and as a DOM node, so a busy lobby
        // slowly turned into thousands of them.
        messages = [...messages, { text, time: new Date(), username, color }].slice(
            -MAX_VISIBLE_MESSAGES
        );

        cancelAnimationFrame(scrollFrameId);
        scrollFrameId = requestAnimationFrame(() => {
            if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
    }

    function updateElapsedTime() {
        if (!theater) return;

        currentTime = new Date();
    }

    // Each countdown is the gap between now and one of the theater's two
    // timestamps. They were spelled out inline, three times, as a Date built
    // from a duration and read through local-time accessors — see defect C2 and
    // services/duration.js.
    const startsAt = $derived(theater ? new Date(theater.startTime).getTime() : 0);
    const closesAt = $derived(theater ? new Date(theater.timeToClose).getTime() : 0);
    const endsAt = $derived(closesAt - 900000);
    const untilStart = $derived(formatDuration(startsAt - currentTime.getTime()));
    const sinceStart = $derived(formatDuration(currentTime.getTime() - startsAt));
    const untilClose = $derived(formatDuration(closesAt - currentTime.getTime()));

    onMount(() => {
        let active = true;
        socket.on("newMessage", handleNewMessage);
        socket.emit("enteredTheater", { theaterId: id });

        async function initialize() {
            const response = await apiFetch("/theaters/" + id);
            const result = await response.json();
            if (!active) return;

            // Checked, because a theater that has closed or one you are not
            // allowed into answers with an error — and reading `data` off it
            // left the page spinning forever with nothing to say and no way out.
            if (!response.ok) {
                loadFailure = result.message || "That theater could not be opened.";
                return;
            }

            theater = result.data;
            updateElapsedTime();
        }
        initialize().catch((err) => console.error("Failed to load theater", err));

        const clockInterval = setInterval(updateElapsedTime, 1000);

        return () => {
            active = false;
            clearInterval(clockInterval);
            cancelAnimationFrame(scrollFrameId);
            socket.off("newMessage", handleNewMessage);
            socket.emit("leftTheater");
        };
    });

    function emitMessage() {
        if (!sendMessage || !sendMessage.trim().length) return;
        socket.emit("sendNewMessage", { sendMessage, color: $user.playerColor });
        sendMessage = "";
        sendMessageButton?.focus();
    }

    function leaveTheater() {
        window.location.href = "/";
    }

    function inviteToTheater() {
        navigator.clipboard.writeText(`${window.location.origin}?position=${theater.position}`);
        success("Invite link copied to clipboard!");
    }

    async function deleteTheater() {
        const response = await apiFetch("/theaters/" + theater._id, {
            method: "DELETE",
        });
        const result = await response.json();

        // Any failure, not just 400: the API answers 401 for a missing or bad
        // session, 403 for a forbidden action, 404, 502 for an upstream. Only
        // checking 400 meant those showed the user nothing at all.
        if (!response.ok) {
            error(result.message);
        }
        if (response.ok) {
            window.location.href = "/";
        }
    }
</script>

<div class="container">
    {#if theater}
        <div class="movieInfoContainer">
            <div class="timeOfMovie">
                {#if currentTime.getTime() < startsAt}
                    <h1>Starts in:</h1>
                    <h1>{untilStart}</h1>
                {:else if currentTime.getTime() < endsAt}
                    <h1>Ongoing:</h1>
                    <h1>{sinceStart}</h1>
                {:else if currentTime.getTime() < closesAt}
                    <h1>Closing in:</h1>
                    <h1>{untilClose}</h1>
                {:else}
                    <h1>Closed</h1>
                {/if}
            </div>
            <VideoStage {socket} isHost={theater.ownerID === $user.userID} />
        </div>

        <div class="liveChatContainer">
            <div class="topBar">
                <button
                    class="menuButton"
                    id="leaveTheaterButton"
                    onclick={leaveTheater}
                    title="Leave theater"
                >
                    <svg
                        width="40px"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 -0.5 19 23"
                        shape-rendering="crispEdges"
                    >
                        <path
                            stroke="rgb(100, 100, 100)"
                            d="M0 0h15M0 1h15M0 2h6M13 2h2M0 3h2M4 3h4M13 3h2M0 4h2M6 4h4M13 4h2M0 5h2M8 5h2M13 5h2M0 6h2M8 6h2M13 6h2M0 7h2M8 7h2M13 7h2M0 8h2M8 8h2M13 8h2M0 9h2M8 9h2M16 9h2M0 10h2M8 10h2M11 10h8M0 11h2M8 11h2M11 11h8M0 12h2M8 12h2M16 12h2M0 13h2M8 13h2M13 13h2M0 14h2M8 14h2M13 14h2M0 15h2M8 15h2M13 15h2M0 16h2M8 16h2M13 16h2M0 17h2M8 17h2M13 17h2M0 18h2M8 18h7M0 19h4M8 19h7M2 20h4M8 20h2M4 21h6M6 22h4"
                        />
                    </svg>
                </button>
                <button
                    class="menuButton"
                    id="inviteToTheaterButton"
                    onclick={inviteToTheater}
                    title="Copy invite link"
                >
                    <svg
                        width="40px"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 -0.5 19 23"
                        shape-rendering="crispEdges"
                    >
                        <path
                            stroke="rgb(100, 100, 100)"
                            d="M0 0h15M0 1h15M0 2h2M13 2h2M0 3h2M13 3h2M0 4h2M4 4h15M0 5h2M4 5h15M0 6h2M4 6h2M17 6h2M0 7h2M4 7h2M17 7h2M0 8h2M4 8h2M17 8h2M0 9h2M4 9h2M17 9h2M0 10h2M4 10h2M17 10h2M0 11h2M4 11h2M17 11h2M0 12h2M4 12h2M17 12h2M0 13h2M4 13h2M17 13h2M0 14h2M4 14h2M17 14h2M0 15h2M4 15h2M17 15h2M0 16h2M4 16h2M17 16h2M0 17h2M4 17h2M17 17h2M0 18h6M17 18h2M0 19h6M17 19h2M4 20h2M17 20h2M4 21h15M4 22h15"
                        />
                    </svg>
                </button>
                {#if theater}
                    {#if theater.ownerID === $user.userID}
                        <button
                            class="menuButton"
                            id="deleteTheaterButton"
                            onclick={deleteTheater}
                            title="Delete theater"
                        >
                            <svg
                                width="40px"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 -0.5 20 23"
                                shape-rendering="crispEdges"
                            >
                                <path
                                    stroke="rgb(100, 100, 100)"
                                    d="M6 0h8M6 1h8M4 2h2M14 2h2M4 3h2M14 3h2M1 4h18M1 5h18M0 6h2M18 6h2M1 7h18M1 8h18M1 9h2M17 9h2M1 10h2M17 10h2M1 11h2M17 11h2M1 12h2M5 12h2M9 12h2M13 12h2M17 12h2M1 13h2M5 13h2M9 13h2M13 13h2M17 13h2M1 14h2M5 14h2M9 14h2M13 14h2M17 14h2M2 15h2M5 15h2M9 15h2M13 15h2M16 15h2M2 16h2M5 16h2M9 16h2M13 16h2M16 16h2M2 17h2M5 17h2M9 17h2M13 17h2M16 17h2M2 18h2M5 18h2M9 18h2M13 18h2M16 18h2M2 19h2M5 19h2M9 19h2M13 19h2M16 19h2M2 20h2M16 20h2M2 21h16M3 22h14"
                                />
                            </svg>
                        </button>
                    {/if}
                {/if}
            </div>

            <!-- Every box in this sidebar is `position: fixed` — the top bar,
                 the message list and the input all are — so the column itself
                 is empty space and anything placed in the flow lands underneath
                 one of them: visible, and not clickable. This joins on the same
                 terms, in the band under the top bar, and the message list gives
                 up the height it takes. -->
            <div class="voiceSlot">
                <VoiceCall {socket} />
            </div>

            <div class="liveChat" bind:this={scrollContainer}>
                {#each messages as message, index (index)}
                    <div class="wholeMessage">
                        <ul>
                            <div class="messageInfo">
                                <li style="color: {message.color}">
                                    {message.username}
                                </li>
                                <li class="timeStamp">
                                    {formatTimeOfDay(message.time, undefined, undefined, {
                                        seconds: true,
                                    })}
                                </li>
                            </div>
                            <li>
                                {message.text}
                            </li>
                        </ul>
                    </div>
                {/each}
            </div>
            <div class="messageDiv">
                <form onsubmit={(event) => event.preventDefault()}>
                    <input
                        class="messageInput"
                        type="text"
                        maxlength="200"
                        bind:this={sendMessageButton}
                        bind:value={sendMessage}
                    />
                    <button class="messageButton menuButton" onclick={emitMessage}>></button>
                </form>
            </div>
        </div>
    {:else if loadFailure}
        <div class="theaterFailure" role="alert">
            <p>Could not open this theater.</p>
            <p class="detail">{loadFailure}</p>
            <a class="backToWorld" href={resolve("/")}>Back to the world</a>
        </div>
    {:else}
        <div id="loadingSpinner">
            <Pulse size="80" color="aqua" unit="px" duration="1s" />
        </div>
    {/if}
</div>

<style>
    #loadingSpinner {
        margin: auto;
    }
    .timeOfMovie {
        text-align: center;
        /* Sized as a heading now that the film is the main event below it. */
        flex: none;
    }
    #inviteToTheaterButton {
        font-size: 40px;
        right: 80px;
        top: 10px;
        height: 60px;
        width: 60px;
    }
    #deleteTheaterButton {
        font-size: 40px;
        right: 150px;
        top: 10px;
        height: 60px;
        width: 60px;
    }
    #leaveTheaterButton {
        font-size: 40px;
        right: 10px;
        top: 10px;
        height: 60px;
        width: 60px;
    }
    .topBar {
        height: 79px;
        top: 0px;
        width: 497px;
        border-bottom: 3px solid rgb(27, 27, 27);
        position: fixed;
    }
    .timeStamp {
        color: rgb(241, 241, 241);
    }
    .messageDiv {
        margin: 0 auto;
    }
    .wholeMessage:hover .timeStamp {
        color: rgb(100, 100, 100);
    }
    .wholeMessage:hover {
        background-color: rgb(228 228 228);
    }
    .messageInput {
        width: 394px;
        position: fixed;
        height: 50px;
        bottom: 8px;
        right: 94px;
    }
    .messageButton {
        width: 75px;
        height: 50px;
        font-size: 30px;
        bottom: 8px;
        right: 10px;
    }
    .messageInfo {
        display: flex;
        width: 100%;
        justify-content: space-between;
    }
    ul {
        width: 100%;
        margin: 0;
        list-style-type: none;
        padding: 5px 0px;
        display: flex;
        align-items: flex-start;
        line-height: 20px;
        box-sizing: border-box;
        gap: 5px;
        flex-direction: column;
        border-top: 10px solid #f1f1f1;
        border-bottom: 10px solid #f1f1f1;
        border-left: 16px solid #f1f1f1;
        border-right: 16px solid #f1f1f1;
    }
    .voiceSlot {
        position: fixed;
        top: 82px;
        right: 2px;
        width: 494px;
        max-height: 180px;
        overflow-y: auto;
        box-sizing: border-box;
    }

    .liveChat {
        -ms-overflow-style: none;
        scrollbar-width: none;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        position: fixed;
        bottom: 62px;
        right: 2px;
        width: 494px;
        /* Less the band the voice panel occupies above it. */
        max-height: calc(var(--stage-height) - 144px - 182px);
        overflow-x: auto;
        overflow-wrap: anywhere;
    }
    .liveChat::-webkit-scrollbar {
        display: none;
    }
    .theaterFailure {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        height: var(--stage-height);
        background-color: rgb(225, 241, 255);
        text-align: center;
    }

    .theaterFailure p {
        margin: 0;
        font-size: 18px;
    }

    .theaterFailure .detail {
        font-size: 13px;
        color: rgb(90, 90, 90);
    }

    .backToWorld {
        margin-top: 8px;
        padding: 12px 18px;
        font-size: 15px;
        color: rgb(27, 27, 27);
        background-color: rgb(228, 228, 228);
        border: 4px solid rgb(204, 204, 204);
    }

    .backToWorld:hover {
        background-color: rgb(204, 204, 204);
        border-color: rgb(189, 189, 189);
        text-decoration: none;
    }

    .movieInfoContainer {
        height: var(--stage-height);
        width: calc(var(--stage-width) - 500px);
        background-color: rgb(225, 241, 255);
        overflow: hidden;
        display: flex;
        /* A column, not a row. This held only the countdown until the film was
           added beside it, at which point the two shared one line and each got
           half of it — the picker and the clock elbowing each other in the
           middle of an otherwise empty screen. */
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        gap: 16px;
        padding: 24px;
        box-sizing: border-box;
    }
    .liveChatContainer {
        height: var(--stage-height);
        width: 500px;
        background-color: rgb(241, 241, 241);
        overflow: hidden;
        display: flex;
        border-left: 3px solid rgb(27, 27, 27);
        box-sizing: border-box;
        flex-direction: column;
        justify-content: flex-end;
    }
    .container {
        min-width: var(--stage-width);
        max-width: var(--stage-width);
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        height: var(--stage-height);
    }
    .menuButton {
        position: fixed;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 4px solid rgb(204, 204, 204);
        box-sizing: border-box;
        background-color: rgb(228, 228, 228);
        color: rgb(100, 100, 100);
    }
    .menuButton:hover {
        background-color: rgb(204, 204, 204);
        border: 4px solid rgb(189, 189, 189);
        color: rgb(85, 85, 85);
        cursor: pointer;
    }
</style>

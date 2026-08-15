<script>
    import { apiFetch, createSocket } from "../services/api.js";
    import { onMount } from "svelte";
    import TheaterInfoScreen from "../components/TheaterInfoScreen.svelte";
    import LoginScreen from "../components/LoginScreen.svelte";
    import { user, reconcileSession } from "../stores/userStore.js";
    import TheatersListView from "../components/TheatersListView.svelte";
    import FriendsScreen from "../components/FriendsScreen.svelte";
    import ClubsScreen from "../components/ClubsScreen.svelte";
    import SpeechBubble from "../art/SpeechBubble.svelte";
    import CreateEventScreen from "../components/CreateEventScreen.svelte";
    import { playerMovement } from "../stores/stateManagementStore.js";
    import { stepFor } from "../services/driving.js";
    import AboutPage from "../components/AboutPage.svelte";
    import { page } from "$app/state";
    import { Pulse } from "svelte-loading-spinners";
    import Skyline from "../art/Skyline.svelte";
    import StreetSign from "../art/StreetSign.svelte";
    import LogoutIcon from "../art/LogoutIcon.svelte";
    import EmptyLot from "../art/EmptyLot.svelte";
    import Car from "../art/Car.svelte";
    import TheaterFront from "../art/TheaterFront.svelte";

    const socket = createSocket();

    function handleNewCarPosition({ id, coords, direction, screen }) {
        if (!$user.insideTheater) {
            const carIndex = cars.findIndex((car) => car.id === id);
            if (carIndex !== -1) {
                cars[carIndex] = {
                    ...cars[carIndex],
                    coords: {
                        x: coords.x + screen,
                        y: coords.y,
                        direction: direction,
                    },
                };
                cars = cars;
            }
        }
    }

    function handleNewCarJoined({ id, coords, color, name, screen }) {
        if (!$user.insideTheater) {
            if (cars.findIndex((car) => car.id === id) === -1) {
                cars.push({
                    id,
                    color,
                    name,
                    coords: {
                        x: Number.isFinite(coords?.x + screen) ? coords.x + screen : 60,
                        y: Number.isFinite(coords?.y) ? coords.y : 600,
                    },
                });
                emitCarJoined();
                cars = cars;
            }
        }
    }

    function handleCarLeft({ id }) {
        if (!$user.insideTheater) {
            const carIndex = cars.findIndex((car) => car.id === id);
            if (carIndex !== -1) {
                cars.splice(carIndex, 1);
                cars = cars;
            }
        }
    }

    function handleNewColorChanged({ id, color }) {
        if (!$user.insideTheater) {
            const carIndex = cars.findIndex((car) => car.id === id);
            if (carIndex !== -1) {
                cars[carIndex].color = color;
                cars = cars;
            }
        }
    }

    function handleNewCarUpdate({ id, name, color }) {
        if (!$user.insideTheater) {
            const carIndex = cars.findIndex((car) => car.id === id);
            if (carIndex !== -1) {
                cars[carIndex].name = name;
                cars[carIndex].color = color;
                cars = cars;
            }
        }
    }

    function handleNewTheaterAdded() {
        if (!$user.insideTheater) {
            getTheaters();
        }
    }

    function handleNewJoinedTheater({ id }) {
        if (!$user.insideTheater) {
            handleCarLeft({ id });
            getTheaters();
        }
    }

    /**
     * Snap back to where the server says we are.
     *
     * The server holds the position and refuses a proposal it could not have
     * reached. Ignoring a refusal would leave this client drawing a car
     * somewhere nobody else sees it, so the correction is applied rather than
     * argued with. `screen` is the scroll offset, so the world x is split back
     * across the two the way the movement loop keeps them.
     */
    function handlePositionCorrection({ x, y }) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        screenScrollAmount = Math.max(0, Math.min(x, screenScrollAmount));
        playerCoords.x = x - screenScrollAmount;
        playerCoords.y = y;
    }

    function handleConnect() {
        socketId = socket.id;
        emitCarJoined();
    }

    function emitCarJoined() {
        // The server uses its own socket.id; sending one was how a client could
        // impersonate another car (defect S3).
        socket.emit("carJoined", {
            color: $user.playerColor,
            coords: playerCoords,
            name: playerName,
            screen: screenScrollAmount,
        });
    }

    function emitCarPosition(force = false) {
        const now = Date.now();
        if (!force && now - lastPositionBroadcast < positionBroadcastInterval) return;
        lastPositionBroadcast = now;

        socket.emit("carPosition", {
            coords: playerCoords,
            direction: playerDirection,
            screen: screenScrollAmount,
        });
    }

    let cars = $state([]);

    // Speech bubbles, keyed by the speaker's socket id. One per car: a second
    // message replaces the first rather than stacking, which is what a bubble
    // over a car can actually show.
    let bubbles = $state({});
    // The socket's own id, mirrored into state. Reading `socket.id` directly in
    // the markup does not work: it is not reactive, and at first render the
    // socket is still connecting, so the effect binds to `bubbles[undefined]`
    // and never re-runs once the real id arrives. The id also changes on every
    // reconnect, and logging in forces one.
    let socketId = $state(socket.id);
    let hubMessage = $state("");
    const BUBBLE_LIFETIME_MS = 6000;
    // Plain object, not $state: these are timer handles, never read by the
    // markup, and nothing should re-render when one changes.
    const bubbleTimers = {};

    function showBubble({ id, text }) {
        bubbles[id] = text;

        // A second message from the same car replaces the first and restarts
        // its clock, rather than the earlier timer clearing the newer bubble.
        clearTimeout(bubbleTimers[id]);
        bubbleTimers[id] = setTimeout(() => {
            delete bubbles[id];
            delete bubbleTimers[id];
        }, BUBBLE_LIFETIME_MS);
    }

    function sendHubMessage() {
        const text = hubMessage.trim();
        if (!text) return;

        socket.emit("hubMessage", { text });
        hubMessage = "";
    }
    let theaters = $state([]);
    // keys, keyDown and lastPositionBroadcast are read only by the animation
    // loop and the key handlers, never by the template, so they stay plain lets
    // rather than paying for a proxy on a 60fps path.
    let keys = { w: false, s: false, a: false, d: false };
    let keyDown = false;
    // Mutated in place by the loop (playerCoords.x = ...). $state makes it a
    // proxy, so deep mutation stays reactive — do not rewrite it to reassign.
    let playerCoords = $state({ x: 60, y: 600 });
    const playerSpeed = 250;
    const positionBroadcastInterval = 1000 / 15;
    let lastPositionBroadcast = 0;
    let insideTheaterBool = $state(false);
    let currentTheater = $state(null);
    let playerDirection = $state(false);
    let playerName = $derived($user.username || "");
    let screenScrollAmount = $state(0);
    // Measured from the scene container rather than assumed, so the scroll maths
    // follow the real viewport width instead of a hard-coded 1000px.
    let canvasLength = $state(1000);
    let createEventBool = $state(false);
    let friendsBool = $state(false);
    let clubsBool = $state(false);
    let aboutPageBool = $state(false);
    // Not read by the template, but highestPosition derives from it — a $derived
    // only recomputes when its reactive dependencies change, so this must be
    // $state or the world would never grow past its initial size.
    let occupiedSlots = $state(0);
    let theatersLoaded = $state(false);
    // A failed load used to leave `theatersLoaded` false forever, so the app sat
    // on its spinner with no message and no way out — a server hiccup became a
    // permanently broken tab.
    let loadFailed = $state(false);
    /** Set once the scene mounts, so the failure screen has something to call. */
    let retryLoad;
    // The world is highestPosition * 400px wide and every slot draws its own
    // stretch of beach, road and rocks, so it must span at least the visible
    // scene or the ground runs out and bare water shows through. Derived rather
    // than assigned because canvasLength is measured from a element that only
    // exists once the scene renders — computing it once during load would read
    // the pre-measurement default. The old floor of 3 (1200px) happened to work
    // only while the scene was always 1000px wide.
    let highestPosition = $derived(Math.max(3, Math.ceil(canvasLength / 400), occupiedSlots));
    let currentTime = $state(new Date());

    onMount(() => {
        const socketHandlers = [
            ["newCarPosition", handleNewCarPosition],
            ["newCarJoined", handleNewCarJoined],
            ["carLeft", handleCarLeft],
            ["newColorChanged", handleNewColorChanged],
            ["newCarUpdate", handleNewCarUpdate],
            ["newTheaterAdded", handleNewTheaterAdded],
            ["newJoinedTheater", handleNewJoinedTheater],
            ["newHubMessage", showBubble],
            ["positionCorrection", handlePositionCorrection],
            ["connect", handleConnect],
        ];

        socketHandlers.forEach(([eventName, handler]) => socket.on(eventName, handler));
        if (socket.connected) handleConnect();

        let active = true;
        async function initialize() {
            loadFailed = false;
            // Before anything else: a stored session that the server no longer
            // recognises would otherwise render a world nobody else can see us in.
            await reconcileSession(apiFetch);
            await getTheaters();
            if (!active || !$user.loggedIn) return;

            $playerMovement = true;
            $user.insideTheater = false;
            if (page.url.searchParams.has("position")) {
                const queryPosition = Number(page.url.searchParams.get("position"));
                teleportToTheater(
                    queryPosition >= highestPosition ? highestPosition - 1 : queryPosition
                );
            }
        }
        function load() {
            initialize().catch((err) => {
                console.error("Failed to initialize theaters", err);
                if (active) loadFailed = true;
            });
        }
        retryLoad = load;
        load();

        let previousFrame = performance.now();
        let animationFrameId;
        function updateMovement(timestamp) {
            const deltaSeconds = Math.min((timestamp - previousFrame) / 1000, 0.05);
            previousFrame = timestamp;

            if (keyDown && $playerMovement) {
                // Normalised, so a diagonal is not 41% faster than a straight
                // line. It always was, and Phase 4's server-side speed limit
                // turned that into a car that snapped backwards every frame.
                const { dx, dy } = stepFor(keys, playerSpeed * deltaSeconds);

                if (dy < 0) playerCoords.y = Math.max(410, playerCoords.y + dy);
                if (dy > 0) playerCoords.y = Math.min(725, playerCoords.y + dy);

                if (dx < 0) {
                    playerCoords.x = Math.max(0, playerCoords.x + dx);
                    playerDirection = true;
                    if (playerCoords.x < 150 && screenScrollAmount > 0) {
                        const scrollDistance = Math.min(-dx, screenScrollAmount);
                        screenScrollAmount -= scrollDistance;
                        playerCoords.x += scrollDistance;
                    }
                }
                if (dx > 0) {
                    playerCoords.x = Math.min(canvasLength - 50, playerCoords.x + dx);
                    playerDirection = false;
                    const maxScroll = Math.max(0, highestPosition * 400 - canvasLength);
                    if (playerCoords.x > canvasLength - 200 && screenScrollAmount < maxScroll) {
                        const scrollDistance = Math.min(dx, maxScroll - screenScrollAmount);
                        screenScrollAmount += scrollDistance;
                        playerCoords.x -= scrollDistance;
                    }
                }

                emitCarPosition();
                checkIfInTheater();
            }

            animationFrameId = requestAnimationFrame(updateMovement);
        }
        animationFrameId = requestAnimationFrame(updateMovement);

        const clockInterval = setInterval(() => {
            currentTime = new Date();
        }, 60000);

        return () => {
            active = false;
            cancelAnimationFrame(animationFrameId);
            clearInterval(clockInterval);
            // One per speech bubble still on screen. Left running, each fires
            // into a component that no longer exists when its six seconds are up.
            Object.values(bubbleTimers).forEach(clearTimeout);
            socketHandlers.forEach(([eventName, handler]) => socket.off(eventName, handler));
            keys = { w: false, s: false, a: false, d: false };
            keyDown = false;
        };
    });

    function changeColor(event) {
        $user.playerColor = event.target.value;
        socket.emit("colorChanged", { color: $user.playerColor });
    }

    function handleKeydown(event) {
        if (!$playerMovement || typeof event.key !== "string") return;

        const key = event.key.toLowerCase();
        if (!(key in keys)) return;

        keys[key] = true;
        keyDown = true;
    }

    function handleKeyUp(event) {
        if (typeof event.key !== "string") return;

        const key = event.key.toLowerCase();
        if (!(key in keys)) return;

        keys[key] = false;
        if (Object.values(keys).every((value) => value === false)) {
            keyDown = false;
        }
    }

    function checkIfInTheater() {
        const playerWorldX = playerCoords.x + screenScrollAmount;
        const nextTheater =
            playerCoords.y < 550 && playerCoords.y > 400
                ? theaters.find(
                      (theater) =>
                          theater.position * 400 + 325 > playerWorldX &&
                          theater.position * 400 + 75 < playerWorldX + 50
                  )
                : null;

        if (nextTheater?._id !== currentTheater?._id) {
            currentTheater = nextTheater || null;
            insideTheaterBool = Boolean(nextTheater);
        }
    }

    function teleportToTheater(position) {
        playerCoords.y = 470;
        const worldX = position * 400 + 185;
        const maxScroll = Math.max(0, highestPosition * 400 - canvasLength);
        screenScrollAmount = Math.min(Math.max(0, worldX - (canvasLength - 215)), maxScroll);
        playerCoords.x = worldX - screenScrollAmount;
        emitCarPosition(true);
        checkIfInTheater();
    }

    async function getTheaters() {
        const response = await apiFetch("/theaters");
        if (!response.ok) {
            throw new Error(`The listing answered ${response.status}`);
        }

        const { data } = await response.json();
        theaters = data;

        occupiedSlots = theaters.length
            ? [...theaters].sort((a, b) => b.position - a.position)[0].position + 1
            : 0;
        theatersLoaded = true;

        const maxScroll = Math.max(0, highestPosition * 400 - canvasLength);
        if (screenScrollAmount > maxScroll) {
            screenScrollAmount = maxScroll;
            emitCarPosition(true);
        }
    }

    async function logout() {
        const response = await apiFetch("/logout");

        if (response.ok) {
            localStorage.clear();
            window.location.reload();
        }
    }

    function createEvent() {
        createEventBool = true;
    }

    function aboutPage() {
        aboutPageBool = true;
    }
</script>

<svelte:window onkeydown={handleKeydown} onkeyup={handleKeyUp} />

{#if theatersLoaded}
    {#if $user.loggedIn === false}
        <LoginScreen {socket} />
        <div class="container blackedout"></div>
    {/if}

    <!-- `inert` while the login overlay is up. The overlay is a box on top, which
         stops the mouse and does nothing about the keyboard — tab out of the
         password field and you land in the hub chat behind it, typing into
         something the server ignores. inert takes the whole subtree out of the
         tab order, out of hit testing, and out of the accessibility tree. -->
    <div class="container" inert={$user.loggedIn === false}>
        <div class="containerInteractiveSpace">
            <Skyline />
            <div class="waterExtension" aria-hidden="true"></div>
            <div class="container2" bind:clientWidth={canvasLength}>
                <div
                    class="world"
                    style="width: {highestPosition *
                        400}px; transform: translate3d({-screenScrollAmount}px, 0, 0);"
                >
                    {#each cars as car (car.id)}
                        <div
                            class="remoteCar"
                            style="transform: translate3d({car.coords.x}px, {car.coords.y}px, 0);"
                        >
                            {#if bubbles[car.id]}
                                <SpeechBubble
                                    text={bubbles[car.id]}
                                    carX={car.coords.x - screenScrollAmount}
                                    stageWidth={canvasLength}
                                />
                            {/if}
                            <Car
                                name={car.name}
                                color={car.color}
                                facingLeft={car.coords.direction}
                            />
                        </div>
                    {/each}

                    {#each theaters as theater (theater._id)}
                        <div class="lotSlot" style="left: {theater.position * 400}px;">
                            <TheaterFront {theater} {currentTime} />
                        </div>
                    {/each}
                    {#each Array(highestPosition) as _, index (index)}
                        {#if !theaters.some((theater) => theater.position === index)}
                            <div class="lotSlot" style="left: {index * 400}px;">
                                <EmptyLot />
                            </div>
                        {/if}
                    {/each}
                    <StreetSign />
                </div>
                <div class="hubChat">
                    <input
                        name="hubMessage"
                        type="text"
                        maxlength="200"
                        placeholder="Say something..."
                        bind:value={hubMessage}
                        onfocus={() => ($playerMovement = false)}
                        onblur={() => ($playerMovement = true)}
                        onkeydown={(event) => event.key === "Enter" && sendHubMessage()}
                    />
                </div>
                <div class="playerLayer">
                    <div
                        class="playerCar"
                        style="transform: translate3d({playerCoords.x}px, {playerCoords.y}px, 0);"
                    >
                        {#if bubbles[socketId]}
                            <SpeechBubble
                                text={bubbles[socketId]}
                                carX={playerCoords.x}
                                stageWidth={canvasLength}
                            />
                        {/if}
                        <Car
                            name={playerName}
                            color={$user.playerColor}
                            facingLeft={playerDirection}
                        />
                    </div>
                </div>
            </div>
        </div>

        <div class="containerListView">
            <label id="colorInputLabel" for="colorInput">Change Color</label>
            <input
                name="colorInput"
                id="colorInput"
                type="color"
                value={$user.playerColor}
                onchange={changeColor}
            />
            <button class="menuButton" id="logoutButton" onclick={logout}>
                <LogoutIcon />
            </button>
            <TheatersListView {theaters} {teleportToTheater} />
            {#if insideTheaterBool === true}
                <TheaterInfoScreen theater={currentTheater} />
            {/if}
            {#if createEventBool === true}
                <CreateEventScreen bind:createEventBool />
            {/if}
            {#if aboutPageBool === true}
                <AboutPage bind:aboutPageBool />
            {/if}
            {#if friendsBool === true}
                <FriendsScreen bind:friendsBool {socket} />
            {/if}
            {#if clubsBool === true}
                <ClubsScreen bind:clubsBool />
            {/if}
            <button class="menuButton" id="addTheaterButton" onclick={createEvent}
                >Create Event</button
            >
            <button class="menuButton" id="addSomethingElseButton" onclick={aboutPage}>About</button
            >
            <button class="menuButton" id="friendsButton" onclick={() => (friendsBool = true)}
                >Friends</button
            >
            <button class="menuButton" id="clubsButton" onclick={() => (clubsBool = true)}
                >Clubs</button
            >
        </div>
    </div>
{:else if loadFailed}
    <div class="loadingScreen" role="alert">
        <div class="loadFailure">
            <p>Could not reach FlixDrive.</p>
            <p class="detail">It may be down, or the connection dropped.</p>
            <button class="menuButton retryButton" onclick={() => retryLoad?.()}>Try again</button>
        </div>
    </div>
{:else}
    <div class="loadingScreen" role="status" aria-label="Loading">
        <div class="loadingBars">
            <Pulse size="200" color="aqua" unit="px" duration="1s" />
        </div>
    </div>
{/if}

<style>
    .loadFailure {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 32px;
        background-color: rgb(241, 241, 241);
        border: 3px solid rgb(27, 27, 27);
        text-align: center;
    }

    .loadFailure p {
        margin: 0;
        font-size: 16px;
    }

    .loadFailure .detail {
        font-size: 12px;
        color: rgb(100, 100, 100);
    }

    /* Static rather than fixed: this one belongs in the box, not pinned to a
       corner of the panel like the rest of them. */
    .retryButton {
        position: static;
        height: 56px;
        width: 220px;
        font-size: 18px;
    }

    .loadingScreen {
        position: fixed;
        inset: 0;
        width: var(--stage-width);
        height: var(--stage-height);
        display: grid;
        place-items: center;
    }
    .loadingBars {
        width: 200px;
        height: 80px;
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
    /* Every .menuButton is position:fixed and placed by explicit coordinates,
       so one without them lands in the corner of the panel on top of whatever
       is there. The bottom of the panel is now two rows, and the list above
       reserves room for both. */
    #friendsButton {
        font-size: 20px;
        right: 253px;
        bottom: 64px;
        height: 56px;
        width: 235px;
    }
    #clubsButton {
        font-size: 20px;
        right: 10px;
        bottom: 64px;
        height: 56px;
        width: 235px;
    }
    #addTheaterButton {
        font-size: 20px;
        right: 253px;
        bottom: 0px;
        height: 60px;
        width: 235px;
    }
    #addSomethingElseButton {
        font-size: 20px;
        right: 10px;
        bottom: 0px;
        height: 60px;
        width: 235px;
    }
    #logoutButton {
        font-size: 40px;
        right: 10px;
        top: 10px;
        height: 60px;
        width: 60px;
    }
    #colorInputLabel {
        color: white;
        z-index: 10;
        position: fixed;
        right: 180px;
        top: 33px;
        cursor: pointer;
    }
    #colorInput {
        width: 427px;
        height: 80px;
        background: transparent;
        position: fixed;
        border: none;
        cursor: pointer;
    }
    .blackedout {
        background-color: black;
        z-index: 2;
        opacity: 0.5;
        height: var(--stage-height);
        position: fixed;
    }
    .containerInteractiveSpace {
        height: var(--stage-height);
        width: calc(var(--stage-width) - 500px);
        background-color: #177aeb;
        overflow: hidden;
    }
    .containerListView {
        height: var(--stage-height);
        width: 500px;
        background-color: rgb(241, 241, 241);
        overflow: hidden;
        display: flex;
        border-left: 3px solid rgb(27, 27, 27);
        box-sizing: border-box;
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
    .waterExtension {
        position: absolute;
        top: 350px;
        bottom: 0;
        width: calc(var(--stage-width) - 500px);
        background: #177aeb url("/water-tile.svg") top left / 1000px 160px repeat;
    }
    .lotSlot {
        position: absolute;
        bottom: 0;
        width: 401px;
    }
    /* The art svgs were blockified by their own position:absolute before that
     moved here. Without this they render inline, sit on a text baseline, and
     the font strut's descent lifts them off the ground. Direct child only, so
     the nested icon svg inside TheaterFront keeps its own layout. */
    .lotSlot > :global(svg) {
        display: block;
    }
    .container2 {
        height: var(--stage-height);
        position: relative;
        overflow: hidden;
        contain: content;
    }
    .world {
        height: 800px;
        position: absolute;
        left: 0;
        top: var(--scene-offset);
        will-change: transform;
    }
    .hubChat {
        position: absolute;
        bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
        /* Above the world, below the panels that open over it. */
        z-index: 6;
    }

    .hubChat input {
        width: 320px;
        max-width: 60vw;
        padding: 6px 10px;
        border: 2px solid #331b02;
        border-radius: 10px;
        font-family: inherit;
        font-size: 13px;
    }

    .playerLayer {
        width: calc(var(--stage-width) - 500px);
        height: 800px;
        position: absolute;
        left: 0;
        top: var(--scene-offset);
    }
    .remoteCar,
    .playerCar {
        width: 50px;
        height: 30px;
        position: absolute;
        left: 0;
        top: 0;
        will-change: transform;
    }
    .remoteCar {
        z-index: 1000;
        transition: transform 70ms linear;
    }
    .playerCar {
        z-index: 1001;
    }
</style>

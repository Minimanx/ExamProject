<script>
  import { apiFetch, createSocket } from "../services/api.js";
  import { onMount } from "svelte";
  import TheaterInfoScreen from "../components/TheaterInfoScreen.svelte";
  import LoginScreen from "../components/LoginScreen.svelte";
  import { user } from "../stores/userStore.js";
  import TheatersListView from "../components/TheatersListView.svelte";
  import CreateEventScreen from "../components/CreateEventScreen.svelte";
  import { playerMovement } from "../stores/stateManagementStore.js";
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

  function handleConnect() {
    emitCarJoined();
  }

  function emitCarJoined() {
    socket.emit("carJoined", {
      id: socket.id,
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
      id: socket.id,
      coords: playerCoords,
      direction: playerDirection,
      screen: screenScrollAmount,
    });
  }

  let cars = $state([]);
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
  let aboutPageBool = $state(false);
  // Not read by the template, but highestPosition derives from it — a $derived
  // only recomputes when its reactive dependencies change, so this must be
  // $state or the world would never grow past its initial size.
  let occupiedSlots = $state(0);
  let theatersLoaded = $state(false);
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
      ["connect", handleConnect],
    ];

    socketHandlers.forEach(([eventName, handler]) => socket.on(eventName, handler));
    if (socket.connected) handleConnect();

    let active = true;
    async function initialize() {
      await getTheaters();
      if (!active || !$user.loggedIn) return;

      $playerMovement = true;
      $user.insideTheater = false;
      if (page.url.searchParams.has("position")) {
        const queryPosition = Number(page.url.searchParams.get("position"));
        teleportToTheater(queryPosition >= highestPosition ? highestPosition - 1 : queryPosition);
      }
    }
    initialize().catch((err) => console.error("Failed to initialize theaters", err));

    let previousFrame = performance.now();
    let animationFrameId;
    function updateMovement(timestamp) {
      const deltaSeconds = Math.min((timestamp - previousFrame) / 1000, 0.05);
      previousFrame = timestamp;

      if (keyDown && $playerMovement) {
        const distance = playerSpeed * deltaSeconds;
        if (keys.w && playerCoords.y > 410) playerCoords.y = Math.max(410, playerCoords.y - distance);
        if (keys.s && playerCoords.y < 725) playerCoords.y = Math.min(725, playerCoords.y + distance);
        if (keys.a && playerCoords.x > 0) {
          playerCoords.x = Math.max(0, playerCoords.x - distance);
          playerDirection = true;
          if (playerCoords.x < 150 && screenScrollAmount > 0) {
            const scrollDistance = Math.min(distance, screenScrollAmount);
            screenScrollAmount -= scrollDistance;
            playerCoords.x += scrollDistance;
          }
        }
        if (keys.d && playerCoords.x < canvasLength - 50) {
          playerCoords.x = Math.min(canvasLength - 50, playerCoords.x + distance);
          playerDirection = false;
          const maxScroll = Math.max(0, highestPosition * 400 - canvasLength);
          if (playerCoords.x > canvasLength - 200 && screenScrollAmount < maxScroll) {
            const scrollDistance = Math.min(distance, maxScroll - screenScrollAmount);
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
      socketHandlers.forEach(([eventName, handler]) => socket.off(eventName, handler));
      keys = { w: false, s: false, a: false, d: false };
      keyDown = false;
    };
  });

  function changeColor(event) {
    $user.playerColor = event.target.value;
    socket.emit("colorChanged", { id: socket.id, color: $user.playerColor });
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
    const nextTheater = playerCoords.y < 550 && playerCoords.y > 400
      ? theaters.find((theater) => (
          theater.position * 400 + 325 > playerWorldX &&
          theater.position * 400 + 75 < playerWorldX + 50
        ))
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

    if (response.status === 200) {
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

  <div class="container">
    <div class="containerInteractiveSpace">
      <Skyline />
      <div class="waterExtension" aria-hidden="true"></div>
      <div class="container2" bind:clientWidth={canvasLength}>
        <div
          class="world"
          style="width: {highestPosition * 400}px; transform: translate3d({-screenScrollAmount}px, 0, 0);"
        >
          {#each cars as car (car.id)}
          <div
            class="remoteCar"
            style="transform: translate3d({car.coords.x}px, {car.coords.y}px, 0);"
          >
            <Car name={car.name} color={car.color} facingLeft={car.coords.direction} />
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
        <div class="playerLayer">
          <div
            class="playerCar"
            style="transform: translate3d({playerCoords.x}px, {playerCoords.y}px, 0);"
          >
            <Car name={playerName} color={$user.playerColor} facingLeft={playerDirection} />
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
      <button class="menuButton" id="addTheaterButton" onclick={createEvent}
        >Create Event</button
      >
      <button
        class="menuButton"
        id="addSomethingElseButton"
        onclick={aboutPage}>About</button
      >
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

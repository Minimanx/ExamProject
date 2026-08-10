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
  import { useLocation } from "svelte-navigator";
  import { Pulse } from "svelte-loading-spinners";
  import Skyline from "../art/Skyline.svelte";

  const socket = createSocket();
  const location = useLocation();

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

  let cars = [];
  let theaters = [];
  let keys = { w: false, s: false, a: false, d: false };
  let keyDown = false;
  let playerCoords = { x: 60, y: 600 };
  const playerSpeed = 250;
  const positionBroadcastInterval = 1000 / 15;
  let lastPositionBroadcast = 0;
  let insideTheaterBool = false;
  let currentTheater = null;
  let playerDirection = false;
  $: playerName = $user.username || "";
  let screenScrollAmount = 0;
  const canvasLength = 1000;
  let createEventBool = false;
  let aboutPageBool = false;
  let highestPosition;
  let currentTime = new Date();

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
      if ($location.search.split("=")[0] === "?position") {
        const queryPosition = Number($location.search.split("=")[1]);
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
          const maxScroll = highestPosition * 400 - 1000;
          if (playerCoords.x > 800 && screenScrollAmount < maxScroll) {
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
    if (position === 0) {
      playerCoords.x = 185;
      screenScrollAmount = 0;
    } else if (position === 1) {
      playerCoords.x = 585;
      screenScrollAmount = 0;
    } else if (position > 1) {
      screenScrollAmount = position * 400 - 600;
      playerCoords.x = 785;
    }
    emitCarPosition(true);
    checkIfInTheater();
  }

  async function getTheaters() {
    const response = await apiFetch("/theaters");
    const { data } = await response.json();
    theaters = data;

    if (theaters.length !== 0) {
      highestPosition =
        [...theaters].sort((a, b) => b.position - a.position)[0].position + 1;
      if (highestPosition < 3) {
        highestPosition = 3;
      }
    } else {
      highestPosition = 3;
    }
    if (screenScrollAmount > highestPosition * 400 - 1000) {
      screenScrollAmount = highestPosition * 400 - 1000;
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

<svelte:window on:keydown={handleKeydown} on:keyup={handleKeyUp} />

{#if highestPosition}
  {#if $user.loggedIn === false}
    <LoginScreen {socket} />
    <div class="container blackedout" />
  {/if}

  <div class="container">
    <div class="containerInteractiveSpace">
      <Skyline />
      <div class="waterExtension" aria-hidden="true"></div>
      <div class="container2" style="width: {canvasLength}px">
        <div
          class="world"
          style="width: {highestPosition * 400}px; transform: translate3d({-screenScrollAmount}px, 0, 0);"
        >
          {#each cars as car (car.id)}
          <div
            class="remoteCar"
            style="transform: translate3d({car.coords.x}px, {car.coords.y}px, 0);"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -0.5 48 18"
              shape-rendering="crispEdges"
              preserveAspectRatio="xMaxYMax meet"
              transform={car.coords.direction === false ? "scale(-1, 1)" : ""}
            >
              <text
                class="carName"
                transform={car.coords.direction === false ? "scale(-1, 1)" : ""}
                transform-origin={car.coords.direction === false ? "50% 50%" : ""}
                font-size="10px"
                font-weight="bold">{car.name}</text
              >
              <path
                stroke="#000000"
                d="M22 0h2M21 1h1M23 1h1M20 2h1M22 2h1M19 3h1M21 3h1M18 4h1M20 4h1M27 4h2M34 4h4M17 5h1M19 5h1M26 5h1M28 5h1M33 5h1M35 5h1M38 5h3M9 6h8M18 6h17M41 6h6M4 7h5M17 7h1M30 7h1M46 7h1M2 8h2M17 8h1M27 8h2M31 8h1M46 8h1M1 9h1M16 9h1M31 9h1M46 9h1M0 10h1M7 10h4M16 10h1M30 10h1M35 10h4M47 10h1M0 11h1M6 11h1M11 11h1M16 11h1M30 11h1M34 11h1M39 11h1M47 11h1M0 12h3M5 12h1M12 12h1M16 12h1M29 12h1M33 12h1M40 12h1M44 12h4M0 13h1M3 13h3M12 13h22M40 13h4M47 13h1M1 14h1M5 14h1M12 14h1M33 14h1M40 14h1M45 14h2M2 15h4M12 15h22M40 15h5M6 16h1M11 16h1M34 16h1M39 16h1M7 17h4M35 17h4"
              />
            <path
              stroke={car.color}
              d="M22 1h1M21 2h1M20 3h1M19 4h1M18 5h1M36 5h2M17 6h1M35 6h6M9 7h8M18 7h12M31 7h15M4 8h13M18 8h9M29 8h2M32 8h14M2 9h14M17 9h14M32 9h14M1 10h6M11 10h5M17 10h13M31 10h4M39 10h8M1 11h5M12 11h4M17 11h13M31 11h3M40 11h7M3 12h2M13 12h3M17 12h12M30 12h3M41 12h3M1 13h2M44 13h3M2 14h3M13 14h20M41 14h4"
            />
            <path stroke="#613c0c" d="M27 5h1M34 5h1" />
            <path
              stroke="#333333"
              d="M7 11h4M35 11h4M6 12h2M10 12h2M34 12h2M38 12h2M6 13h1M11 13h1M34 13h1M39 13h1M6 14h1M11 14h1M34 14h1M39 14h1M6 15h2M10 15h2M34 15h2M38 15h2M7 16h4M35 16h4"
            />
            <path
              stroke="#7a7a7a"
              d="M8 12h2M36 12h2M7 13h1M10 13h1M35 13h1M38 13h1M7 14h1M10 14h1M35 14h1M38 14h1M8 15h2M36 15h2"
            />
            <path stroke="#ababab" d="M8 13h2M36 13h2M8 14h2M36 14h2" />
            </svg>
          </div>
          {/each}

          {#each theaters as theater (theater._id)}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 -0.5 150 223"
            shape-rendering="crispEdges"
            style="left: {theater.position * 400}px; bottom: 0; width: 401px; position: absolute;"
          >
            <path
              stroke="#331b02"
              d="M14 0h128M14 1h1M141 1h1M14 2h1M141 2h1M14 3h1M141 3h1M14 4h1M141 4h1M14 5h1M141 5h1M14 6h1M141 6h1M14 7h1M141 7h1M14 8h1M141 8h1M14 9h1M141 9h1M14 10h1M141 10h1M14 11h1M141 11h1M14 12h1M141 12h1M14 13h1M141 13h1M14 14h1M141 14h1M14 15h1M141 15h1M14 16h1M141 16h1M14 17h1M141 17h1M14 18h1M141 18h1M14 19h1M141 19h1M14 20h1M141 20h1M14 21h1M141 21h1M14 22h1M141 22h1M14 23h1M141 23h1M14 24h1M141 24h1M14 25h1M141 25h1M14 26h1M141 26h1M14 27h1M141 27h1M14 28h1M141 28h1M14 29h1M141 29h1M14 30h1M141 30h1M14 31h1M141 31h1M14 32h1M141 32h1M14 33h1M141 33h1M14 34h1M141 34h1M14 35h1M141 35h1M14 36h1M141 36h1M14 37h1M141 37h1M14 38h1M141 38h1M14 39h1M141 39h1M14 40h1M141 40h1M14 41h1M141 41h1M14 42h1M141 42h1M14 43h1M141 43h1M14 44h1M141 44h1M14 45h1M141 45h1M14 46h1M141 46h1M14 47h1M141 47h1M14 48h1M141 48h1M14 49h1M141 49h1M14 50h1M141 50h1M14 51h1M141 51h1M14 52h1M141 52h1M14 53h1M141 53h1M14 54h1M141 54h1M14 55h1M141 55h1M14 56h1M141 56h1M14 57h1M141 57h1M14 58h1M141 58h1M14 59h1M141 59h1M14 60h1M141 60h1M14 61h1M141 61h1M14 62h1M141 62h1M14 63h1M141 63h1M14 64h1M141 64h1M14 65h1M141 65h1M14 66h1M141 66h1M14 67h1M141 67h1M14 68h1M141 68h1M14 69h128M19 70h3M134 70h3M19 71h3M134 71h3M19 72h3M134 72h3M19 73h3M134 73h3M19 74h3M134 74h3M19 75h3M134 75h3"
            />
            <path
              stroke="#ffffff"
              d="M15 1h126M15 2h126M15 3h126M15 4h126M15 5h126M15 6h126M15 7h126M15 8h126M15 9h126M15 10h126M15 11h126M15 12h126M15 13h126M15 14h126M15 15h126M15 16h126M15 17h126M15 18h126M15 19h126M15 20h126M15 21h126M15 22h126M15 23h126M15 24h126M15 25h126M15 26h126M15 27h126M15 28h126M15 29h126M15 30h126M15 31h126M15 32h126M15 33h126M15 34h126M15 35h126M15 36h126M15 37h126M15 38h126M15 39h126M15 40h126M15 41h126M15 42h126M15 43h126M15 44h126M15 45h126M15 46h126M15 47h126M15 48h126M15 49h126M15 50h126M15 51h126M15 52h126M15 53h126M15 54h126M15 55h126M15 56h126M15 57h126M15 58h126M15 59h126M15 60h126M15 61h126M15 62h126M15 63h126M15 64h126M15 65h126M15 66h126M15 67h126M15 68h126"
            />
            <path
              stroke="#8f8f8f"
              d="M0 49h1M9 49h5M142 49h3M148 49h2M0 50h11M143 50h7M3 51h3M144 51h2"
            />
            <path
              stroke="#b39464"
              d="M11 50h3M142 50h1M0 51h3M6 51h5M143 51h1M146 51h4M3 52h4M144 52h2M0 67h4M0 68h10M148 68h2M0 69h14M144 69h6M0 70h9M11 70h8M23 70h74M142 70h8M0 71h7M11 71h8M23 71h78M138 71h3M144 71h6M0 72h7M11 72h8M23 72h82M137 72h5M147 72h3M0 73h6M10 73h9M23 73h86M137 73h7M149 73h1M0 74h6M10 74h1M18 74h1M23 74h92M129 74h4M137 74h8M1 75h4M16 75h3M24 75h107M138 75h10M2 76h3M14 76h3M25 76h105M139 76h2M148 76h1M3 77h2M13 77h127M4 78h1M18 78h125M20 79h61M116 79h32M19 80h48M119 80h30M21 81h38M123 81h27M15 82h3M23 82h27M125 82h23M11 83h10M23 83h20M126 83h20M10 84h29M128 84h17M2 85h3M12 85h23M129 85h15M149 85h1M0 86h5M7 86h1M13 86h19M130 86h13M147 86h3M0 87h5M7 87h1M14 87h15M131 87h11M146 87h4M0 88h5M7 88h1M15 88h13M132 88h10M143 88h7M0 89h5M7 89h2M15 89h11M136 89h14M0 90h5M7 90h3M15 90h9M141 90h9M0 91h5M7 91h5M15 91h5M147 91h3M0 92h5M131 115h1M130 116h8M130 117h9M141 117h5M130 118h9M141 118h5M149 118h1M0 119h3M129 119h10M141 119h9M0 120h11M129 120h10M141 120h9M0 121h26M129 121h10M141 121h9M0 122h26M128 122h11M141 122h9M0 123h27M128 123h11M141 123h9M0 124h28M128 124h11M141 124h9M0 125h28M128 125h11M141 125h9M0 126h29M128 126h11M141 126h9M0 127h30M128 127h11M141 127h9M0 128h30M128 128h11M141 128h9M0 129h31M128 129h11M141 129h9M0 130h31M128 130h11M141 130h9M0 131h32M128 131h22M0 132h32M128 132h22M0 133h33M128 133h22M0 134h33M128 134h22M0 135h33M129 135h21M0 136h33M129 136h21M0 137h33M129 137h21M0 138h33M130 138h20M0 139h33M130 139h20M0 140h33M131 140h19M0 141h33M131 141h19M0 142h32M131 142h19M0 143h32M132 143h18M0 144h31M132 144h18M7 145h23M133 145h11M14 146h16M16 147h13M97 207h2M106 207h2M113 207h3M85 208h3M94 208h2M101 208h2M104 208h5M110 208h3M116 208h2M137 208h1M0 209h7M19 209h1M49 209h4M54 209h6M62 209h2M65 209h3M71 209h6M80 209h4M88 209h2M93 209h2M102 209h3M109 209h2M117 209h1M120 209h3M132 209h4M138 209h2M145 209h5M0 210h1M6 210h3M17 210h1M20 210h2M27 210h4M32 210h5M48 210h1M53 210h1M63 210h2M69 210h3M80 210h1M89 210h5M103 210h2M115 210h7M125 210h10M139 210h6M149 210h1M8 211h10M21 211h10M35 211h2M42 211h1M48 211h1M58 211h1M64 211h1M67 211h3M114 211h1M129 211h1M134 211h1M142 211h1M8 212h3M15 212h2M22 212h1M29 212h1M43 212h1M46 212h2M58 212h2M113 212h1M142 212h1M46 213h2M57 213h3M59 214h3"
            />
            <path
              stroke="#dbaf6d"
              d="M11 51h3M142 51h1M0 52h3M7 52h7M142 52h2M146 52h4M0 53h14M142 53h8M0 54h14M142 54h8M0 55h14M142 55h8M0 56h14M142 56h8M0 57h14M142 57h8M0 58h14M142 58h8M0 59h14M142 59h8M0 60h14M142 60h8M0 61h14M142 61h8M0 62h14M142 62h8M0 63h14M142 63h8M0 64h14M142 64h8M0 65h14M142 65h8M0 66h14M142 66h8M4 67h10M142 67h8M10 68h4M142 68h6M142 69h2M97 70h36M137 70h5M101 71h32M137 71h1M105 72h28M109 73h24M115 74h14M132 89h4M133 90h8M20 91h3M133 91h14M7 92h5M15 92h7M134 92h16M0 93h5M7 93h14M134 93h16M0 94h5M7 94h13M135 94h15M0 95h5M7 95h13M135 95h15M0 96h5M7 96h12M135 96h8M145 96h5M0 97h5M7 97h12M135 97h6M145 97h5M0 98h5M7 98h11M136 98h5M145 98h5M0 99h5M7 99h11M136 99h4M144 99h6M2 100h3M7 100h11M136 100h4M144 100h1M0 101h5M7 101h11M136 101h3M0 102h5M7 102h11M136 102h3M148 102h2M0 103h5M7 103h11M137 103h2M147 103h3M2 104h3M7 104h11M138 104h1M4 105h15M3 106h16M5 107h14M0 108h2M7 108h12M149 108h1M0 109h5M7 109h12M145 109h5M0 110h20M144 110h6M0 111h20M133 111h1M136 111h3M146 111h4M0 112h20M132 112h7M141 112h1M147 112h3M0 113h21M132 113h7M141 113h1M148 113h2M0 114h22M132 114h7M141 114h1M149 114h1M0 115h23M132 115h7M141 115h2M149 115h1M0 116h23M138 116h1M141 116h3M149 116h1M0 117h23M149 117h1M0 118h24M3 119h22M11 120h14M13 202h28M111 202h32M4 203h59M96 203h53M0 204h150M0 205h150M0 206h150M0 207h97M99 207h7M108 207h5M116 207h34M0 208h85M88 208h6M103 208h1M109 208h1M118 208h19M138 208h12M7 209h12M20 209h29M53 209h1M60 209h2M64 209h1M68 209h3M77 209h3M90 209h3M118 209h2M123 209h9M140 209h5M9 210h8M22 210h5M31 210h1M37 210h11M68 210h1M43 211h5"
            />
            <path
              stroke="#79bd26"
              d="M9 70h1M7 71h3M142 71h2M7 72h2M143 72h4M6 73h2M146 73h3M6 74h1M5 75h2M5 76h1M141 76h7M5 77h1M148 77h1M5 78h1M12 78h6M11 79h2M146 83h1M145 84h2M10 85h2M144 85h2M11 86h2M143 86h2M12 87h2M13 88h2M14 89h1M143 96h1M126 97h2M141 97h3M127 98h4M141 98h2M130 99h3M140 99h2M140 100h1M139 101h2M125 102h7M139 102h1M132 103h1M139 103h1M0 104h2M139 104h1M146 104h4M145 105h2M130 109h1M129 110h2M128 111h2M144 111h2M127 112h2M145 112h2M146 113h2M147 114h2M148 115h1M107 209h2M115 209h2M136 209h2M18 210h2M58 210h5M65 210h3M84 210h2M105 210h1M108 210h2M114 210h1M137 210h2M19 211h2M59 211h2M86 211h1M105 211h2M113 211h1M138 211h3M17 212h1M20 212h2M44 212h2M60 212h1M106 212h1M112 212h1M17 213h1M21 213h1M43 213h2M60 213h2M87 213h1M111 213h1M17 214h1M17 215h1M22 215h4M45 215h1M45 216h1"
            />
            <path
              stroke="#4b7038"
              d="M10 70h1M10 71h1M141 71h1M9 72h2M142 72h1M8 73h2M144 73h2M7 74h3M11 74h7M145 74h5M0 75h1M7 75h4M148 75h2M6 76h3M0 77h1M6 77h3M140 77h8M149 77h1M0 78h2M6 78h2M149 78h1M1 79h2M5 79h2M13 79h7M2 80h2M5 80h1M10 80h9M0 81h2M9 81h2M20 81h1M0 82h2M6 82h1M8 82h1M22 82h1M148 82h2M0 83h2M6 83h1M8 83h1M147 83h3M9 84h1M147 84h1M9 85h1M9 86h2M9 87h3M142 87h1M10 88h3M142 88h1M11 89h3M13 90h2M13 91h2M14 92h1M144 96h1M125 97h1M144 97h1M126 98h1M143 98h2M128 99h2M142 99h2M0 100h2M129 100h5M141 100h3M145 100h5M132 101h3M141 101h4M140 102h3M124 103h8M133 103h2M140 103h3M133 104h3M140 104h2M0 105h4M135 105h2M139 105h2M147 105h3M0 106h3M136 106h2M139 106h1M144 106h6M4 107h1M134 107h2M143 107h2M6 108h1M132 108h4M140 108h1M142 108h1M131 109h5M140 109h1M142 109h1M131 110h1M143 110h1M143 111h1M143 112h2M126 113h1M143 113h3M126 114h1M144 114h3M145 115h3M147 116h2M147 117h2M148 118h1M105 209h2M114 209h1M107 210h1M113 210h1M135 210h1M18 211h1M61 211h1M65 211h2M84 211h2M107 211h2M111 211h2M135 211h2M141 211h1M19 212h1M61 212h2M65 212h1M84 212h1M86 212h1M111 212h1M136 212h1M20 213h1M45 213h1M62 213h1M85 213h1M110 213h1M137 213h1M20 214h2M43 214h1M45 214h1M62 214h1M85 214h1M109 214h2M21 215h1M24 216h2M42 216h1M23 217h2M22 218h2M22 219h1"
            />
            <path
              stroke="#63370b"
              d="M22 70h1M133 70h1M22 71h1M133 71h1M22 72h1M133 72h1M22 73h1M133 73h1M22 74h1M133 74h1M22 75h1M133 75h1"
            />
            <path
              stroke="#244015"
              d="M11 75h5M0 76h2M9 76h5M149 76h1M1 77h2M9 77h4M2 78h2M8 78h4M143 78h6M0 79h1M3 79h2M7 79h4M148 79h2M0 80h2M4 80h1M6 80h4M149 80h1M2 81h7M11 81h9M2 82h4M7 82h1M9 82h6M18 82h4M2 83h3M7 83h1M9 83h2M21 83h2M0 84h4M6 84h3M148 84h2M0 85h2M7 85h2M146 85h3M8 86h1M145 86h2M8 87h1M143 87h3M8 88h2M9 89h2M10 90h3M12 91h1M12 92h2M145 101h5M133 102h3M143 102h5M135 103h2M143 103h4M127 104h6M136 104h2M142 104h4M132 105h3M137 105h2M141 105h4M133 106h3M138 106h1M140 106h4M0 107h4M136 107h7M145 107h5M2 108h4M136 108h4M141 108h1M143 108h6M5 109h2M136 109h3M141 109h1M143 109h2M132 110h6M140 110h3M130 111h3M134 111h2M141 111h2M129 112h2M142 112h1M127 113h3M142 113h1M142 114h2M143 115h2M144 116h3M146 117h1M146 118h2M113 208h3M111 209h3M106 210h1M110 210h3M136 210h1M62 211h2M109 211h2M137 211h1M18 212h1M63 212h2M85 212h1M107 212h4M137 212h5M18 213h2M64 213h2M86 213h1M107 213h3M139 213h3M18 214h2M44 214h1M65 214h1M86 214h2M107 214h2M137 214h1M18 215h3M43 215h2M87 215h1M108 215h2M18 216h1M20 216h4M44 216h1M109 216h1M18 217h1M20 217h3M42 217h1M18 218h1M21 218h1M21 219h1"
            />
            <path
              stroke="#a1855a"
              d="M23 75h1M131 75h2M137 75h1M17 76h8M130 76h9M81 79h35M67 80h52M59 81h64M50 82h75M43 83h83M39 84h89M35 85h94M32 86h98M29 87h102M28 88h104M26 89h85M24 90h78M47 91h50M55 92h34M63 93h20M94 114h24M82 115h49M78 116h52M72 117h58M66 118h64M60 119h69M57 120h72M26 121h103M26 122h102M27 123h101M28 124h100M28 125h100M29 126h99M30 127h98M30 128h98M31 129h97M31 130h97M32 131h96M32 132h96M33 133h95M33 134h95M33 135h96M33 136h96M33 137h96M33 138h97M33 139h97M33 140h98M33 141h98M32 142h99M32 143h100M31 144h101M30 145h34M98 145h35M30 146h26M105 146h29M29 147h17M108 147h17M8 213h1"
            />
            <path
              stroke="#805233"
              d="M5 83h1M4 84h2M5 85h2M5 86h2M5 87h2M5 88h2M5 89h2M5 90h2M5 91h2M5 92h2M5 93h2M5 94h2M5 95h2M5 96h2M5 97h2M5 98h2M5 99h2M5 100h2M5 101h2M5 102h2M5 103h2M5 104h2M139 109h1M138 110h2M139 111h2M139 112h2M139 113h2M139 114h2M139 115h2M139 116h2M139 117h2M139 118h2M139 119h2M139 120h2M139 121h2M139 122h2M139 123h2M139 124h2M139 125h2M139 126h2M139 127h2M139 128h2M139 129h2M139 130h2M63 213h1M138 213h1M63 214h2M138 214h3M86 215h1M107 215h1M19 216h1M43 216h1M107 216h2M19 217h1M43 217h1M108 217h2M19 218h2M19 219h2"
            />
            <path
              stroke="#c79d5f"
              d="M111 89h21M102 90h31M23 91h24M97 91h36M22 92h33M89 92h45M21 93h42M83 93h51M20 94h115M20 95h115M19 96h116M19 97h106M128 97h7M18 98h108M131 98h5M18 99h110M133 99h3M18 100h111M134 100h2M18 101h114M135 101h1M18 102h107M132 102h1M18 103h106M18 104h109M19 105h113M19 106h114M19 107h115M19 108h113M19 109h111M20 110h109M20 111h108M20 112h107M131 112h1M21 113h105M130 113h2M22 114h72M118 114h8M127 114h5M23 115h59M23 116h55M23 117h49M24 118h42M25 119h35M25 120h32"
            />
            <path
              stroke="#6e6860"
              d="M0 145h7M64 145h34M144 145h6M0 146h14M56 146h49M134 146h16M0 147h16M46 147h62M125 147h25M0 148h150M0 149h150M0 150h150M0 151h150M0 152h150M0 153h150M0 154h150M0 155h150M0 156h150M0 157h150M0 158h150M0 159h150M0 160h150M0 161h150M0 162h150M0 163h150M0 164h150M0 165h150M0 166h150M0 167h150M0 168h150M21 169h9M53 169h8M84 169h9M113 169h8M142 169h8M21 170h9M53 170h8M84 170h9M113 170h8M142 170h8M0 171h150M0 172h150M0 173h150M0 174h150M0 175h150M0 176h150M0 177h150M0 178h150M0 179h150M0 180h150M0 181h150M0 182h150M0 183h150M0 184h150M0 185h150M0 186h150M0 187h150M0 188h150M0 189h150M0 190h150M0 191h150M0 192h150M0 193h150M0 194h150M0 195h150M0 196h150M0 197h150M0 198h150M0 199h150M0 200h150M0 201h150M0 202h13M41 202h70M143 202h7M0 203h4M63 203h33M149 203h1"
            />
            <path
              stroke="#c2c2c2"
              d="M0 169h21M30 169h23M61 169h23M93 169h20M121 169h21M0 170h21M30 170h23M61 170h23M93 170h20M121 170h21"
            />
            <path
              stroke="#918e8b"
              d="M96 208h5M84 209h4M95 209h2M101 209h1M1 210h5M49 210h4M54 210h4M72 210h8M81 210h3M87 210h2M94 210h2M102 210h1M122 210h3M145 210h4M0 211h1M5 211h3M31 211h4M37 211h5M49 211h1M52 211h2M57 211h1M70 211h3M79 211h3M88 211h7M102 211h3M115 211h7M124 211h5M130 211h4M143 211h3M149 211h1M7 212h1M11 212h4M23 212h6M30 212h2M34 212h4M41 212h2M48 212h2M53 212h1M56 212h2M66 212h5M79 212h2M89 212h1M94 212h2M102 212h1M104 212h1M114 212h2M120 212h2M125 212h1M128 212h3M134 212h2M143 212h1M149 212h1M7 213h1M14 213h3M22 213h2M28 213h3M34 213h2M42 213h1M48 213h1M52 213h5M70 213h1M79 213h2M88 213h2M96 213h1M101 213h2M104 213h1M112 213h2M121 213h2M124 213h2M129 213h1M135 213h2M142 213h2M148 213h1M7 214h2M15 214h1M30 214h1M34 214h1M46 214h3M52 214h1M56 214h3M70 214h1M79 214h4M88 214h1M96 214h5M104 214h1M112 214h1M122 214h4M128 214h2M136 214h1M143 214h3M7 215h1M15 215h1M30 215h2M34 215h1M47 215h6M58 215h6M71 215h11M83 215h3M88 215h1M96 215h1M99 215h6M112 215h1M121 215h2M125 215h5M136 215h1M138 215h1M145 215h2M7 216h1M14 216h2M30 216h5M48 216h1M51 216h2M59 216h2M64 216h1M70 216h2M76 216h2M81 216h1M88 216h2M95 216h2M100 216h1M103 216h1M105 216h2M112 216h2M119 216h4M126 216h1M129 216h10M145 216h5M0 217h1M7 217h8M29 217h3M33 217h6M41 217h1M44 217h1M46 217h3M51 217h2M59 217h1M64 217h2M69 217h2M77 217h5M89 217h7M97 217h4M103 217h3M113 217h7M122 217h5M130 217h2M138 217h8M149 217h1M0 218h8M12 218h3M17 218h1M28 218h2M31 218h3M38 218h4M44 218h2M47 218h2M52 218h3M58 218h2M64 218h6M80 218h2M99 218h1M110 218h3M130 218h1M145 218h1M0 219h2M8 219h2M14 219h4M24 219h4M34 219h3M47 219h1M54 219h5M60 219h5M81 219h1M99 219h1M112 219h2M129 219h1M146 219h1M0 220h1M9 220h2M22 220h3M36 220h1M47 220h1M65 220h2M81 220h1M98 220h2M113 220h3M129 220h1M146 220h1M1 221h1M10 221h2M21 221h1M37 221h1M46 221h2M66 221h1M82 221h1M98 221h1M115 221h1M129 221h1M146 221h1M149 221h1M11 222h2M20 222h2M37 222h1M45 222h4M66 222h1M82 222h1M98 222h1M115 222h2M129 222h1M146 222h1"
            />
            <path
              stroke="#bdbab6"
              d="M97 209h3M86 210h1M99 210h2M1 211h4M50 211h2M73 211h6M87 211h1M123 211h1M146 211h3M6 212h1M38 212h2M72 212h2M116 212h4M127 212h1M131 212h2M145 212h2M6 213h1M11 213h2M25 213h3M36 213h3M67 213h3M114 213h1M127 213h2M142 214h1M46 215h1M61 216h3M84 216h4M87 217h2M106 217h2M121 217h1M135 217h3M30 218h1M43 218h1M46 218h1M88 218h5M104 218h5M121 218h4M139 218h3M5 219h3M28 219h5M44 219h3M59 219h1M55 220h4"
            />
            <path
              stroke="#a6a09c"
              d="M100 209h1M96 210h3M101 210h1M54 211h3M82 211h2M95 211h7M122 211h1M0 212h6M32 212h2M40 212h1M50 212h3M54 212h2M71 212h1M74 212h5M81 212h3M87 212h2M90 212h4M96 212h6M103 212h1M105 212h1M122 212h3M126 212h1M133 212h1M144 212h1M147 212h2M0 213h6M13 213h1M24 213h1M31 213h3M39 213h3M49 213h3M66 213h1M71 213h8M84 213h1M90 213h6M97 213h2M103 213h1M105 213h2M115 213h6M123 213h1M126 213h1M130 213h5M144 213h4M149 213h1M0 214h7M9 214h6M16 214h1M22 214h8M31 214h3M35 214h8M49 214h3M53 214h3M66 214h4M71 214h8M89 214h7M101 214h3M105 214h2M111 214h1M113 214h9M126 214h2M130 214h5M141 214h1M148 214h2M0 215h7M8 215h7M16 215h1M26 215h4M32 215h2M35 215h8M53 215h5M64 215h7M82 215h1M89 215h5M97 215h2M105 215h2M110 215h2M113 215h5M123 215h2M130 215h1M137 215h1M139 215h6M149 215h1M0 216h6M13 216h1M16 216h2M26 216h4M35 216h1M40 216h2M46 216h2M49 216h2M53 216h6M65 216h4M72 216h4M78 216h3M82 216h2M90 216h2M97 216h3M101 216h2M104 216h1M110 216h2M114 216h1M123 216h3M127 216h2M139 216h3M144 216h1M1 217h1M15 217h3M25 217h3M32 217h1M45 217h1M49 217h2M56 217h3M60 217h4M71 217h6M82 217h5M96 217h1M101 217h2M110 217h3M120 217h1M127 217h3M132 217h3M146 217h3M8 218h4M15 218h2M24 218h1M34 218h4M42 218h1M49 218h3M57 218h1M60 218h3M70 218h10M82 218h6M93 218h6M100 218h4M109 218h1M113 218h8M125 218h5M131 218h8M142 218h3M146 218h4M2 219h3M10 219h4M18 219h1M33 219h1M37 219h7M49 219h5M65 219h16M83 219h14M100 219h12M114 219h15M130 219h16M147 219h3M1 220h8M11 220h11M25 220h11M37 220h10M49 220h6M59 220h6M67 220h14M83 220h14M100 220h13M117 220h12M131 220h15M147 220h3M2 221h8M12 221h9M22 221h14M38 221h8M50 221h16M68 221h14M83 221h14M99 221h15M118 221h11M131 221h14M147 221h2M13 222h7M22 222h1M38 222h7M56 222h10M83 222h2M99 222h8M128 222h1"
            />
            <path stroke="#756b64" d="M9 213h2" />
            <path
              stroke="#858482"
              d="M81 213h3M99 213h2M83 214h2M135 214h1M146 214h2M94 215h2M118 215h3M131 215h5M147 215h2M6 216h1M8 216h5M36 216h4M69 216h1M92 216h3M115 216h4M142 216h2M2 217h5M28 217h1M39 217h2M53 217h3M66 217h3M25 218h3M55 218h2M63 218h1M48 219h1M82 219h1M97 219h2M48 220h1M82 220h1M97 220h1M116 220h1M130 220h1M0 221h1M36 221h1M48 221h2M67 221h1M97 221h1M114 221h1M116 221h2M130 221h1M145 221h1M0 222h11M23 222h14M49 222h7M67 222h15M85 222h13M107 222h8M117 222h11M130 222h16M147 222h3"
            />
            <path stroke="#615c58" d="M23 219h1" />
            <text class="eventInfo" y="8" x="67%">{theater.eventName}</text>
            {#if currentTime.getTime() < new Date(theater.startTime).getTime()}
              <text class="eventInfo" y="20" x="67%">Starts at:</text>
              <text class="eventInfo startTime" y="26" x="67%"
                >{(new Date(theater.startTime).getHours() < 10 ? "0" : "") +
                  new Date(theater.startTime).getHours()}:{(new Date(
                  theater.startTime
                ).getMinutes() < 10
                  ? "0"
                  : "") + new Date(theater.startTime).getMinutes()}</text
              >
            {:else if currentTime.getTime() > new Date(theater.startTime).getTime() && currentTime.getTime() < new Date(theater.timeToClose).getTime() - 900000}
              <text class="eventInfo startTime" y="23" x="67%"
                >Currently showing</text
              >
            {:else if currentTime.getTime() > new Date(theater.timeToClose).getTime() - 900000 && currentTime.getTime() < new Date(theater.timeToClose).getTime()}
              <text class="eventInfo closing" y="23" x="67%">Closing</text>
            {:else}
              <text class="eventInfo closed" y="23" x="67%">Closed</text>
            {/if}
            <text class="eventInfo" y="39" x="67%"
              >Runtime: {theater.movieRuntime} min</text
            >
            <text class="eventInfo" y="52" x="67%"
              >{theater.usersInsideTheater
                .length}/{theater.amountOfSpaces}</text
            >
            <svg
              y="-62"
              x="75%"
              width="8px"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 512"
              ><!--! Font Awesome Pro 6.1.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
                d="M224 256c70.7 0 128-57.31 128-128S294.7 0 224 0C153.3 0 96 57.31 96 128S153.3 256 224 256zM274.7 304H173.3c-95.73 0-173.3 77.6-173.3 173.3C0 496.5 15.52 512 34.66 512H413.3C432.5 512 448 496.5 448 477.3C448 381.6 370.4 304 274.7 304zM479.1 320h-73.85C451.2 357.7 480 414.1 480 477.3C480 490.1 476.2 501.9 470 512h138C625.7 512 640 497.6 640 479.1C640 391.6 568.4 320 479.1 320zM432 256C493.9 256 544 205.9 544 144S493.9 32 432 32c-25.11 0-48.04 8.555-66.72 22.51C376.8 76.63 384 101.4 384 128c0 35.52-11.93 68.14-31.59 94.71C372.7 243.2 400.8 256 432 256z"
              /></svg
            >
            <text class="eventInfo" y="64" x="67%"
              >{theater.passwordBool ? "Private Event" : "Public Event"}</text
            >
            <text
              class="movieTitle {'neoncolor' + Math.floor(Math.random() * 5)}"
              y="78"
              x="52%">{theater.movieNameCutToFit || theater.movieName}</text
            >
            <image href={theater.hrefPoster} height="68" y="0.5" x="10%" />
          </svg>
          {/each}
          {#each Array(highestPosition) as _, index (index)}
          {#if !theaters.some((theater) => theater.position === index)}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -0.5 150 223"
              shape-rendering="crispEdges"
              style="left: {index * 400}px; bottom: 0; width: 401px; position: absolute;"
            >
              <path
                stroke="#331b02"
                d="M14 0h128M14 1h1M141 1h1M14 2h1M141 2h1M14 3h1M141 3h1M14 4h1M141 4h1M14 5h1M141 5h1M14 6h1M141 6h1M14 7h1M141 7h1M14 8h1M141 8h1M14 9h1M141 9h1M14 10h1M141 10h1M14 11h1M141 11h1M14 12h1M141 12h1M14 13h1M141 13h1M14 14h1M141 14h1M14 15h1M141 15h1M14 16h1M141 16h1M14 17h1M141 17h1M14 18h1M141 18h1M14 19h1M141 19h1M14 20h1M141 20h1M14 21h1M141 21h1M14 22h1M141 22h1M14 23h1M141 23h1M14 24h1M141 24h1M14 25h1M141 25h1M14 26h1M141 26h1M14 27h1M141 27h1M14 28h1M141 28h1M14 29h1M141 29h1M14 30h1M141 30h1M14 31h1M141 31h1M14 32h1M141 32h1M14 33h1M141 33h1M14 34h1M141 34h1M14 35h1M141 35h1M14 36h1M141 36h1M14 37h1M141 37h1M14 38h1M141 38h1M14 39h1M141 39h1M14 40h1M141 40h1M14 41h1M141 41h1M14 42h1M141 42h1M14 43h1M141 43h1M14 44h1M141 44h1M14 45h1M141 45h1M14 46h1M141 46h1M14 47h1M141 47h1M14 48h1M141 48h1M14 49h1M141 49h1M14 50h1M141 50h1M14 51h1M141 51h1M14 52h1M141 52h1M14 53h1M141 53h1M14 54h1M141 54h1M14 55h1M141 55h1M14 56h1M141 56h1M14 57h1M141 57h1M14 58h1M141 58h1M14 59h1M141 59h1M14 60h1M141 60h1M14 61h1M141 61h1M14 62h1M141 62h1M14 63h1M141 63h1M14 64h1M141 64h1M14 65h1M141 65h1M14 66h1M141 66h1M14 67h1M141 67h1M14 68h1M141 68h1M14 69h128M19 70h3M134 70h3M19 71h3M134 71h3M19 72h3M134 72h3M19 73h3M134 73h3M19 74h3M134 74h3M19 75h3M134 75h3"
              />
              <path
                stroke="#ffffff"
                d="M15 1h126M15 2h126M15 3h126M15 4h126M15 5h126M15 6h126M15 7h126M15 8h126M15 9h126M15 10h126M15 11h126M15 12h126M15 13h126M15 14h126M15 15h126M15 16h126M15 17h126M15 18h126M15 19h126M15 20h126M15 21h126M15 22h126M15 23h126M15 24h126M15 25h126M15 26h126M15 27h126M15 28h126M15 29h126M15 30h126M15 31h126M15 32h126M15 33h126M15 34h126M15 35h126M15 36h126M15 37h126M15 38h126M15 39h126M15 40h126M15 41h126M15 42h126M15 43h126M15 44h126M15 45h126M15 46h126M15 47h126M15 48h126M15 49h126M15 50h126M15 51h126M15 52h126M15 53h126M15 54h126M15 55h126M15 56h126M15 57h126M15 58h126M15 59h126M15 60h126M15 61h126M15 62h126M15 63h126M15 64h126M15 65h126M15 66h126M15 67h126M15 68h126"
              />
              <path
                stroke="#8f8f8f"
                d="M0 49h1M9 49h5M142 49h3M148 49h2M0 50h11M143 50h7M3 51h3M144 51h2"
              />
              <path
                stroke="#b39464"
                d="M11 50h3M142 50h1M0 51h3M6 51h5M143 51h1M146 51h4M3 52h4M144 52h2M0 67h4M0 68h10M148 68h2M0 69h14M144 69h6M0 70h9M11 70h8M23 70h74M142 70h8M0 71h7M11 71h8M23 71h78M138 71h3M144 71h6M0 72h7M11 72h8M23 72h82M137 72h5M147 72h3M0 73h6M10 73h9M23 73h86M137 73h7M149 73h1M0 74h6M10 74h1M18 74h1M23 74h92M129 74h4M137 74h8M1 75h4M16 75h3M24 75h107M138 75h10M2 76h3M14 76h3M25 76h105M139 76h2M148 76h1M3 77h2M13 77h127M4 78h1M18 78h125M20 79h61M116 79h32M19 80h48M119 80h30M21 81h38M123 81h27M15 82h3M23 82h27M125 82h23M11 83h10M23 83h20M126 83h20M10 84h29M128 84h17M2 85h3M12 85h23M129 85h15M149 85h1M0 86h5M7 86h1M13 86h19M130 86h13M147 86h3M0 87h5M7 87h1M14 87h15M131 87h11M146 87h4M0 88h5M7 88h1M15 88h13M132 88h10M143 88h7M0 89h5M7 89h2M15 89h11M136 89h14M0 90h5M7 90h3M15 90h9M141 90h9M0 91h5M7 91h5M15 91h5M147 91h3M0 92h5M131 115h1M130 116h8M130 117h9M141 117h5M130 118h9M141 118h5M149 118h1M0 119h3M129 119h10M141 119h9M0 120h11M129 120h10M141 120h9M0 121h26M129 121h10M141 121h9M0 122h26M128 122h11M141 122h9M0 123h27M128 123h11M141 123h9M0 124h28M128 124h11M141 124h9M0 125h28M128 125h11M141 125h9M0 126h29M128 126h11M141 126h9M0 127h30M128 127h11M141 127h9M0 128h30M128 128h11M141 128h9M0 129h31M128 129h11M141 129h9M0 130h31M128 130h11M141 130h9M0 131h32M128 131h22M0 132h32M128 132h22M0 133h33M128 133h22M0 134h33M128 134h22M0 135h33M129 135h21M0 136h33M129 136h21M0 137h33M129 137h21M0 138h33M130 138h20M0 139h33M130 139h20M0 140h33M131 140h19M0 141h33M131 141h19M0 142h32M131 142h19M0 143h32M132 143h18M0 144h31M132 144h18M7 145h23M133 145h11M14 146h16M16 147h13M97 207h2M106 207h2M113 207h3M85 208h3M94 208h2M101 208h2M104 208h5M110 208h3M116 208h2M137 208h1M0 209h7M19 209h1M49 209h4M54 209h6M62 209h2M65 209h3M71 209h6M80 209h4M88 209h2M93 209h2M102 209h3M109 209h2M117 209h1M120 209h3M132 209h4M138 209h2M145 209h5M0 210h1M6 210h3M17 210h1M20 210h2M27 210h4M32 210h5M48 210h1M53 210h1M63 210h2M69 210h3M80 210h1M89 210h5M103 210h2M115 210h7M125 210h10M139 210h6M149 210h1M8 211h10M21 211h10M35 211h2M42 211h1M48 211h1M58 211h1M64 211h1M67 211h3M114 211h1M129 211h1M134 211h1M142 211h1M8 212h3M15 212h2M22 212h1M29 212h1M43 212h1M46 212h2M58 212h2M113 212h1M142 212h1M46 213h2M57 213h3M59 214h3"
              />
              <path
                stroke="#dbaf6d"
                d="M11 51h3M142 51h1M0 52h3M7 52h7M142 52h2M146 52h4M0 53h14M142 53h8M0 54h14M142 54h8M0 55h14M142 55h8M0 56h14M142 56h8M0 57h14M142 57h8M0 58h14M142 58h8M0 59h14M142 59h8M0 60h14M142 60h8M0 61h14M142 61h8M0 62h14M142 62h8M0 63h14M142 63h8M0 64h14M142 64h8M0 65h14M142 65h8M0 66h14M142 66h8M4 67h10M142 67h8M10 68h4M142 68h6M142 69h2M97 70h36M137 70h5M101 71h32M137 71h1M105 72h28M109 73h24M115 74h14M132 89h4M133 90h8M20 91h3M133 91h14M7 92h5M15 92h7M134 92h16M0 93h5M7 93h14M134 93h16M0 94h5M7 94h13M135 94h15M0 95h5M7 95h13M135 95h15M0 96h5M7 96h12M135 96h8M145 96h5M0 97h5M7 97h12M135 97h6M145 97h5M0 98h5M7 98h11M136 98h5M145 98h5M0 99h5M7 99h11M136 99h4M144 99h6M2 100h3M7 100h11M136 100h4M144 100h1M0 101h5M7 101h11M136 101h3M0 102h5M7 102h11M136 102h3M148 102h2M0 103h5M7 103h11M137 103h2M147 103h3M2 104h3M7 104h11M138 104h1M4 105h15M3 106h16M5 107h14M0 108h2M7 108h12M149 108h1M0 109h5M7 109h12M145 109h5M0 110h20M144 110h6M0 111h20M133 111h1M136 111h3M146 111h4M0 112h20M132 112h7M141 112h1M147 112h3M0 113h21M132 113h7M141 113h1M148 113h2M0 114h22M132 114h7M141 114h1M149 114h1M0 115h23M132 115h7M141 115h2M149 115h1M0 116h23M138 116h1M141 116h3M149 116h1M0 117h23M149 117h1M0 118h24M3 119h22M11 120h14M13 202h28M111 202h32M4 203h59M96 203h53M0 204h150M0 205h150M0 206h150M0 207h97M99 207h7M108 207h5M116 207h34M0 208h85M88 208h6M103 208h1M109 208h1M118 208h19M138 208h12M7 209h12M20 209h29M53 209h1M60 209h2M64 209h1M68 209h3M77 209h3M90 209h3M118 209h2M123 209h9M140 209h5M9 210h8M22 210h5M31 210h1M37 210h11M68 210h1M43 211h5"
              />
              <path
                stroke="#79bd26"
                d="M9 70h1M7 71h3M142 71h2M7 72h2M143 72h4M6 73h2M146 73h3M6 74h1M5 75h2M5 76h1M141 76h7M5 77h1M148 77h1M5 78h1M12 78h6M11 79h2M146 83h1M145 84h2M10 85h2M144 85h2M11 86h2M143 86h2M12 87h2M13 88h2M14 89h1M143 96h1M126 97h2M141 97h3M127 98h4M141 98h2M130 99h3M140 99h2M140 100h1M139 101h2M125 102h7M139 102h1M132 103h1M139 103h1M0 104h2M139 104h1M146 104h4M145 105h2M130 109h1M129 110h2M128 111h2M144 111h2M127 112h2M145 112h2M146 113h2M147 114h2M148 115h1M107 209h2M115 209h2M136 209h2M18 210h2M58 210h5M65 210h3M84 210h2M105 210h1M108 210h2M114 210h1M137 210h2M19 211h2M59 211h2M86 211h1M105 211h2M113 211h1M138 211h3M17 212h1M20 212h2M44 212h2M60 212h1M106 212h1M112 212h1M17 213h1M21 213h1M43 213h2M60 213h2M87 213h1M111 213h1M17 214h1M17 215h1M22 215h4M45 215h1M45 216h1"
              />
              <path
                stroke="#4b7038"
                d="M10 70h1M10 71h1M141 71h1M9 72h2M142 72h1M8 73h2M144 73h2M7 74h3M11 74h7M145 74h5M0 75h1M7 75h4M148 75h2M6 76h3M0 77h1M6 77h3M140 77h8M149 77h1M0 78h2M6 78h2M149 78h1M1 79h2M5 79h2M13 79h7M2 80h2M5 80h1M10 80h9M0 81h2M9 81h2M20 81h1M0 82h2M6 82h1M8 82h1M22 82h1M148 82h2M0 83h2M6 83h1M8 83h1M147 83h3M9 84h1M147 84h1M9 85h1M9 86h2M9 87h3M142 87h1M10 88h3M142 88h1M11 89h3M13 90h2M13 91h2M14 92h1M144 96h1M125 97h1M144 97h1M126 98h1M143 98h2M128 99h2M142 99h2M0 100h2M129 100h5M141 100h3M145 100h5M132 101h3M141 101h4M140 102h3M124 103h8M133 103h2M140 103h3M133 104h3M140 104h2M0 105h4M135 105h2M139 105h2M147 105h3M0 106h3M136 106h2M139 106h1M144 106h6M4 107h1M134 107h2M143 107h2M6 108h1M132 108h4M140 108h1M142 108h1M131 109h5M140 109h1M142 109h1M131 110h1M143 110h1M143 111h1M143 112h2M126 113h1M143 113h3M126 114h1M144 114h3M145 115h3M147 116h2M147 117h2M148 118h1M105 209h2M114 209h1M107 210h1M113 210h1M135 210h1M18 211h1M61 211h1M65 211h2M84 211h2M107 211h2M111 211h2M135 211h2M141 211h1M19 212h1M61 212h2M65 212h1M84 212h1M86 212h1M111 212h1M136 212h1M20 213h1M45 213h1M62 213h1M85 213h1M110 213h1M137 213h1M20 214h2M43 214h1M45 214h1M62 214h1M85 214h1M109 214h2M21 215h1M24 216h2M42 216h1M23 217h2M22 218h2M22 219h1"
              />
              <path
                stroke="#63370b"
                d="M22 70h1M133 70h1M22 71h1M133 71h1M22 72h1M133 72h1M22 73h1M133 73h1M22 74h1M133 74h1M22 75h1M133 75h1"
              />
              <path
                stroke="#244015"
                d="M11 75h5M0 76h2M9 76h5M149 76h1M1 77h2M9 77h4M2 78h2M8 78h4M143 78h6M0 79h1M3 79h2M7 79h4M148 79h2M0 80h2M4 80h1M6 80h4M149 80h1M2 81h7M11 81h9M2 82h4M7 82h1M9 82h6M18 82h4M2 83h3M7 83h1M9 83h2M21 83h2M0 84h4M6 84h3M148 84h2M0 85h2M7 85h2M146 85h3M8 86h1M145 86h2M8 87h1M143 87h3M8 88h2M9 89h2M10 90h3M12 91h1M12 92h2M145 101h5M133 102h3M143 102h5M135 103h2M143 103h4M127 104h6M136 104h2M142 104h4M132 105h3M137 105h2M141 105h4M133 106h3M138 106h1M140 106h4M0 107h4M136 107h7M145 107h5M2 108h4M136 108h4M141 108h1M143 108h6M5 109h2M136 109h3M141 109h1M143 109h2M132 110h6M140 110h3M130 111h3M134 111h2M141 111h2M129 112h2M142 112h1M127 113h3M142 113h1M142 114h2M143 115h2M144 116h3M146 117h1M146 118h2M113 208h3M111 209h3M106 210h1M110 210h3M136 210h1M62 211h2M109 211h2M137 211h1M18 212h1M63 212h2M85 212h1M107 212h4M137 212h5M18 213h2M64 213h2M86 213h1M107 213h3M139 213h3M18 214h2M44 214h1M65 214h1M86 214h2M107 214h2M137 214h1M18 215h3M43 215h2M87 215h1M108 215h2M18 216h1M20 216h4M44 216h1M109 216h1M18 217h1M20 217h3M42 217h1M18 218h1M21 218h1M21 219h1"
              />
              <path
                stroke="#a1855a"
                d="M23 75h1M131 75h2M137 75h1M17 76h8M130 76h9M81 79h35M67 80h52M59 81h64M50 82h75M43 83h83M39 84h89M35 85h94M32 86h98M29 87h102M28 88h104M26 89h85M24 90h78M47 91h50M55 92h34M63 93h20M94 114h24M82 115h49M78 116h52M72 117h58M66 118h64M60 119h69M57 120h72M26 121h103M26 122h102M27 123h101M28 124h100M28 125h100M29 126h99M30 127h98M30 128h98M31 129h97M31 130h97M32 131h96M32 132h96M33 133h95M33 134h95M33 135h96M33 136h96M33 137h96M33 138h97M33 139h97M33 140h98M33 141h98M32 142h99M32 143h100M31 144h101M30 145h34M98 145h35M30 146h26M105 146h29M29 147h17M108 147h17M8 213h1"
              />
              <path
                stroke="#805233"
                d="M5 83h1M4 84h2M5 85h2M5 86h2M5 87h2M5 88h2M5 89h2M5 90h2M5 91h2M5 92h2M5 93h2M5 94h2M5 95h2M5 96h2M5 97h2M5 98h2M5 99h2M5 100h2M5 101h2M5 102h2M5 103h2M5 104h2M139 109h1M138 110h2M139 111h2M139 112h2M139 113h2M139 114h2M139 115h2M139 116h2M139 117h2M139 118h2M139 119h2M139 120h2M139 121h2M139 122h2M139 123h2M139 124h2M139 125h2M139 126h2M139 127h2M139 128h2M139 129h2M139 130h2M63 213h1M138 213h1M63 214h2M138 214h3M86 215h1M107 215h1M19 216h1M43 216h1M107 216h2M19 217h1M43 217h1M108 217h2M19 218h2M19 219h2"
              />
              <path
                stroke="#c79d5f"
                d="M111 89h21M102 90h31M23 91h24M97 91h36M22 92h33M89 92h45M21 93h42M83 93h51M20 94h115M20 95h115M19 96h116M19 97h106M128 97h7M18 98h108M131 98h5M18 99h110M133 99h3M18 100h111M134 100h2M18 101h114M135 101h1M18 102h107M132 102h1M18 103h106M18 104h109M19 105h113M19 106h114M19 107h115M19 108h113M19 109h111M20 110h109M20 111h108M20 112h107M131 112h1M21 113h105M130 113h2M22 114h72M118 114h8M127 114h5M23 115h59M23 116h55M23 117h49M24 118h42M25 119h35M25 120h32"
              />
              <path
                stroke="#6e6860"
                d="M0 145h7M64 145h34M144 145h6M0 146h14M56 146h49M134 146h16M0 147h16M46 147h62M125 147h25M0 148h150M0 149h150M0 150h150M0 151h150M0 152h150M0 153h150M0 154h150M0 155h150M0 156h150M0 157h150M0 158h150M0 159h150M0 160h150M0 161h150M0 162h150M0 163h150M0 164h150M0 165h150M0 166h150M0 167h150M0 168h150M21 169h9M53 169h8M84 169h9M113 169h8M142 169h8M21 170h9M53 170h8M84 170h9M113 170h8M142 170h8M0 171h150M0 172h150M0 173h150M0 174h150M0 175h150M0 176h150M0 177h150M0 178h150M0 179h150M0 180h150M0 181h150M0 182h150M0 183h150M0 184h150M0 185h150M0 186h150M0 187h150M0 188h150M0 189h150M0 190h150M0 191h150M0 192h150M0 193h150M0 194h150M0 195h150M0 196h150M0 197h150M0 198h150M0 199h150M0 200h150M0 201h150M0 202h13M41 202h70M143 202h7M0 203h4M63 203h33M149 203h1"
              />
              <path
                stroke="#c2c2c2"
                d="M0 169h21M30 169h23M61 169h23M93 169h20M121 169h21M0 170h21M30 170h23M61 170h23M93 170h20M121 170h21"
              />
              <path
                stroke="#918e8b"
                d="M96 208h5M84 209h4M95 209h2M101 209h1M1 210h5M49 210h4M54 210h4M72 210h8M81 210h3M87 210h2M94 210h2M102 210h1M122 210h3M145 210h4M0 211h1M5 211h3M31 211h4M37 211h5M49 211h1M52 211h2M57 211h1M70 211h3M79 211h3M88 211h7M102 211h3M115 211h7M124 211h5M130 211h4M143 211h3M149 211h1M7 212h1M11 212h4M23 212h6M30 212h2M34 212h4M41 212h2M48 212h2M53 212h1M56 212h2M66 212h5M79 212h2M89 212h1M94 212h2M102 212h1M104 212h1M114 212h2M120 212h2M125 212h1M128 212h3M134 212h2M143 212h1M149 212h1M7 213h1M14 213h3M22 213h2M28 213h3M34 213h2M42 213h1M48 213h1M52 213h5M70 213h1M79 213h2M88 213h2M96 213h1M101 213h2M104 213h1M112 213h2M121 213h2M124 213h2M129 213h1M135 213h2M142 213h2M148 213h1M7 214h2M15 214h1M30 214h1M34 214h1M46 214h3M52 214h1M56 214h3M70 214h1M79 214h4M88 214h1M96 214h5M104 214h1M112 214h1M122 214h4M128 214h2M136 214h1M143 214h3M7 215h1M15 215h1M30 215h2M34 215h1M47 215h6M58 215h6M71 215h11M83 215h3M88 215h1M96 215h1M99 215h6M112 215h1M121 215h2M125 215h5M136 215h1M138 215h1M145 215h2M7 216h1M14 216h2M30 216h5M48 216h1M51 216h2M59 216h2M64 216h1M70 216h2M76 216h2M81 216h1M88 216h2M95 216h2M100 216h1M103 216h1M105 216h2M112 216h2M119 216h4M126 216h1M129 216h10M145 216h5M0 217h1M7 217h8M29 217h3M33 217h6M41 217h1M44 217h1M46 217h3M51 217h2M59 217h1M64 217h2M69 217h2M77 217h5M89 217h7M97 217h4M103 217h3M113 217h7M122 217h5M130 217h2M138 217h8M149 217h1M0 218h8M12 218h3M17 218h1M28 218h2M31 218h3M38 218h4M44 218h2M47 218h2M52 218h3M58 218h2M64 218h6M80 218h2M99 218h1M110 218h3M130 218h1M145 218h1M0 219h2M8 219h2M14 219h4M24 219h4M34 219h3M47 219h1M54 219h5M60 219h5M81 219h1M99 219h1M112 219h2M129 219h1M146 219h1M0 220h1M9 220h2M22 220h3M36 220h1M47 220h1M65 220h2M81 220h1M98 220h2M113 220h3M129 220h1M146 220h1M1 221h1M10 221h2M21 221h1M37 221h1M46 221h2M66 221h1M82 221h1M98 221h1M115 221h1M129 221h1M146 221h1M149 221h1M11 222h2M20 222h2M37 222h1M45 222h4M66 222h1M82 222h1M98 222h1M115 222h2M129 222h1M146 222h1"
              />
              <path
                stroke="#bdbab6"
                d="M97 209h3M86 210h1M99 210h2M1 211h4M50 211h2M73 211h6M87 211h1M123 211h1M146 211h3M6 212h1M38 212h2M72 212h2M116 212h4M127 212h1M131 212h2M145 212h2M6 213h1M11 213h2M25 213h3M36 213h3M67 213h3M114 213h1M127 213h2M142 214h1M46 215h1M61 216h3M84 216h4M87 217h2M106 217h2M121 217h1M135 217h3M30 218h1M43 218h1M46 218h1M88 218h5M104 218h5M121 218h4M139 218h3M5 219h3M28 219h5M44 219h3M59 219h1M55 220h4"
              />
              <path
                stroke="#a6a09c"
                d="M100 209h1M96 210h3M101 210h1M54 211h3M82 211h2M95 211h7M122 211h1M0 212h6M32 212h2M40 212h1M50 212h3M54 212h2M71 212h1M74 212h5M81 212h3M87 212h2M90 212h4M96 212h6M103 212h1M105 212h1M122 212h3M126 212h1M133 212h1M144 212h1M147 212h2M0 213h6M13 213h1M24 213h1M31 213h3M39 213h3M49 213h3M66 213h1M71 213h8M84 213h1M90 213h6M97 213h2M103 213h1M105 213h2M115 213h6M123 213h1M126 213h1M130 213h5M144 213h4M149 213h1M0 214h7M9 214h6M16 214h1M22 214h8M31 214h3M35 214h8M49 214h3M53 214h3M66 214h4M71 214h8M89 214h7M101 214h3M105 214h2M111 214h1M113 214h9M126 214h2M130 214h5M141 214h1M148 214h2M0 215h7M8 215h7M16 215h1M26 215h4M32 215h2M35 215h8M53 215h5M64 215h7M82 215h1M89 215h5M97 215h2M105 215h2M110 215h2M113 215h5M123 215h2M130 215h1M137 215h1M139 215h6M149 215h1M0 216h6M13 216h1M16 216h2M26 216h4M35 216h1M40 216h2M46 216h2M49 216h2M53 216h6M65 216h4M72 216h4M78 216h3M82 216h2M90 216h2M97 216h3M101 216h2M104 216h1M110 216h2M114 216h1M123 216h3M127 216h2M139 216h3M144 216h1M1 217h1M15 217h3M25 217h3M32 217h1M45 217h1M49 217h2M56 217h3M60 217h4M71 217h6M82 217h5M96 217h1M101 217h2M110 217h3M120 217h1M127 217h3M132 217h3M146 217h3M8 218h4M15 218h2M24 218h1M34 218h4M42 218h1M49 218h3M57 218h1M60 218h3M70 218h10M82 218h6M93 218h6M100 218h4M109 218h1M113 218h8M125 218h5M131 218h8M142 218h3M146 218h4M2 219h3M10 219h4M18 219h1M33 219h1M37 219h7M49 219h5M65 219h16M83 219h14M100 219h12M114 219h15M130 219h16M147 219h3M1 220h8M11 220h11M25 220h11M37 220h10M49 220h6M59 220h6M67 220h14M83 220h14M100 220h13M117 220h12M131 220h15M147 220h3M2 221h8M12 221h9M22 221h14M38 221h8M50 221h16M68 221h14M83 221h14M99 221h15M118 221h11M131 221h14M147 221h2M13 222h7M22 222h1M38 222h7M56 222h10M83 222h2M99 222h8M128 222h1"
              />
              <path stroke="#756b64" d="M9 213h2" />
              <path
                stroke="#858482"
                d="M81 213h3M99 213h2M83 214h2M135 214h1M146 214h2M94 215h2M118 215h3M131 215h5M147 215h2M6 216h1M8 216h5M36 216h4M69 216h1M92 216h3M115 216h4M142 216h2M2 217h5M28 217h1M39 217h2M53 217h3M66 217h3M25 218h3M55 218h2M63 218h1M48 219h1M82 219h1M97 219h2M48 220h1M82 220h1M97 220h1M116 220h1M130 220h1M0 221h1M36 221h1M48 221h2M67 221h1M97 221h1M114 221h1M116 221h2M130 221h1M145 221h1M0 222h11M23 222h14M49 222h7M67 222h15M85 222h13M107 222h8M117 222h11M130 222h16M147 222h3"
              />
              <path stroke="#615c58" d="M23 219h1" />
              <text
                class="movieTitle {'neoncolor' + Math.floor(Math.random() * 5)}"
                y="78"
                x="52%">Empty</text
              >
            </svg>
          {/if}
          {/each}
          <svg
            class="streetSign"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 -0.5 28 17"
            shape-rendering="crispEdges"
          >
          <path
            stroke="#163d1d"
            d="M1 0h23M0 1h1M24 1h1M0 2h1M25 2h1M0 3h1M26 3h1M0 4h1M27 4h1M0 5h1M26 5h1M0 6h1M25 6h1M0 7h1M24 7h1M0 8h24"
          />
          <path
            stroke="#25592e"
            d="M1 1h2M5 1h19M1 2h1M3 2h22M1 3h1M3 3h2M6 3h2M9 3h1M11 3h1M13 3h2M17 3h2M21 3h5M1 4h1M4 4h1M6 4h5M12 4h3M16 4h1M18 4h1M20 4h1M22 4h5M1 5h1M3 5h2M6 5h2M9 5h2M12 5h3M16 5h1M18 5h1M21 5h5M1 6h1M3 6h3M7 6h1M9 6h1M11 6h1M13 6h2M17 6h2M20 6h1M22 6h3M1 7h23"
          />
          <path
            stroke="#f7f5ed"
            d="M3 1h2M2 2h1M2 3h1M5 3h1M8 3h1M10 3h1M12 3h1M15 3h2M19 3h2M2 4h2M5 4h1M11 4h1M15 4h1M17 4h1M19 4h1M21 4h1M2 5h1M5 5h1M8 5h1M11 5h1M15 5h1M17 5h1M19 5h2M2 6h1M6 6h1M8 6h1M10 6h1M12 6h1M15 6h2M19 6h1M21 6h1"
          />
          <path
            stroke="#4d4d4d"
            d="M4 9h1M19 9h1M4 10h1M19 10h1M4 11h1M19 11h1M4 12h1M19 12h1M4 13h1M19 13h1M4 14h1M19 14h1M4 15h1M19 15h1"
          />
          <path
            stroke="#5c585c"
            d="M5 9h1M20 9h1M5 10h1M20 10h1M5 11h1M20 11h1M5 12h1M20 12h1M5 13h1M20 13h1M5 14h1M20 14h1M5 15h1M20 15h1"
          />
          <path stroke="#a1855a" d="M18 15h1M2 16h5M17 16h5" />
          </svg>
        </div>
        <div class="playerLayer">
          <div
            class="playerCar"
            style="transform: translate3d({playerCoords.x}px, {playerCoords.y}px, 0);"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -0.5 48 18"
              shape-rendering="crispEdges"
              preserveAspectRatio="xMaxYMax meet"
              transform={playerDirection === false ? "scale(-1, 1)" : ""}
            >
              <text
                class="carName"
                transform={playerDirection === false ? "scale(-1, 1)" : ""}
                transform-origin={playerDirection === false ? "50% 50%" : ""}
                font-size="10px"
                font-weight="bold">{playerName}</text
              >
              <path
                stroke="#000000"
                d="M22 0h2M21 1h1M23 1h1M20 2h1M22 2h1M19 3h1M21 3h1M18 4h1M20 4h1M27 4h2M34 4h4M17 5h1M19 5h1M26 5h1M28 5h1M33 5h1M35 5h1M38 5h3M9 6h8M18 6h17M41 6h6M4 7h5M17 7h1M30 7h1M46 7h1M2 8h2M17 8h1M27 8h2M31 8h1M46 8h1M1 9h1M16 9h1M31 9h1M46 9h1M0 10h1M7 10h4M16 10h1M30 10h1M35 10h4M47 10h1M0 11h1M6 11h1M11 11h1M16 11h1M30 11h1M34 11h1M39 11h1M47 11h1M0 12h3M5 12h1M12 12h1M16 12h1M29 12h1M33 12h1M40 12h1M44 12h4M0 13h1M3 13h3M12 13h22M40 13h4M47 13h1M1 14h1M5 14h1M12 14h1M33 14h1M40 14h1M45 14h2M2 15h4M12 15h22M40 15h5M6 16h1M11 16h1M34 16h1M39 16h1M7 17h4M35 17h4"
              />
          <path
            stroke={$user.playerColor}
            d="M22 1h1M21 2h1M20 3h1M19 4h1M18 5h1M36 5h2M17 6h1M35 6h6M9 7h8M18 7h12M31 7h15M4 8h13M18 8h9M29 8h2M32 8h14M2 9h14M17 9h14M32 9h14M1 10h6M11 10h5M17 10h13M31 10h4M39 10h8M1 11h5M12 11h4M17 11h13M31 11h3M40 11h7M3 12h2M13 12h3M17 12h12M30 12h3M41 12h3M1 13h2M44 13h3M2 14h3M13 14h20M41 14h4"
          />
          <path stroke="#613c0c" d="M27 5h1M34 5h1" />
          <path
            stroke="#333333"
            d="M7 11h4M35 11h4M6 12h2M10 12h2M34 12h2M38 12h2M6 13h1M11 13h1M34 13h1M39 13h1M6 14h1M11 14h1M34 14h1M39 14h1M6 15h2M10 15h2M34 15h2M38 15h2M7 16h4M35 16h4"
          />
          <path
            stroke="#7a7a7a"
            d="M8 12h2M36 12h2M7 13h1M10 13h1M35 13h1M38 13h1M7 14h1M10 14h1M35 14h1M38 14h1M8 15h2M36 15h2"
          />
          <path stroke="#ababab" d="M8 13h2M36 13h2M8 14h2M36 14h2" />
            </svg>
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
        on:change={changeColor}
      />
      <button class="menuButton" id="logoutButton" on:click={logout}>
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
      <button class="menuButton" id="addTheaterButton" on:click={createEvent}
        >Create Event</button
      >
      <button
        class="menuButton"
        id="addSomethingElseButton"
        on:click={aboutPage}>About</button
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
    width: 1500px;
    height: var(--stage-height);
    display: grid;
    place-items: center;
  }
  .loadingBars {
    width: 200px;
    height: 80px;
  }
  .closed {
    fill: red;
  }
  .closing {
    fill: #e69f12;
  }
  .startTime {
    fill: green;
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
    width: 1000px;
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
    min-width: 1500px;
    max-width: 1500px;
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    height: var(--stage-height);
  }
  .backgroundimg {
    height: 350px;
    width: 1000px;
    position: absolute;
  }
  .waterExtension {
    position: absolute;
    top: 350px;
    bottom: 0;
    width: 1000px;
    background: #177aeb url("/water-tile.svg") top left / 1000px 160px repeat-y;
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
    width: 1000px;
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
  .remoteCar svg,
  .playerCar svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .remoteCar {
    z-index: 1000;
    transition: transform 70ms linear;
  }
  .playerCar {
    z-index: 1001;
  }
  .carName {
    alignment-baseline: after-edge;
    user-select: none;
    font-family: sans-serif;
  }
  .streetSign {
    width: 80px;
    position: absolute;
    left: 15px;
    top: 530px;
  }
  .eventInfo {
    text-anchor: middle;
    font-size: 4px;
  }
  .movieTitle {
    fill: rgb(222, 255, 251);
    font-size: 8px;
    font-family: "Monoton", cursive;
    user-select: none;
    text-anchor: middle;
  }
  .neoncolor0 {
    text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px #fff,
      0 0 40px rgb(38, 0, 255), 0 0 80px rgb(38, 0, 255),
      0 0 90px rgb(38, 0, 255), 0 0 100px rgb(38, 0, 255),
      0 0 150px rgb(38, 0, 255);
  }
  .neoncolor1 {
    text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px #fff,
      0 0 40px rgb(30, 255, 0), 0 0 80px rgb(30, 255, 0),
      0 0 90px rgb(30, 255, 0), 0 0 100px rgb(30, 255, 0),
      0 0 150px rgb(30, 255, 0);
  }
  .neoncolor2 {
    text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px #fff, 0 0 40px #0ff,
      0 0 80px #0ff, 0 0 90px #0ff, 0 0 100px #0ff, 0 0 150px #0ff;
  }
  .neoncolor3 {
    text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px #fff,
      0 0 40px rgb(255, 0, 234), 0 0 80px rgb(255, 0, 234),
      0 0 90px rgb(255, 0, 234), 0 0 100px rgb(255, 0, 234),
      0 0 150px rgb(255, 0, 234);
  }
  .neoncolor4 {
    text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px #fff,
      0 0 40px rgb(255, 115, 0), 0 0 80px rgb(255, 115, 0),
      0 0 90px rgb(255, 115, 0), 0 0 100px rgb(255, 115, 0),
      0 0 150px rgb(255, 115, 0);
  }
</style>

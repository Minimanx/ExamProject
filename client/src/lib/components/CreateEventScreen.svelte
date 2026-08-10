<script>
    import { success, error } from "./toasts/toastThemes.js";
    import { Pulse } from "svelte-loading-spinners";
    import { playerMovement } from "../stores/stateManagementStore.js";
    import { apiFetch, createSocket } from "../services/api.js";

    // Two-way: InteractiveSpace binds this and back() writes to it to close.
    let { createEventBool = $bindable() } = $props();

    const socket = createSocket();

    let eventName = $state("");
    let searchMovieName = $state("");
    let passwordBool = $state(false);
    let password = $state("");
    let amountOfSpaces = $state();
    let startTime = $state();
    let chosenMovieID = $state("");
    // Debounce handle only — never read in the template, so it stays a plain
    // let rather than costing a needless re-render.
    let timeoutID;
    let loadingMovieSearch = $state(false);
    let movies = $state([]);

    function searchMovie() {
        clearTimeout(timeoutID);
        const query = searchMovieName.trim();
        movies = [];

        if (!query) {
            loadingMovieSearch = false;
            return;
        }

        loadingMovieSearch = true;
        timeoutID = setTimeout(async () => {
            try {
                const response = await apiFetch(`/movies?s=${encodeURIComponent(query)}`);
                const result = await response.json();

                // Any failure, not just 400: the API answers 401 for a missing or bad
                // session, 403 for a forbidden action, 404, 502 for an upstream. Only
                // checking 400 meant those showed the user nothing at all.
                if (!response.ok) {
                    error(result.message || "Movie search is temporarily unavailable");
                    return;
                }
                if (result.data && result.data.Response === "False") {
                    error(result.data.Error || "No movies found");
                    return;
                }
                if (!result.data || !Array.isArray(result.data.Search)) {
                    error("Movie search returned an invalid response");
                    return;
                }

                movies = result.data.Search;
            } catch {
                error("Movie search is temporarily unavailable");
            } finally {
                loadingMovieSearch = false;
            }
        }, 2000);
    }

    async function createEvent() {
        const response = await apiFetch("/theaters", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                data: {
                    eventName: eventName,
                    imdbID: chosenMovieID,
                    passwordBool: passwordBool,
                    password: password,
                    amountOfSpaces: amountOfSpaces,
                    startTime: new Date(new Date().toDateString() + " " + startTime),
                },
            }),
        });
        const result = await response.json();

        if (!response.ok) {
            error(result.message);
        }
        if (response.ok) {
            success(result.message);
            socket.emit("theaterAdded");
            back();
        }
    }

    function back() {
        createEventBool = false;
    }
</script>

<div class="container">
    <div>
        <label for="eventName">Event name</label>
        <input
            name="eventName"
            type="text"
            bind:value={eventName}
            onfocus={() => ($playerMovement = false)}
            onblur={() => ($playerMovement = true)}
            maxlength="18"
            placeholder="Max 18 chars..."
        />
    </div>

    <div>
        <label for="searchMovie">Search for a movie</label>
        <input
            name="searchMovie"
            type="text"
            bind:value={searchMovieName}
            onchange={searchMovie}
            onfocus={() => ($playerMovement = false)}
            onblur={() => ($playerMovement = true)}
            placeholder="Type movie here..."
        />
    </div>

    <div class="movieSearchContainer">
        {#if loadingMovieSearch}
            <div id="loadingSpinner">
                <Pulse size="80" color="aqua" unit="px" duration="1s" />
            </div>
        {/if}
        {#each movies as movie (movie.imdbID)}
            <ul
                onclick={() => (chosenMovieID = movie.imdbID)}
                class={movie.imdbID === chosenMovieID ? "selectedMovie" : ""}
            >
                <li id="imageItem">
                    <img
                        src={movie.Poster !== "N/A"
                            ? movie.Poster
                            : "https://www.tradeinn.com/f/13772/137720122/jibbitz-question-mark.jpg"}
                        alt="poster"
                    />
                </li>
                <li>
                    {movie.Title}
                </li>
                <li></li>
            </ul>
        {/each}
    </div>

    <div class="inputContainer">
        <label for="startTime">Time of start</label>
        <input name="startTime" type="time" bind:value={startTime} />
    </div>

    <div class="inputContainer">
        <label for="amountOfSpaces">Amount of spaces</label>
        <input
            id="amountOfSpaceInput"
            name="amountOfSpaces"
            type="number"
            bind:value={amountOfSpaces}
            max="99"
            min="1"
            placeholder="#"
        />
    </div>

    <div class="passwordInputs">
        {#if passwordBool}
            <input
                name="password"
                type="password"
                bind:value={password}
                onfocus={() => ($playerMovement = false)}
                onblur={() => ($playerMovement = true)}
                maxlength="24"
                placeholder="Type password here..."
            />
        {:else}
            <label for="searchMovie">Private event?</label>
        {/if}
        <input
            id="passwordCheckbox"
            name="searchMovie"
            type="checkbox"
            bind:checked={passwordBool}
        />
    </div>

    <button class="menuButton" id="addTheaterButton" onclick={createEvent}>Create Event</button>
    <button class="menuButton" id="backButton" onclick={back}>Back</button>
</div>

<style>
    #loadingSpinner {
        margin: auto;
    }
    .inputContainer {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        align-items: center;
        width: 100%;
    }
    #amountOfSpaceInput {
        width: 80px;
    }
    img {
        height: 100%;
        width: 65px;
    }
    #imageItem {
        height: 100%;
    }
    #passwordCheckbox {
        width: 20px;
        height: 20px;
    }
    .passwordInputs {
        display: flex;
        width: 100%;
        flex-direction: row;
        justify-content: space-evenly;
        align-items: center;
    }
    .movieSearchContainer {
        display: flex;
        flex-direction: column;
        width: 497px;
        align-items: center;
        overflow-y: auto;
        height: 250px;
        background-color: rgb(228 228 228);
    }
    .selectedMovie {
        background-color: aqua;
    }
    ul {
        width: 100%;
        margin: 0;
        text-align: center;
        display: flex;
        list-style-type: none;
        padding: 0;
        justify-content: space-between;
        align-items: center;
        height: 90px;
    }
    ul:hover {
        background-color: aquamarine;
        cursor: pointer;
    }
    ul:active {
        background-color: aqua;
    }
    .container {
        position: fixed;
        background-color: rgb(241, 241, 241);
        z-index: 100;
        right: 0;
        top: 80px;
        height: calc(var(--stage-height) - 80px);
        width: 500px;
        border-top: 3px solid rgb(27, 27, 27);
        border-left: 3px solid rgb(27, 27, 27);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        justify-content: space-around;
        padding-bottom: 80px;
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
    #backButton {
        font-size: 20px;
        right: 10px;
        bottom: 0px;
        height: 60px;
        width: 235px;
    }
    label {
        line-height: 1.5;
    }
    input {
        margin: 0;
    }

    input::placeholder {
        font-size: 0.7em;
    }
</style>

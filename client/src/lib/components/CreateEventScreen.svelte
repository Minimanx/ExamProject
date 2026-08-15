<script>
    import Panel from "./Panel.svelte";
    import { onDestroy } from "svelte";
    import { success, error } from "./toasts/toastThemes.js";
    import { Pulse } from "svelte-loading-spinners";
    import { playerMovement } from "../stores/stateManagementStore.js";
    import { apiFetch, createSocket } from "../services/api.js";

    // Two-way: InteractiveSpace binds this and back() writes to it to close.
    let { createEventBool = $bindable() } = $props();

    const socket = createSocket();

    let eventName = $state("");
    let searchMovieName = $state("");
    let isPrivate = $state(false);
    // Handed back once, on creation. Nothing can read it out of a listing, so
    // this is the only chance the host gets to copy it.
    let inviteLink = $state("");
    let amountOfSpaces = $state();
    let startTime = $state();
    let chosenMovieID = $state("");
    // Debounce handle only — never read in the template, so it stays a plain
    // let rather than costing a needless re-render.
    let timeoutID;

    // The movie search is debounced, so closing the panel mid-keystroke leaves a
    // request queued against a component that will not be here to receive it.
    onDestroy(() => clearTimeout(timeoutID));
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
                    private: isPrivate,
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

            // A private event stays on screen until the host has the link,
            // because closing the form is the last moment the key exists
            // anywhere they can see it.
            if (result.lobbyKey) {
                // Lands in the world with the key attached rather than at the
                // theater page directly: joining happens by driving up to the
                // lobby, so the link has to name which theater the key is for.
                inviteLink = `${window.location.origin}/?theater=${result.theaterId}&key=${result.lobbyKey}`;
                return;
            }
            back();
        }
    }

    function back() {
        createEventBool = false;
    }
</script>

<Panel onBack={back} backLabel={inviteLink ? "Done" : "Back"}>
    <div class="form">
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
            <label for="privateEvent">Private event?</label>
            <input
                id="passwordCheckbox"
                name="privateEvent"
                type="checkbox"
                bind:checked={isPrivate}
            />
        </div>

        {#if inviteLink}
            <div class="inviteLink">
                <label for="inviteLinkInput">Share this link — it is not shown again</label>
                <input id="inviteLinkInput" name="inviteLink" readonly value={inviteLink} />
            </div>
        {:else}
            <button class="menuButton" id="submitEventButton" onclick={createEvent}
                >Create Event</button
            >
        {/if}
    </div>
</Panel>

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
    .inviteLink {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 4px 0;
    }

    .inviteLink input {
        font-family: inherit;
        font-size: 12px;
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
    /* The panel owns the frame; this is how the form sits in it — centred and
       spread down the column, as it was when this screen carried its own copy. */
    .form {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-around;
        text-align: center;
        padding: 0 12px;
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
    /* Its own id. The button in the scene that opens this form also carried
       "addTheaterButton", so while the form was open two elements shared one id
       — which breaks getElementById, label association and assistive
       navigation, and forced tests into contortions to say which one they
       meant. */
    #submitEventButton {
        font-size: 20px;
        right: 253px;
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

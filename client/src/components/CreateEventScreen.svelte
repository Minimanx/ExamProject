<script>
    import { success, error } from "./toasts/toastThemes.js";
    import { Pulse } from 'svelte-loading-spinners'
    import { playerMovement } from "../stores/stateManagementStore.js";
    import io from "socket.io-client";

    export let createEventBool;

    const socket = io();

    let eventName = "";
    let searchMovieName = "";
    let passwordBool = false;
    let password = "";
    let amountOfSpaces;
    let startTime;
    let chosenMovieID = "";
    let timeoutID;
    let loadingMovieSearch = false;
    let movies = [];

    function searchMovie() {
        clearTimeout(timeoutID)
        loadingMovieSearch = true;
        timeoutID = setTimeout(async () => {
            const response = await fetch(`/movies?s=${searchMovieName}`);
            const result = await response.json();
            loadingMovieSearch = false;
            if(result.data.Response === "False") {
                error(result.data.Error);
            } else {
                movies = result.data.Search;
            }
        }, 2000);
    }

    async function createEvent() {
		const response = await fetch("/theaters", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ 
                data: { 
                    eventName: eventName,
                    imdbID: chosenMovieID,
                    passwordBool: passwordBool,
                    password: password,
                    amountOfSpaces: amountOfSpaces,
                    startTime: startTime
                }
            }),
		});
        const result = await response.json();

        if(response.status === 400) {
            error(result.message);
        }
        if(response.status === 200) {
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
        <input name="eventName" type="text" bind:value={eventName} on:focus={() => $playerMovement = false} on:blur={() => $playerMovement = true} maxlength="18" placeholder="Max 18 chars...">
    </div>
    
    <div>
        <label for="searchMovie">Search for a movie</label>
        <input name="searchMovie" type="text" bind:value={searchMovieName} on:change={searchMovie} on:focus={() => $playerMovement = false} on:blur={() => $playerMovement = true} placeholder="Type movie here...">
    </div>

    <div class="movieSearchContainer">
        {#if loadingMovieSearch}
            <div id="loadingSpinner">
                <Pulse size="80" color="aqua" unit="px" duration="1s" />
            </div>
        {/if}
        {#each movies as movie}
            <ul on:click={() => chosenMovieID = movie.imdbID} class="{movie.imdbID === chosenMovieID ? "selectedMovie" : ""}">
                <li id="imageItem">
                    <img src="{movie.Poster !== "N/A" ? movie.Poster : "https://www.tradeinn.com/f/13772/137720122/jibbitz-question-mark.jpg"}" alt="poster">
                </li>
                <li>
                    {movie.Title}
                </li>
                <li>
                </li>
            </ul>
        {/each}
    </div>

    <div class="inputContainer">
        <label for="startTime">Time of start</label>
        <input name="startTime" type="time" bind:value={startTime}>
    </div>
    
    <div class="inputContainer">
        <label for="amountOfSpaces">Amount of spaces</label>
        <input id="amountOfSpaceInput" name="amountOfSpaces" type="number" bind:value={amountOfSpaces} max="99" min="1" placeholder="#">
    </div>
    
    <div class="passwordInputs">
        {#if passwordBool}
            <input name="password" type="password" bind:value={password} on:focus={() => $playerMovement = false} on:blur={() => $playerMovement = true} maxlength="24" placeholder="Type password here...">
        {:else}
            <label for="searchMovie">Private event?</label>
        {/if}
        <input id="passwordCheckbox" name="searchMovie" type="checkbox" bind:checked={passwordBool}>
    </div>
    
    <button class="menuButton" id="addTheaterButton" on:click={createEvent}>Create Event</button>
    <button class="menuButton" id="backButton" on:click={back}>Back</button>
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
        height: 720px;
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
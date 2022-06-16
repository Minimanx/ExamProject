<script>
    import { navigate } from "svelte-navigator";
    import { io } from "socket.io-client";
    import { user } from "../stores/userStore.js";
    import { error, success } from "./toasts/toastThemes.js";

    const socket = io();
    export let theater;
    let password = "";

    async function joinTheater() {
        const response = await fetch("/theaters/" + theater._id, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
                userID: $user.userID,
                password: password,
                joining: true
            }),
		});
        const result = await response.json();
        
        if(response.status === 400) {
            error(result.message);
        }
        if(response.status === 200) {
            success(result.message);
            socket.emit("joinedTheater");
            $user.insideTheater = true;
            navigate("/theaters/" + theater._id);
        }
    }
</script>

<div class="container">
    <h1>{theater.eventName}</h1>
    <h2>{theater.movieName}</h2>
    <h2>{theater.movieReleaseYear}</h2>
    <h2>{theater.movieRuntime}</h2>
    <h2>{theater.imdbRating}</h2>
    <img src="{theater.hrefPoster}" alt="poster">
    {#if theater.passwordBool}
        <input type="password" bind:value={password} placeholder="Type password here...">
    {/if}
    <button class="joinTheaterButton" on:click={joinTheater}>Join</button>
</div>

<style>
    .joinTheaterButton {
		position: fixed;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 4px solid rgb(204, 204, 204);
        box-sizing: border-box;
		background-color: rgb(228, 228, 228);
		color: rgb(100, 100, 100);
        font-size: 20px;
		right: 10px;
		bottom: 0px;
		height: 60px;
		width: 478px;
	}
	.joinTheaterButton:hover {
		background-color: rgb(204, 204, 204);
		border: 4px solid rgb(189, 189, 189);
		color: rgb(85, 85, 85);
		cursor: pointer;
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
        contain: content;
    }
    img {
        height: 200px;
    }
</style>
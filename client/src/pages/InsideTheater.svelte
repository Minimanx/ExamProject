<script>
    import { onMount } from "svelte";
    import { success } from "../components/toasts/toastThemes.js";
    import { navigate } from "svelte-navigator";
    import io from "socket.io-client";
    import { user } from "../stores/userStore.js";

    const socket = io();

    export let id;

    onMount(async () => {
        socket.emit("enteredTheater");
        console.log(id);
        const response = await fetch("/theaters/" + id);
        const result = await response.json();
        console.log(result);
    });


    let messages = [];
    let message;

    socket.on("newMessage", ({ message, user }) => {
        messages.push(message);
        messages = messages;
    });

    function enteredTheater() {
        socket.emit("enteredTheater");
    }

    function emitMessage() {
        socket.emit("sendNewMessage", { message });
    }

    async function leaveTheater() {
        window.location.href = "/";
    }

</script>

<div class="container">
    <div class="movieInfoContainer">
        <button on:click={leaveTheater}>Leave</button>
        
    </div>

    <div class="liveChatContainer">
        {#each messages as message}
            <ul>
                <li>
                    {message}
                </li>
            </ul>
        {/each}
        <input type="text" bind:value={message}>
        <button on:click={emitMessage}>Send Message</button>
    </div>
</div>


<style>
    .movieInfoContainer {
		height: 800px;
		width: 1000px;
		background-color:rgb(225, 241, 255);
		overflow: hidden;
	}
	.liveChatContainer {
		height: 800px;
		width: 500px;
		background-color:rgb(241, 241, 241);
		overflow: hidden;
		display: flex;
		border-left: 3px solid rgb(27, 27, 27);
        box-sizing: border-box;
        flex-direction: column;
	}
	.container {
		min-width: 1500px;
		max-width: 1500px;
		display: flex;
		position: fixed;
		top: 50%;
		transform: translate(-50%, -50%);
		left: 50%;
	}

</style>
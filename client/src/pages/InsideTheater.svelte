<script>
    import { onMount } from "svelte";
    import io from "socket.io-client";
    import { user } from "../stores/userStore.js";

    const socket = io();

    export let id;
    let theater;

    onMount(async () => {
        socket.emit("enteredTheater");
        const response = await fetch("/theaters/" + id);
        const result = await response.json();
        theater = result.data;
    });

    let messages = [];
    let sendMessage;
    let sendMessageButton;
    let scrollContainer;
    let timeLeftInMovie;
    let hoursLeft;
    let minutesLeft;
    let secondsLeft;

    socket.on("newMessage", ({ text, username, color }) => {
        const newMessage = { text, time: new Date(), username, color }
        messages.push(newMessage);
        messages = messages;
        
        setTimeout(() => {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 1);
    });

    function emitMessage() {
        if(!sendMessage) return;
        socket.emit("sendNewMessage", { sendMessage, color: $user.playerColor });
        sendMessage = "";
        sendMessageButton.focus();
    }

    async function leaveTheater() {
        window.location.href = "/";
    }

    setInterval(() => {
        if(new Date(theater.startTime).getTime() < new Date().getTime()) {
            console.log(new Date(theater.startTime))
            console.log(new Date())
            timeLeftInMovie = new Date(new Date().getTime() - new Date(theater.startTime).getTime());
            hoursLeft = timeLeftInMovie.getHours();
            minutesLeft = timeLeftInMovie.getMinutes();
            secondsLeft = timeLeftInMovie.getSeconds();
        }
    }, 1000);

</script>

<div class="container">
    <div class="movieInfoContainer">
        <button on:click={leaveTheater}>Leave</button>
        {#if theater}
            {#if theater.ownerID === $user.userID}
            <p>YOU OWN IT</p>
            {/if}
            {#if timeLeftInMovie}
                <p>Currently running:</p>
                <p>{(hoursLeft < 10 ? "0" + hoursLeft : hoursLeft)}:{(minutesLeft < 10 ? "0" + minutesLeft : minutesLeft)}:{(secondsLeft < 10 ? "0" + secondsLeft : secondsLeft)}</p>
            {:else}
                <p>Movie starts at:</p>
                <p>{new Date(theater.startTime).getHours() < 10 ? "0" + new Date(theater.startTime).getHours() : new Date(theater.startTime).getHours()}:{new Date(theater.startTime).getMinutes() < 10 ? "0" + new Date(theater.startTime).getMinutes() : new Date(theater.startTime).getMinutes()}</p>
            {/if}
            
        {/if}

    </div>

    <div class="liveChatContainer">
        <div class="liveChat" bind:this={scrollContainer}>
            {#each messages as message}
                <ul>
                    <div class="messageInfo">
                        <li style="color: {message.color}">
                            {message.username}
                        </li>
                        <li>
                            {message.time.getHours()}:{(message.time.getMinutes() < 10 ? '0' : '') + message.time.getMinutes()}:{(message.time.getSeconds() < 10 ? '0' : '') + message.time.getSeconds()}
                        </li>
                    </div>
                    <li>
                        {message.text}
                    </li>
                </ul>
            {/each}
        </div>
        <div class="sendMessageButton">
            <form onsubmit="return false">
                <input type="text" bind:this={sendMessageButton} bind:value={sendMessage}>
                <button on:click={emitMessage}>Send Message</button>
            </form>
        </div>
    </div>
</div>


<style>
    .messageInfo {
        display: flex;
        width: 100%;
        justify-content: space-between;
        color: rgb(100, 100, 100);
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
        border: 16px solid #f1f1f1;
    }
    .liveChat {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }
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
        justify-content: flex-end;
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
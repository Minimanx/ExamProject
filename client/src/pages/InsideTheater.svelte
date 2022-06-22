<script>
    import { onMount } from "svelte";
    import io from "socket.io-client";
    import { user } from "../stores/userStore.js";
    import { error, success } from "../components/toasts/toastThemes.js";
    import { Pulse } from 'svelte-loading-spinners'

    const socket = io();

    onMount(async () => {
        socket.emit("enteredTheater");
        const response = await fetch("/theaters/" + id);
        const result = await response.json();
        theater = result.data;
        currentTime = new Date();
        timeLeftInMovie = new Date(currentTime.getTime() - new Date(theater.startTime).getTime());
        hoursLeft = timeLeftInMovie.getHours() - 1;
        minutesLeft = timeLeftInMovie.getMinutes();
        secondsLeft = timeLeftInMovie.getSeconds();
    });

    export let id;
    let theater;
    let messages = [];
    let sendMessage;
    let sendMessageButton;
    let scrollContainer;
    let timeLeftInMovie;
    let hoursLeft;
    let minutesLeft;
    let secondsLeft;
    let currentTime = new Date();

    socket.on("newMessage", ({ text, username, color }) => {
        const newMessage = { text, time: new Date(), username, color }
        messages.push(newMessage);
        messages = messages;
        
        setTimeout(() => {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 1);
    });

    function emitMessage() {
        if(!sendMessage || !sendMessage.trim().length) return;
        socket.emit("sendNewMessage", { sendMessage, color: $user.playerColor });
        sendMessage = "";
        sendMessageButton.focus();
    }

    function leaveTheater() {
        window.location.href = "/";
    }

    function inviteToTheater() {
        navigator.clipboard.writeText("localhost:5000?position=" + theater.position);
        success("Invite link copied to clipboard!");
    }

    async function deleteTheater() {
		const response = await fetch("/theaters/" + theater._id, {
			method: 'DELETE'
		});
        const result = await response.json();

        if(response.status === 400) {
            error(result.message);
        }
        if(response.status === 200) {
            window.location.href = "/";
        }
    }

    setInterval(() => {
        if(theater) {
            currentTime = new Date();
            timeLeftInMovie = new Date(currentTime.getTime() - 3600000 - new Date(theater.startTime).getTime());
            hoursLeft = timeLeftInMovie.getHours();
            minutesLeft = timeLeftInMovie.getMinutes();
            secondsLeft = timeLeftInMovie.getSeconds();
        }
    }, 1000);
    
</script>

<div class="container">
    {#if theater}
        <div class="movieInfoContainer">
            <div class="timeOfMovie">
                    {#if currentTime.getTime() < new Date(theater.startTime).getTime()}
                        <h1>Starts in:</h1>
                        <h1>{(new Date(new Date(theater.startTime).getTime() - 3600000 - currentTime.getTime()).getHours() < 10 ? "0" : "") + String(new Date(new Date(theater.startTime).getTime() - 3600000 - currentTime.getTime()).getHours())}:{(new Date(new Date(theater.startTime).getTime() - currentTime.getTime()).getMinutes() < 10 ? "0" : "") + new Date(new Date(theater.startTime).getTime() - currentTime.getTime()).getMinutes()}:{(new Date(new Date(theater.startTime).getTime() - currentTime.getTime()).getSeconds() < 10 ? "0" : "") + new Date(new Date(theater.startTime).getTime() - currentTime.getTime()).getSeconds()}</h1>
                    {:else if currentTime.getTime() > new Date(theater.startTime).getTime() && currentTime.getTime() < new Date(theater.timeToClose).getTime() - 900000}
                        <h1>Ongoing:</h1>
                        <h1>{(hoursLeft < 10 ? "0" + hoursLeft : hoursLeft)}:{(minutesLeft < 10 ? "0" + minutesLeft : minutesLeft)}:{(secondsLeft < 10 ? "0" + secondsLeft : secondsLeft)}</h1>
                    {:else if currentTime.getTime() > new Date(theater.timeToClose).getTime() - 900000 && currentTime.getTime() < new Date(theater.timeToClose).getTime()}
                        <h1>Closing in:</h1>
                        <h1>{(new Date(new Date(theater.timeToClose).getTime() - 3600000 - new Date(currentTime)).getHours() < 10 ? "0" : "") + String(new Date(new Date(theater.timeToClose).getTime() - 3600000 - new Date(currentTime)).getHours())}:{(new Date(new Date(theater.timeToClose).getTime() - new Date(currentTime)).getMinutes() < 10 ? "0" : "") + String(new Date(new Date(theater.timeToClose).getTime() - new Date(currentTime)).getMinutes())}:{(new Date(new Date(theater.timeToClose).getTime() - (new Date(currentTime))).getSeconds() < 10 ? "0" : "") + String(new Date(new Date(theater.timeToClose).getTime() - new Date(currentTime)).getSeconds())}</h1>
                    {:else}
                        <h1>Closed</h1>
                    {/if}
            </div>
        </div>

        <div class="liveChatContainer">
            <div class="topBar">
                <button class="menuButton" id="leaveTheaterButton" on:click={leaveTheater} title="Leave theater">
                    <svg width="40px" xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 19 23" shape-rendering="crispEdges">
                        <path stroke="rgb(100, 100, 100)" d="M0 0h15M0 1h15M0 2h6M13 2h2M0 3h2M4 3h4M13 3h2M0 4h2M6 4h4M13 4h2M0 5h2M8 5h2M13 5h2M0 6h2M8 6h2M13 6h2M0 7h2M8 7h2M13 7h2M0 8h2M8 8h2M13 8h2M0 9h2M8 9h2M16 9h2M0 10h2M8 10h2M11 10h8M0 11h2M8 11h2M11 11h8M0 12h2M8 12h2M16 12h2M0 13h2M8 13h2M13 13h2M0 14h2M8 14h2M13 14h2M0 15h2M8 15h2M13 15h2M0 16h2M8 16h2M13 16h2M0 17h2M8 17h2M13 17h2M0 18h2M8 18h7M0 19h4M8 19h7M2 20h4M8 20h2M4 21h6M6 22h4" />
                        </svg>
                    </button>
                <button class="menuButton" id="inviteToTheaterButton" on:click={inviteToTheater} title="Copy invite link">
                    <svg width="40px" xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 19 23" shape-rendering="crispEdges">
                    <path stroke="rgb(100, 100, 100)" d="M0 0h15M0 1h15M0 2h2M13 2h2M0 3h2M13 3h2M0 4h2M4 4h15M0 5h2M4 5h15M0 6h2M4 6h2M17 6h2M0 7h2M4 7h2M17 7h2M0 8h2M4 8h2M17 8h2M0 9h2M4 9h2M17 9h2M0 10h2M4 10h2M17 10h2M0 11h2M4 11h2M17 11h2M0 12h2M4 12h2M17 12h2M0 13h2M4 13h2M17 13h2M0 14h2M4 14h2M17 14h2M0 15h2M4 15h2M17 15h2M0 16h2M4 16h2M17 16h2M0 17h2M4 17h2M17 17h2M0 18h6M17 18h2M0 19h6M17 19h2M4 20h2M17 20h2M4 21h15M4 22h15" />
                    </svg>
                </button>
                {#if theater}
                    {#if theater.ownerID === $user.userID}
                        <button class="menuButton" id="deleteTheaterButton" on:click={deleteTheater} title="Delete theater">
                            <svg width="40px" xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 20 23" shape-rendering="crispEdges">
                            <path stroke="rgb(100, 100, 100)" d="M6 0h8M6 1h8M4 2h2M14 2h2M4 3h2M14 3h2M1 4h18M1 5h18M0 6h2M18 6h2M1 7h18M1 8h18M1 9h2M17 9h2M1 10h2M17 10h2M1 11h2M17 11h2M1 12h2M5 12h2M9 12h2M13 12h2M17 12h2M1 13h2M5 13h2M9 13h2M13 13h2M17 13h2M1 14h2M5 14h2M9 14h2M13 14h2M17 14h2M2 15h2M5 15h2M9 15h2M13 15h2M16 15h2M2 16h2M5 16h2M9 16h2M13 16h2M16 16h2M2 17h2M5 17h2M9 17h2M13 17h2M16 17h2M2 18h2M5 18h2M9 18h2M13 18h2M16 18h2M2 19h2M5 19h2M9 19h2M13 19h2M16 19h2M2 20h2M16 20h2M2 21h16M3 22h14" />
                            </svg>
                        </button>
                    {/if}
                {/if}
            </div>
            <div class="liveChat" bind:this={scrollContainer}>
                {#each messages as message}
                    <div class="wholeMessage">
                        <ul>
                            <div class="messageInfo">
                                <li style="color: {message.color}">
                                    {message.username}
                                </li>
                                <li class="timeStamp">
                                    {(message.time.getHours() < 10 ? "0" : "") + message.time.getHours()}:{(message.time.getMinutes() < 10 ? "0" : "") + message.time.getMinutes()}:{(message.time.getSeconds() < 10 ? "0" : "") + message.time.getSeconds()}
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
                <form onsubmit="return false">
                    <input class="messageInput" type="text" maxlength="200" bind:this={sendMessageButton} bind:value={sendMessage}>
                    <button class="messageButton menuButton" on:click={emitMessage}>></button>
                </form>
            </div>
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
        top: 742px;
        right: 94px;
    }
    .messageButton {
        width: 75px;
        height: 50px;
        font-size: 30px;
        top: 742px;
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
        max-height: 656px;
        overflow-x: auto;
        overflow-wrap: anywhere;
    }
    .liveChat::-webkit-scrollbar {
        display: none;
    }
    .movieInfoContainer {
		height: 800px;
		width: 1000px;
		background-color:rgb(225, 241, 255);
		overflow: hidden;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
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
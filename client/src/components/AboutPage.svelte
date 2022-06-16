<script>
    export let aboutPageBool;

    function back() {
        aboutPageBool = false;
    }
</script>

<div class="container">
    <p>This webapp is a little project made for my 4th semester, Node.js elective.</p>
    <p>The assignment was to make a "passion project", with authentication/authorization, websockets and express.</p>
    <p>I chose to use Svelte for my front end, since I enjoy working with it.</p>
    <p>The purpose of this webapp, is for users to be able to watch movies together, with other people, while chatting. You could set up events for your friends, film clubs, communities or for anyone who wants to watch!</p>
    <p>You're only able to create one event at the time, per user. Events can only be created 24 hours in advance.</p>
    <p>Hope you enjoy!</p>
    <button class="menuButton" id="backButton" on:click={back}>Back</button>
</div>

<style>
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
    #backButton {
		font-size: 20px;
		right: 10px;
		bottom: 0px;
		height: 60px;
		width: 235px;
	}
</style>
<script>
    export let name;
    export let id;
    export let movie;
</script>

<div class="container">
    <h1>{name}</h1>
    <h2>{movie}</h2>
</div>

<style>
    .container {
        position: fixed;
        background-color: rgb(124, 124, 124);
        z-index: 100;
        right: 0;
        top: 80px;
        height: 720px;
        width: 500px;
		border-top: 3px solid rgb(27, 27, 27);
        border-left: 3px solid rgb(27, 27, 27);
        box-sizing: border-box;
        font-family: 'Press Start 2P', cursive;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }
</style>
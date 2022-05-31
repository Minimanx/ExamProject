<script>
    export let theaters;

    function hej() {
        console.log("hej")
    }
</script>

<div class="list">
    {#each theaters as theater (theater._id)}
        <ul on:click={hej}>
            <li>
                {theater.name}
            </li>
            <li>
                {theater.movie}
            </li>
            <li>
                {theater._id}
            </li>
        </ul>
    {/each}
</div>
<style>
    .list {
        display: flex;
        flex-direction: column;
        width: 497px;
        align-items: center;
        overflow-y: auto;
        height: 640px;
        position: fixed;
        top: 80px;
    }
    ul {
        border-top: 3px solid black;
        width: 100%;
        margin: 0;
        text-align: center;
        list-style-type: none;
        padding: 0;
    }
    ul:hover {
        background-color: aquamarine;
        cursor: pointer;
    }
</style>
<script>
    export let theater;
</script>

<div class="container">
    <h1>{theater.eventName}</h1>
    <h2>{theater.movieName}</h2>
    <h2>{theater.movieReleaseYear}</h2>
    <h2>{theater.movieRuntime}</h2>
    <h2>{theater.imdbRating}</h2>
    <img src="{theater.hrefPoster}" alt="poster">
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
        contain: content;
    }
</style>
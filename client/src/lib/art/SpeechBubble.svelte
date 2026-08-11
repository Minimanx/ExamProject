<script>
    let { text } = $props();
</script>

<div class="bubble">
    <span>{text}</span>
</div>

<style>
    .bubble {
        position: absolute;
        /* Above the car, centred on it. The car is 100px wide. */
        bottom: 100%;
        left: 50px;
        transform: translateX(-50%);
        max-width: 220px;
        padding: 6px 10px;
        margin-bottom: 6px;
        background: #ffffff;
        border: 2px solid #331b02;
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.25;
        /* Long words must wrap rather than widen the bubble past its max. */
        overflow-wrap: anywhere;
        text-align: center;
        /* The bubble is decoration over a driving surface; clicks belong to
           whatever is underneath it. */
        pointer-events: none;
        z-index: 5;
    }

    /* The tail, drawn as two stacked triangles so it has the same outline as
       the bubble rather than a border that stops at the corner. */
    .bubble::after,
    .bubble::before {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        border: 7px solid transparent;
    }

    .bubble::before {
        border-top-color: #331b02;
        margin-left: -7px;
    }

    .bubble::after {
        border-top-color: #ffffff;
        border-width: 5px;
        margin-left: -5px;
    }
</style>

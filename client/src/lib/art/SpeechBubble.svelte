<script>
    import { bubbleShiftFor } from "../services/bubblePlacement.js";

    /**
     * `carX` is where the car is drawn across the stage, in stage pixels. A
     * bubble centred on a car near an edge hangs off it, and the car spawns near
     * the left edge — so that is the ordinary case, not a corner one.
     */
    let { text, carX = null, stageWidth = 1500 } = $props();

    let bubble = $state();
    let width = $state(0);
    let carWidth = $state(0);

    // Both measured rather than assumed. The bubble is as wide as its text up to
    // a maximum, so how far it has to slide depends on what was said — and the
    // car's width was previously guessed at 100px when the art is 50, which put
    // the tail beside the car rather than under it.
    $effect(() => {
        // Referenced so the measurement is redone when the text changes.
        void text;
        width = bubble?.offsetWidth ?? 0;
        carWidth = bubble?.parentElement?.offsetWidth ?? 0;
    });

    const shift = $derived(
        carX === null
            ? 0
            : bubbleShiftFor({
                  carCentre: carX + carWidth / 2,
                  bubbleWidth: width,
                  stageWidth,
              })
    );
</script>

<div class="bubble" bind:this={bubble} style="--shift: {shift}px">
    <span>{text}</span>
</div>

<style>
    .bubble {
        position: absolute;
        /* Above the car and centred on it. `50%` rather than a pixel count: the
           car art is not the width the number assumed, and a hardcoded offset
           put the tail beside the car instead of under it. */
        bottom: 100%;
        left: 50%;
        transform: translateX(calc(-50% + var(--shift, 0px)));
        /* max-content so a short message hugs its text, max-width so a long one
           wraps instead of stretching across the world. Without the first, an
           absolutely positioned box has no width to shrink-to-fit from. */
        width: max-content;
        max-width: 220px;
        padding: 6px 10px;
        margin-bottom: 6px;
        background: #ffffff;
        border: 2px solid #331b02;
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.3;
        /* break-word, not anywhere: `anywhere` also lets the browser count a
           single character as a valid minimum width, so a shrink-to-fit box
           collapses to one letter per line. This breaks only words that
           genuinely do not fit. */
        overflow-wrap: break-word;
        text-align: center;
        /* The bubble is decoration over a driving surface; clicks belong to
           whatever is underneath it. */
        pointer-events: none;
        z-index: 5;
    }

    /* The tail stays on the car when the bubble slides, by moving the opposite
       way. Without this it would drift along with the bubble and point at
       nothing. */
    .bubble::after,
    .bubble::before {
        content: "";
        position: absolute;
        top: 100%;
        left: calc(50% - var(--shift, 0px));
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

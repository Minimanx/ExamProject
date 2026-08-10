<script>
    import { onMount } from "svelte";
    import { SvelteToast } from "@zerodevx/svelte-toast";

    let { children } = $props();

    const stageWidth = 1500;
    const stageHeight = 800;

    function getStageLayout() {
        const viewport = window.visualViewport;
        const viewportWidth = viewport?.width || window.innerWidth;
        const viewportHeight = viewport?.height || window.innerHeight;
        const scale = Math.min(viewportWidth / stageWidth, viewportHeight / stageHeight);

        // The stage is scaled to fit, then grown along whichever axis the scale did
        // not constrain, so it always reaches the viewport edges. Height alone used
        // to be grown, which left black bars on any viewport wider than
        // stageWidth/stageHeight (1.875:1) — a 2560-wide monitor hits that as soon
        // as browser chrome takes the viewport below 1365px tall.
        const height = viewportHeight / scale;
        const width = viewportWidth / scale;

        return {
            scale,
            height,
            width,
            sceneOffset: Math.max(0, height - stageHeight),
        };
    }

    // Must be $state: it is reassigned on every resize and feeds the CSS custom
    // properties the edge-to-edge fix depends on. Without it the stage stops
    // re-fitting and the black bars come back.
    let stageLayout = $state(getStageLayout());

    onMount(() => {
        function updateStageLayout() {
            stageLayout = getStageLayout();
        }

        window.addEventListener("resize", updateStageLayout);
        window.visualViewport?.addEventListener("resize", updateStageLayout);

        return () => {
            window.removeEventListener("resize", updateStageLayout);
            window.visualViewport?.removeEventListener("resize", updateStageLayout);
        };
    });
</script>

<div class="toasts">
    <SvelteToast options={{ intro: { y: -500 } }} />
</div>

<main
    style="--stage-scale: {stageLayout.scale}; --stage-height: {stageLayout.height}px; --stage-width: {stageLayout.width}px; --scene-offset: {stageLayout.sceneOffset}px;"
>
    {@render children()}
</main>

<style>
    main {
        width: var(--stage-width);
        height: var(--stage-height);
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(var(--stage-scale));
        transform-origin: center;
        user-select: none;
        will-change: transform;
    }
    :root {
        --toastContainerTop: 8rem;
        --toastContainerRight: auto;
        --toastContainerBottom: auto;
        --toastContainerLeft: calc(50vw - 8rem);
    }
</style>

<script>
    // No defaults: a Svelte prop default fires on `undefined`, and a remote car
    // has no `direction` until it first moves. Defaulting facingLeft to false
    // would mirror every car on join.
    let { name, color, facingLeft } = $props();
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -0.5 48 18"
    shape-rendering="crispEdges"
    preserveAspectRatio="xMaxYMax meet"
    transform={facingLeft === false ? "scale(-1, 1)" : ""}
>
    <text
        class="carName"
        transform={facingLeft === false ? "scale(-1, 1)" : ""}
        transform-origin={facingLeft === false ? "50% 50%" : ""}
        font-size="10px"
        font-weight="bold">{name}</text
    >
    <path
        stroke="#000000"
        d="M22 0h2M21 1h1M23 1h1M20 2h1M22 2h1M19 3h1M21 3h1M18 4h1M20 4h1M27 4h2M34 4h4M17 5h1M19 5h1M26 5h1M28 5h1M33 5h1M35 5h1M38 5h3M9 6h8M18 6h17M41 6h6M4 7h5M17 7h1M30 7h1M46 7h1M2 8h2M17 8h1M27 8h2M31 8h1M46 8h1M1 9h1M16 9h1M31 9h1M46 9h1M0 10h1M7 10h4M16 10h1M30 10h1M35 10h4M47 10h1M0 11h1M6 11h1M11 11h1M16 11h1M30 11h1M34 11h1M39 11h1M47 11h1M0 12h3M5 12h1M12 12h1M16 12h1M29 12h1M33 12h1M40 12h1M44 12h4M0 13h1M3 13h3M12 13h22M40 13h4M47 13h1M1 14h1M5 14h1M12 14h1M33 14h1M40 14h1M45 14h2M2 15h4M12 15h22M40 15h5M6 16h1M11 16h1M34 16h1M39 16h1M7 17h4M35 17h4"
    />
    <path
        stroke={color}
        d="M22 1h1M21 2h1M20 3h1M19 4h1M18 5h1M36 5h2M17 6h1M35 6h6M9 7h8M18 7h12M31 7h15M4 8h13M18 8h9M29 8h2M32 8h14M2 9h14M17 9h14M32 9h14M1 10h6M11 10h5M17 10h13M31 10h4M39 10h8M1 11h5M12 11h4M17 11h13M31 11h3M40 11h7M3 12h2M13 12h3M17 12h12M30 12h3M41 12h3M1 13h2M44 13h3M2 14h3M13 14h20M41 14h4"
    />
    <path stroke="#613c0c" d="M27 5h1M34 5h1" />
    <path
        stroke="#333333"
        d="M7 11h4M35 11h4M6 12h2M10 12h2M34 12h2M38 12h2M6 13h1M11 13h1M34 13h1M39 13h1M6 14h1M11 14h1M34 14h1M39 14h1M6 15h2M10 15h2M34 15h2M38 15h2M7 16h4M35 16h4"
    />
    <path
        stroke="#7a7a7a"
        d="M8 12h2M36 12h2M7 13h1M10 13h1M35 13h1M38 13h1M7 14h1M10 14h1M35 14h1M38 14h1M8 15h2M36 15h2"
    />
    <path stroke="#ababab" d="M8 13h2M36 13h2M8 14h2M36 14h2" />
</svg>

<style>
    svg {
        width: 100%;
        height: 100%;
        display: block;
    }
    .carName {
        alignment-baseline: after-edge;
        user-select: none;
        font-family: sans-serif;
    }
</style>

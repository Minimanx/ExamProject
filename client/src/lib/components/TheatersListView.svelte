<script>
    import { formatTimeOfDay } from "../services/duration.js";
    import { onDestroy } from "svelte";
    import { apiFetch } from "../services/api.js";
    import { isLocked } from "../services/access.js";
    import { sortedBy } from "../services/theaterSort.js";
    import { listingQuery, narrows } from "../services/theaterQuery.js";

    let { theaters, teleportToTheater = () => {} } = $props();

    // A query in flight when the panel closes would land on a component that is
    // gone, having made a request nobody is waiting for.
    onDestroy(() => clearTimeout(queryTimer));

    // Searching and filtering query the server rather than narrowing the prop.
    // The client has the whole strip today only because the strip is small,
    // which is a fact about the current size and not something to build on.
    let searchTerm = $state("");
    let onlyWithSpace = $state(false);
    let startingWithin = $state("");
    let matches = $state(null);
    let queryTimer;

    // Debounced: a keystroke per request would put a request per keystroke on
    // the listing, which also runs the expiry sweep and the occupancy
    // reconciliation.
    const QUERY_DEBOUNCE_MS = 200;

    /**
     * How soon an event has to start to count as "soon".
     *
     * The server takes any positive number of minutes; these are the answers
     * worth a click. An event already under way matches every window — it is the
     * one you are most likely to want to walk into.
     */
    const WINDOWS = [
        { value: "", label: "Any time" },
        { value: "30", label: "Within 30 min" },
        { value: "60", label: "Within an hour" },
        { value: "180", label: "Within 3 hours" },
    ];

    /** Read when the handler runs rather than derived, so it cannot depend on
        whether Svelte's binding or this handler saw the change first. */
    function currentFilters() {
        return { term: searchTerm, onlyWithSpace, startingWithin };
    }

    function onFilterChange() {
        clearTimeout(queryTimer);

        if (!narrows(currentFilters())) {
            matches = null;
            return;
        }
        queryTimer = setTimeout(() => void runQuery(), QUERY_DEBOUNCE_MS);
    }

    // A slower earlier request must not overwrite a newer one's results. A
    // sequence number rather than re-reading the inputs: typing "noir", deleting
    // it and typing it again makes two requests whose terms match, and the
    // comparison that used to guard this could not tell them apart.
    let latestQuery = 0;

    async function runQuery() {
        const mine = ++latestQuery;

        const response = await apiFetch(`/theaters?${listingQuery(currentFilters())}`);
        if (!response.ok) return;

        const { data } = await response.json();
        if (mine === latestQuery) {
            matches = data;
        }
    }

    // null means "not filtering" and shows everything; an empty array means a
    // query that found nothing, which has to look different from no query at
    // all or the list silently reads as "there is nothing on".
    let sort = $state({ key: null, direction: "asc" });
    const visible = $derived(sortedBy(matches ?? theaters, sort.key, sort.direction));

    /** Ascending on the first click, reversed on the next. */
    function sortBy(key) {
        sort =
            sort.key === key && sort.direction === "asc"
                ? { key, direction: "desc" }
                : { key, direction: "asc" };
    }

    /**
     * The colour a column header is drawn in: green while it is sorting
     * ascending, red descending, and the ordinary colour when it is not the one
     * sorting. The svg needs the same answer as a fill, and used to get it by
     * splitting the css declaration apart at the space and the semicolon.
     */
    function headerColor(key) {
        if (sort.key !== key) return "rgb(27, 27, 27)";
        return sort.direction === "asc" ? "green" : "red";
    }
</script>

<div class="container">
    <div class="searchBar">
        <input
            name="search"
            type="search"
            placeholder="Search events and films..."
            bind:value={searchTerm}
            oninput={onFilterChange}
        />
        <div class="filters">
            <label class="filterCheck">
                <input
                    name="hasSpace"
                    type="checkbox"
                    bind:checked={onlyWithSpace}
                    onchange={onFilterChange}
                />
                Only with room
            </label>
            <select
                name="startingWithin"
                aria-label="How soon it starts"
                bind:value={startingWithin}
                onchange={onFilterChange}
            >
                {#each WINDOWS as window (window.value)}
                    <option value={window.value}>{window.label}</option>
                {/each}
            </select>
        </div>
    </div>
    <div class="headers">
        <ul class="unorderedListHeaders">
            <li></li>
            <li>
                <button
                    class="sortHeader"
                    style="color: {headerColor('name')};"
                    onclick={() => sortBy("name")}>Name/Movie</button
                >
            </li>
            <li>
                <button
                    class="sortHeader"
                    style="color: {headerColor('runtime')};"
                    onclick={() => sortBy("runtime")}>Time</button
                >
            </li>
            <li>
                <button
                    class="sortHeader"
                    style="color: {headerColor('startTime')};"
                    onclick={() => sortBy("startTime")}>Starts</button
                >
            </li>
            <li>
                <button
                    class="sortHeader"
                    aria-label="Sort by seats free"
                    onclick={() => sortBy("spaces")}
                >
                    <svg
                        fill={headerColor("spaces")}
                        width="22px"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 640 512"
                        ><!--! Font Awesome Pro 6.1.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
                            d="M224 256c70.7 0 128-57.31 128-128S294.7 0 224 0C153.3 0 96 57.31 96 128S153.3 256 224 256zM274.7 304H173.3c-95.73 0-173.3 77.6-173.3 173.3C0 496.5 15.52 512 34.66 512H413.3C432.5 512 448 496.5 448 477.3C448 381.6 370.4 304 274.7 304zM479.1 320h-73.85C451.2 357.7 480 414.1 480 477.3C480 490.1 476.2 501.9 470 512h138C625.7 512 640 497.6 640 479.1C640 391.6 568.4 320 479.1 320zM432 256C493.9 256 544 205.9 544 144S493.9 32 432 32c-25.11 0-48.04 8.555-66.72 22.51C376.8 76.63 384 101.4 384 128c0 35.52-11.93 68.14-31.59 94.71C372.7 243.2 400.8 256 432 256z"
                        /></svg
                    >
                </button>
            </li>
            <li>
                <svg width="20px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"
                    ><!--! Font Awesome Pro 6.1.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
                        d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"
                    /></svg
                >
            </li>
        </ul>
    </div>
    <div class="list">
        {#if matches !== null && matches.length === 0}
            <!-- Naming the term is the useful message when there is one, and
                 quoting an empty string is the useless one a filter alone would
                 otherwise produce. -->
            <p class="noMatches">
                {searchTerm.trim()
                    ? `No events match "${searchTerm.trim()}"`
                    : "No events match those filters"}
            </p>
        {/if}
        {#each visible as theater (theater._id)}
            <ul class="unorderedList" onclick={() => teleportToTheater(theater.position)}>
                <li></li>
                <div class="names">
                    <li class="namesInsideDiv">
                        {theater.eventName}
                    </li>
                    <li class="namesInsideDiv movieName">
                        {theater.movieName}
                    </li>
                </div>
                <div class="eventInfo">
                    <div class="eventInfoSingle">
                        <li>
                            {theater.movieRuntime}
                        </li>
                        <li>min</li>
                    </div>
                    <div class="eventInfoSingle">
                        <li>{formatTimeOfDay(theater.startTime)}</li>
                    </div>
                    <div class="eventInfoSingle">
                        <li>
                            {theater.usersInsideTheater.length}/{theater.amountOfSpaces}
                        </li>
                    </div>
                    <div class="eventInfoSingle">
                        <li>
                            {#if isLocked(theater)}
                                <svg
                                    width="22px"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 448 512"
                                    ><!--! Font Awesome Pro 6.1.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
                                        d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"
                                    /></svg
                                >
                            {:else}
                                <svg
                                    fill="#646464"
                                    width="22px"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 448 512"
                                    ><!--! Font Awesome Pro 6.1.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
                                        d="M144 192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80V144C80 64.47 144.5 0 224 0C281.5 0 331 33.69 354.1 82.27C361.7 98.23 354.9 117.3 338.1 124.9C322.1 132.5 303.9 125.7 296.3 109.7C283.4 82.63 255.9 64 224 64C179.8 64 144 99.82 144 144L144 192z"
                                    /></svg
                                >
                            {/if}
                        </li>
                    </div>
                </div>
            </ul>
        {/each}
    </div>
</div>

<style>
    .unorderedListHeaders {
        flex-basis: 261px;
        flex-shrink: 0;
        display: flex;
        margin: 0;
        text-align: center;
        list-style-type: none;
        padding: 10px 0px;
        align-items: center;
    }
    /* A header that sorts is a button, so a keyboard can reach it — it was a
       bare <li> with a click handler, which nothing but a mouse could use. It
       still has to look like a header rather than a form control. */
    .sortHeader {
        font: inherit;
        color: inherit;
        background: none;
        border: none;
        padding: 0;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }

    .sortHeader:focus-visible {
        outline: 2px solid rgb(27, 27, 27);
        outline-offset: 2px;
    }
    .unorderedListHeaders li:nth-child(1) {
        flex-basis: 26px;
    }
    .unorderedListHeaders li:nth-child(2) {
        flex-basis: 188px;
    }
    .unorderedListHeaders li:nth-child(3) {
        flex-basis: 84px;
    }
    .unorderedListHeaders li:nth-child(4) {
        flex-basis: 69px;
    }
    .unorderedListHeaders li:nth-child(5) {
        flex-basis: 95px;
    }
    .unorderedListHeaders li:nth-child(6) {
        flex-basis: 35px;
    }
    .searchBar {
        /* The list centres its children, which means they are content-width
           unless told otherwise — so the bar was about half the panel and the
           input's own width:100% had nothing to fill. */
        width: 100%;
        box-sizing: border-box;
        padding: 6px 10px;
    }

    /* Scoped to the search box. Unqualified, it also caught the filter
       checkbox and stretched it across the panel. */
    .searchBar input[type="search"] {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 10px;
        font-family: inherit;
        font-size: 14px;
    }

    .filters {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-top: 6px;
        font-size: 13px;
        color: rgb(100, 100, 100);
    }

    .filterCheck {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
    }

    .filters select {
        font-family: inherit;
        font-size: 13px;
        padding: 4px 6px;
        border: 2px solid rgb(204, 204, 204);
        background-color: rgb(252, 252, 252);
    }

    .noMatches {
        padding: 12px 8px;
        margin: 0;
        text-align: center;
    }

    .list {
        width: 100%;
        overflow-y: auto;
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
    .list::-webkit-scrollbar {
        display: none;
    }
    .headers {
        width: 100%;
        font-size: 11px;
        border-bottom: 3px solid black;
    }
    .movieName {
        font-size: 12px;
    }
    .namesInsideDiv {
        width: 100%;
        text-overflow: ellipsis;
        overflow: hidden;
    }
    .names {
        width: 40%;
        white-space: nowrap;
    }
    .eventInfoSingle {
        flex-basis: 70px;
        flex-shrink: 0;
    }
    .eventInfo div:first-child {
        flex-basis: 46px;
    }
    .eventInfo div:nth-child(4) {
        flex-basis: 35px;
    }
    .eventInfo {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        flex-shrink: 0;
        flex-basis: 255px;
    }
    .container {
        display: flex;
        flex-direction: column;
        width: 497px;
        align-items: center;
        /* 80 above for the colour picker, 144 below for the two rows of menu
           buttons. Reserving only one row's worth put the list underneath them. */
        height: calc(var(--stage-height) - 224px);
        position: fixed;
        top: 80px;
        font-size: 14px;
    }
    .unorderedList {
        width: 100%;
        margin: 0;
        text-align: center;
        list-style-type: none;
        padding: 10px 0px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        line-height: 20px;
        gap: 20px;
    }
    .unorderedList:nth-child(even) {
        background-color: rgb(228, 228, 228);
    }
    .unorderedList:hover {
        background-color: aquamarine;
        cursor: pointer;
    }
    li {
        user-select: none;
    }
</style>

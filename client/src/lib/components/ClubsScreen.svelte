<script>
    import { onDestroy } from "svelte";
    import Panel from "./Panel.svelte";
    import { apiFetch } from "../services/api.js";
    import { error, success } from "./toasts/toastThemes.js";
    import { playerMovement } from "../stores/stateManagementStore.js";
    import { user } from "../stores/userStore.js";
    import { resolve } from "$app/paths";
    import { describeMeeting } from "../services/clubSchedule.js";

    let { clubsBool = $bindable() } = $props();

    let mine = $state([]);
    let discoverable = $state([]);
    let loading = $state(true);
    let creating = $state(false);

    // The create form. The schedule is a weekday and a wall clock, because that
    // is what a club means by "Thursdays at 20:00" — see the server's schedule
    // module for why it is not stored as an instant.
    let name = $state("");
    let description = $state("");
    let isPublic = $state(true);
    let weekday = $state(4);
    let timeOfDay = $state("20:00");

    const WEEKDAYS = [
        "Sundays",
        "Mondays",
        "Tuesdays",
        "Wednesdays",
        "Thursdays",
        "Fridays",
        "Saturdays",
    ];

    // Whatever zone this browser is in, which is the one the host means.
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    async function load() {
        const [minePart, publicPart] = await Promise.all([
            apiFetch("/clubs/mine"),
            apiFetch("/clubs"),
        ]);

        if (minePart.ok) mine = (await minePart.json()).data;
        if (publicPart.ok) {
            const all = (await publicPart.json()).data;
            const alreadyIn = new Set(mine.map((club) => club.id));
            discoverable = all.filter((club) => !alreadyIn.has(club.id));
        }
        loading = false;
    }

    async function create() {
        const [hour, minute] = timeOfDay.split(":").map(Number);
        const response = await apiFetch("/clubs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name.trim(),
                description: description.trim(),
                isPublic,
                schedule: { weekday, hour, minute, timeZone },
            }),
        });
        const result = await response.json();

        if (!response.ok) {
            error(result.message);
            return;
        }
        success(result.message);
        name = "";
        description = "";
        creating = false;
        await load();
    }

    async function join(club) {
        const response = await apiFetch(`/clubs/${club.id}/members`, { method: "POST" });
        const result = await response.json();

        if (!response.ok) {
            error(result.message);
            return;
        }
        success(result.message);
        await load();
    }

    /**
     * Whether this person is the only owner.
     *
     * They cannot leave: a club with no owner has nobody who can delete it or
     * promote anyone, so the server refuses. Offering a button that always fails
     * is worse than offering the one that works.
     */
    function isSoleOwner(club) {
        return (
            club.myRole === "owner" &&
            club.members.filter((member) => member.role === "owner").length === 1
        );
    }

    async function remove(club) {
        if (!confirm(`Delete ${club.name}? This cannot be undone.`)) return;

        const response = await apiFetch(`/clubs/${club.id}`, { method: "DELETE" });
        const result = await response.json();

        if (!response.ok) {
            error(result.message);
            return;
        }
        success(result.message);
        await load();
    }

    async function leave(club) {
        // My own id, not "the first member holding my role" — in a club with two
        // owners that would remove the wrong person.
        const response = await apiFetch(`/clubs/${club.id}/members/${$user.userID}`, {
            method: "DELETE",
        });
        const result = await response.json();

        if (!response.ok) {
            error(result.message);
            return;
        }
        await load();
    }

    const holdMovement = {
        onfocus: () => ($playerMovement = false),
        onblur: () => ($playerMovement = true),
    };

    void load();
    onDestroy(() => ($playerMovement = true));
</script>

<Panel title="Film clubs" onBack={() => (clubsBool = false)}>
    <div class="list">
        {#if loading}
            <p class="empty">Loading...</p>
        {:else if creating}
            <label for="clubName">Name</label>
            <input
                id="clubName"
                name="clubName"
                bind:value={name}
                maxlength="40"
                {...holdMovement}
            />

            <label for="clubDescription">Description</label>
            <input
                id="clubDescription"
                name="clubDescription"
                bind:value={description}
                maxlength="400"
                {...holdMovement}
            />

            <label for="clubWeekday">Meets</label>
            <div class="row">
                <select id="clubWeekday" name="clubWeekday" bind:value={weekday} {...holdMovement}>
                    {#each WEEKDAYS as day, index (day)}
                        <option value={index}>{day}</option>
                    {/each}
                </select>
                <input
                    name="clubTime"
                    type="time"
                    bind:value={timeOfDay}
                    aria-label="Time the club meets"
                    {...holdMovement}
                />
            </div>
            <p class="hint">Times are {timeZone}, and stay that way through the clock changes.</p>

            <label class="checkRow" for="clubPublic">
                <input id="clubPublic" name="clubPublic" type="checkbox" bind:checked={isPublic} />
                Listed publicly
            </label>

            <div class="row">
                <button class="rowButton" onclick={create}>Create club</button>
                <button class="rowButton" onclick={() => (creating = false)}>Cancel</button>
            </div>
        {:else}
            <h3>Yours</h3>
            {#if mine.length === 0}
                <p class="empty">You are not in a club yet.</p>
            {:else}
                <ul>
                    {#each mine as club (club.id)}
                        <li>
                            <div class="clubText">
                                <a
                                    href={resolve(`/clubs/${club.slug}`)}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {club.name}
                                </a>
                                <span class="detail"
                                    >{describeMeeting(club.schedule, timeZone)}</span
                                >
                            </div>
                            <span class="role">{club.myRole}</span>
                            {#if isSoleOwner(club)}
                                <button class="rowButton" onclick={() => remove(club)}>
                                    Delete
                                </button>
                            {:else}
                                <button class="rowButton" onclick={() => leave(club)}>Leave</button>
                            {/if}
                        </li>
                    {/each}
                </ul>
            {/if}

            <h3>Open to join</h3>
            {#if discoverable.length === 0}
                <p class="empty">Nothing else is public right now.</p>
            {:else}
                <ul>
                    {#each discoverable as club (club.id)}
                        <li>
                            <div class="clubText">
                                <a
                                    href={resolve(`/clubs/${club.slug}`)}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {club.name}
                                </a>
                                <span class="detail">
                                    {describeMeeting(club.schedule, timeZone)} · {club.members
                                        .length}
                                    {club.members.length === 1 ? "member" : "members"}
                                </span>
                            </div>
                            <button class="rowButton" onclick={() => join(club)}>Join</button>
                        </li>
                    {/each}
                </ul>
            {/if}

            <button class="rowButton startClub" onclick={() => (creating = true)}>
                Start a club
            </button>
        {/if}
    </div></Panel
>

<style>
    /* The panel owns the frame; this is how these particular contents sit in
       it — a column that scrolls when there are more clubs or friends than fit. */
    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
    }

    h3 {
        margin: 8px 0 0;
        font-size: 14px;
        color: rgb(100, 100, 100);
    }

    label {
        font-size: 13px;
        color: rgb(100, 100, 100);
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    li {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
    }

    .clubText {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    .clubText a {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .detail {
        font-size: 11px;
        color: rgb(110, 110, 110);
    }

    .role {
        font-size: 10px;
        text-transform: uppercase;
        color: rgb(110, 110, 110);
    }

    .row {
        display: flex;
        gap: 6px;
    }

    .checkRow {
        display: flex;
        align-items: center;
        gap: 8px;
        color: rgb(27, 27, 27);
    }

    .hint {
        margin: 0;
        font-size: 11px;
        color: rgb(110, 110, 110);
    }

    input:not([type="checkbox"]),
    select {
        font-family: inherit;
        font-size: 14px;
        padding: 6px 8px;
        border: 3px solid rgb(204, 204, 204);
        background-color: rgb(252, 252, 252);
        box-sizing: border-box;
        min-width: 0;
    }

    .row select {
        flex: 1;
    }

    .rowButton {
        font-family: inherit;
        font-size: 14px;
        padding: 6px 10px;
        border: 3px solid rgb(204, 204, 204);
        background-color: rgb(228, 228, 228);
        color: rgb(100, 100, 100);
        box-sizing: border-box;
    }

    .rowButton:hover {
        background-color: rgb(204, 204, 204);
        border-color: rgb(189, 189, 189);
        color: rgb(85, 85, 85);
        cursor: pointer;
    }

    .startClub {
        margin-top: 12px;
        padding: 12px;
    }

    .empty {
        margin: 0;
        color: rgb(100, 100, 100);
        font-size: 14px;
    }
</style>

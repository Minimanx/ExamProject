<script>
    import { apiFetch } from "../services/api.js";
    import { error, success } from "./toasts/toastThemes.js";
    import { playerMovement } from "../stores/stateManagementStore.js";

    let { friendsBool = $bindable(), socket } = $props();

    let username = $state("");
    let friends = $state([]);
    let incoming = $state([]);
    let outgoing = $state([]);
    let loading = $state(true);

    async function load() {
        const response = await apiFetch("/friends");
        if (!response.ok) {
            loading = false;
            return;
        }

        const { data } = await response.json();
        friends = data.friends;
        incoming = data.incoming;
        outgoing = data.outgoing;
        loading = false;
    }

    async function add() {
        const wanted = username.trim();
        if (!wanted) return;

        const response = await apiFetch("/friends", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: wanted }),
        });
        const result = await response.json();

        if (!response.ok) {
            error(result.message);
            return;
        }
        success(result.message);
        username = "";
        await load();
    }

    async function answer(id, accept) {
        const response = await apiFetch(`/friends/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accept }),
        });
        const result = await response.json();

        if (!response.ok) {
            error(result.message);
            return;
        }
        success(result.message);
        await load();
    }

    async function remove(id) {
        const response = await apiFetch(`/friends/${id}`, { method: "DELETE" });
        if (!response.ok) {
            error((await response.json()).message);
            return;
        }
        await load();
    }

    /**
     * Drive to where a friend is.
     *
     * Asked of the server rather than done here. The server holds the position
     * and refuses anything it could not have driven to, so a client-side jump is
     * exactly what it rejects — it performs the move and tells us where we
     * ended up, through the same correction event a refusal uses.
     *
     * The whereabouts call is only to explain a refusal: the server says nothing
     * when it declines, and "nothing happened" is a bad answer for a button.
     */
    async function joinFriend(id) {
        const response = await apiFetch(`/friends/${id}/whereabouts`);
        const result = await response.json();

        if (!response.ok) {
            error(result.message);
            return;
        }
        if (!result.data.online) {
            error("They are not online right now");
            return;
        }
        // Inside a theater is somewhere you are let into, not driven to.
        if (result.data.theaterId) {
            error("They are inside a theater");
            return;
        }
        if (!result.data.position) {
            error("They are not in the world right now");
            return;
        }

        socket.emit("joinFriend", { friendshipId: id });
        friendsBool = false;
    }

    void load();
</script>

<div class="container">
    <h2>Friends</h2>

    <div class="addFriend">
        <input
            name="friendUsername"
            type="text"
            bind:value={username}
            onfocus={() => ($playerMovement = false)}
            onblur={() => ($playerMovement = true)}
            placeholder="Add by username..."
            maxlength="16"
        />
        <button onclick={add}>Add</button>
    </div>

    {#if loading}
        <p class="empty">Loading...</p>
    {:else}
        {#if incoming.length > 0}
            <h3>Wants to be your friend</h3>
            <ul>
                {#each incoming as person (person.id)}
                    <li>
                        <span>{person.username}</span>
                        <button onclick={() => answer(person.id, true)}>Accept</button>
                        <button onclick={() => answer(person.id, false)}>Decline</button>
                    </li>
                {/each}
            </ul>
        {/if}

        <h3>Friends</h3>
        {#if friends.length === 0}
            <p class="empty">Nobody yet.</p>
        {:else}
            <ul>
                {#each friends as person (person.id)}
                    <li>
                        <span class="presence" class:online={person.online}></span>
                        <span>{person.username}</span>
                        <button disabled={!person.online} onclick={() => joinFriend(person.id)}>
                            Join
                        </button>
                        <button onclick={() => remove(person.id)}>Remove</button>
                    </li>
                {/each}
            </ul>
        {/if}

        {#if outgoing.length > 0}
            <h3>Asked</h3>
            <ul>
                {#each outgoing as person (person.id)}
                    <li>
                        <span>{person.username}</span>
                        <button onclick={() => remove(person.id)}>Cancel</button>
                    </li>
                {/each}
            </ul>
        {/if}
    {/if}

    <button class="menuButton" onclick={() => (friendsBool = false)}>Back</button>
</div>

<style>
    .container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 320px;
        max-height: 70vh;
        overflow-y: auto;
        padding: 16px;
        background: #ffffff;
        border: 2px solid #331b02;
        border-radius: 10px;
        font-size: 13px;
    }

    h2,
    h3 {
        margin: 0;
    }

    h3 {
        font-size: 13px;
        opacity: 0.7;
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    li {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    li span:nth-of-type(2),
    li span:only-of-type {
        flex: 1;
    }

    .addFriend {
        display: flex;
        gap: 4px;
    }

    .addFriend input {
        flex: 1;
        font-family: inherit;
    }

    /* Grey until they are actually connected, so "online" is a fact rather
       than a decoration. */
    .presence {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #8f8f8f;
    }

    .presence.online {
        background: #2f9e44;
    }

    .empty {
        margin: 0;
        opacity: 0.7;
    }
</style>

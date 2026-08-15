<script>
    import Panel from "./Panel.svelte";
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

<Panel title="Friends" onBack={() => (friendsBool = false)}>
    <div class="list">
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
            <button class="rowButton" onclick={add}>Add</button>
        </div>

        {#if loading}
            <p class="empty">Loading...</p>
        {:else}
            {#if incoming.length > 0}
                <h3>Wants to be your friend</h3>
                <ul>
                    {#each incoming as person (person.id)}
                        <li>
                            <span class="name">{person.username}</span>
                            <button class="rowButton" onclick={() => answer(person.id, true)}>
                                Accept
                            </button>
                            <button class="rowButton" onclick={() => answer(person.id, false)}>
                                Decline
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}

            <h3>Friends</h3>
            {#if friends.length === 0}
                <p class="empty">Nobody yet. Add someone by username above.</p>
            {:else}
                <ul>
                    {#each friends as person (person.id)}
                        <li>
                            <span class="presence" class:online={person.online}></span>
                            <span class="name">{person.username}</span>
                            <button
                                class="rowButton"
                                disabled={!person.online}
                                onclick={() => joinFriend(person.id)}
                            >
                                Join
                            </button>
                            <button class="rowButton" onclick={() => remove(person.id)}>
                                Remove
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}

            {#if outgoing.length > 0}
                <h3>Asked</h3>
                <ul>
                    {#each outgoing as person (person.id)}
                        <li>
                            <span class="name">{person.username}</span>
                            <button class="rowButton" onclick={() => remove(person.id)}>
                                Cancel
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}
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

    /* The same panel every other screen uses: it takes over the right-hand
       column rather than floating over the world in a different visual
       language. */

    /* Only the list scrolls, so the heading and the add field stay put however
       many friends there are. */

    h3 {
        margin: 8px 0 0;
        font-size: 14px;
        color: rgb(100, 100, 100);
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    li {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
    }

    .name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .addFriend {
        display: flex;
        gap: 6px;
    }

    .addFriend input {
        flex: 1;
        min-width: 0;
        font-family: inherit;
        font-size: 15px;
        padding: 6px 8px;
        border: 3px solid rgb(204, 204, 204);
        background-color: rgb(252, 252, 252);
        box-sizing: border-box;
    }

    /* Matches the chunky menu buttons, at a size that fits in a row. */
    .rowButton {
        font-family: inherit;
        font-size: 14px;
        padding: 6px 10px;
        border: 3px solid rgb(204, 204, 204);
        background-color: rgb(228, 228, 228);
        color: rgb(100, 100, 100);
        box-sizing: border-box;
    }

    .rowButton:hover:not(:disabled) {
        background-color: rgb(204, 204, 204);
        border-color: rgb(189, 189, 189);
        color: rgb(85, 85, 85);
        cursor: pointer;
    }

    .rowButton:disabled {
        opacity: 0.5;
    }

    /* Grey until they are actually connected, so "online" is a fact rather
       than a decoration. */
    .presence {
        width: 10px;
        height: 10px;
        flex: none;
        border-radius: 50%;
        background: rgb(150, 150, 150);
    }

    .presence.online {
        background: rgb(47, 158, 68);
    }

    .empty {
        margin: 0;
        color: rgb(100, 100, 100);
        font-size: 14px;
    }
</style>

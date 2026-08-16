<script>
    import Panel from "./Panel.svelte";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { apiFetch, createSocket } from "../services/api.js";
    import { user } from "../stores/userStore.js";
    import { error, success } from "./toasts/toastThemes.js";
    import { playerMovement } from "../stores/stateManagementStore.js";
    import { page } from "$app/state";

    const socket = createSocket();
    let { theater } = $props();
    // Carried in the invite link, not typed: the host shares
    // /theaters/<id>?key=<key> and the key rides along from there.
    let lobbyKey = $state("");
    let joining = $state(false);

    // A key in the URL is for whichever theater the link named, so it is only
    // used for that one — walking up to a different private lobby with someone
    // else's link in your address bar must not let you in.
    const keyFromLink = $derived(
        page.url.searchParams.get("theater") === theater._id
            ? (page.url.searchParams.get("key") ?? "")
            : ""
    );
    const keyForThisTheater = $derived(keyFromLink || lobbyKey);

    async function joinTheater() {
        if (joining) return;
        if (new Date(theater.timeToClose).getTime() < new Date().getTime()) {
            error("Theater is closed");
            return;
        }

        joining = true;
        try {
            const response = await apiFetch("/theaters/" + theater._id, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userID: $user.userID,
                    joining: true,
                    ...(keyForThisTheater && { lobbyKey: keyForThisTheater }),
                }),
            });

            const responseText = await response.text();
            let result = {};
            if (responseText) {
                try {
                    result = JSON.parse(responseText);
                } catch {
                    // Non-JSON body; the status code below is what matters.
                }
            }

            if (!response.ok) {
                error(result.message || `Unable to join theater (${response.status})`);
                return;
            }

            success(result.message || "Successfully joined lobby");
            socket.emit("joinedTheater");
            $user.insideTheater = true;
            goto(resolve("/theaters/[id]", { id: theater._id }));
        } catch {
            error("Unable to reach the server");
        } finally {
            joining = false;
        }
    }
</script>

<Panel>
    <div class="info">
        <div class="infoContainer">
            <div class="majorInfoContainer">
                <div class="majorTextContainer">
                    <h2>{theater.eventName}</h2>
                    <h3>{theater.movieName} ({theater.movieReleaseYear})</h3>
                    <h4>{theater.movieGenres}</h4>
                    <h4>Runtime: {theater.movieRuntime} min</h4>
                </div>
                <img src={theater.hrefPoster} alt="poster" />
            </div>

            <h4>{theater.moviePlot}</h4>

            <h4>IMDb rating: {theater.imdbRating}</h4>
            <h4>
                Starts: {new Date(theater.startTime).toLocaleString("en-US", {
                    weekday: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                })}
            </h4>
            <h4>
                {theater.usersInsideTheater.length}/{theater.amountOfSpaces}
                <svg width="22px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"
                    ><!--! Font Awesome Pro 6.1.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
                        d="M224 256c70.7 0 128-57.31 128-128S294.7 0 224 0C153.3 0 96 57.31 96 128S153.3 256 224 256zM274.7 304H173.3c-95.73 0-173.3 77.6-173.3 173.3C0 496.5 15.52 512 34.66 512H413.3C432.5 512 448 496.5 448 477.3C448 381.6 370.4 304 274.7 304zM479.1 320h-73.85C451.2 357.7 480 414.1 480 477.3C480 490.1 476.2 501.9 470 512h138C625.7 512 640 497.6 640 479.1C640 391.6 568.4 320 479.1 320zM432 256C493.9 256 544 205.9 544 144S493.9 32 432 32c-25.11 0-48.04 8.555-66.72 22.51C376.8 76.63 384 101.4 384 128c0 35.52-11.93 68.14-31.59 94.71C372.7 243.2 400.8 256 432 256z"
                    /></svg
                >
            </h4>
            {#if theater.isPrivate && keyFromLink}
                <!-- The key came with the link, so there is nothing to ask for.
                     An empty "Invite key" box here read as though there still
                     was, on the one path where the key was already in hand. -->
                <p class="privateNotice">Private event — your invite link opens this one</p>
            {:else if theater.isPrivate && !keyForThisTheater}
                <p class="privateNotice">Private event — you need the host's invite link</p>
            {:else if theater.isPrivate}
                <input
                    name="lobbyKey"
                    type="text"
                    bind:value={lobbyKey}
                    onfocus={() => ($playerMovement = false)}
                    onblur={() => ($playerMovement = true)}
                    placeholder="Invite key"
                />
            {/if}
        </div>
    </div>
    <button class="joinTheaterButton" onclick={joinTheater} disabled={joining}
        >{joining ? "Joining..." : "Join"}</button
    >
</Panel>

<style>
    h2 {
        margin: 0;
        word-break: break-word;
    }
    h3 {
        margin: 0;
    }
    h4 {
        margin: 0;
    }
    .majorTextContainer {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .majorInfoContainer {
        display: flex;
    }
    .infoContainer {
        height: 627px;
        margin: 10px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .joinTheaterButton {
        position: fixed;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 4px solid rgb(204, 204, 204);
        box-sizing: border-box;
        background-color: rgb(228, 228, 228);
        color: rgb(100, 100, 100);
        font-size: 20px;
        right: 10px;
        bottom: 0px;
        height: 60px;
        width: 478px;
    }
    .joinTheaterButton:hover {
        background-color: rgb(204, 204, 204);
        border: 4px solid rgb(189, 189, 189);
        color: rgb(85, 85, 85);
        cursor: pointer;
    }
    /* The panel owns the frame; this is how the sign's details sit in it. */
    .info {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        contain: content;
    }
    img {
        height: 310px;
    }
</style>

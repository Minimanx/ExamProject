<script>
    import { resolve } from "$app/paths";
    import { formatTimeOfDay } from "$lib/services/duration.js";

    let { data } = $props();

    const whenFor = (club) =>
        club.nextMeeting
            ? `${new Date(club.nextMeeting).toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
              })} at ${formatTimeOfDay(club.nextMeeting)}`
            : null;
</script>

<svelte:head>
    <title>Film clubs — FlixDrive</title>
    <meta name="description" content="Film clubs meeting on FlixDrive." />
</svelte:head>

<main class="directory">
    <h1>Film clubs</h1>

    {#if data.failed}
        <p class="empty">The club list could not be loaded. Try again in a moment.</p>
    {:else if data.clubs.length === 0}
        <p class="empty">No public clubs yet. The first one could be yours.</p>
    {:else}
        <ul>
            {#each data.clubs as club (club.id)}
                <li>
                    <a class="name" href={resolve(`/clubs/${club.slug}`)}>{club.name}</a>
                    {#if club.description}
                        <p class="description">{club.description}</p>
                    {/if}
                    <p class="meta">
                        {club.scheduleText}
                        <span class="members"
                            >· {club.members.length}
                            {club.members.length === 1 ? "member" : "members"}</span
                        >
                    </p>
                    {#if whenFor(club)}
                        <p class="next">
                            Next: {whenFor(club)} <span class="local">your time</span>
                        </p>
                    {/if}
                </li>
            {/each}
        </ul>
    {/if}

    <a class="enter" href={resolve("/")}>Enter FlixDrive</a>
</main>

<style>
    /* Same reasoning as a club page: this renders straight onto a body that is
       dark with dark text, which works elsewhere only because every panel in the
       app paints its own background. */
    .directory {
        display: block;
        max-width: 640px;
        margin: 0 auto;
        padding: 40px 20px 64px;
        color: rgb(27, 27, 27);
        line-height: 1.6;
    }

    :global(body:has(.directory)) {
        background-color: rgb(241, 241, 241);
    }

    h1 {
        margin: 0 0 20px;
        font-size: 26px;
        line-height: 1.35;
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .name {
        font-size: 16px;
        color: rgb(0, 80, 160);
    }

    .description,
    .meta,
    .next {
        margin: 4px 0 0;
        font-size: 13px;
    }

    .members,
    .local {
        color: rgb(110, 110, 110);
    }

    .local {
        font-size: 11px;
    }

    .empty {
        margin: 0;
        font-size: 14px;
        color: rgb(90, 90, 90);
    }

    .enter {
        display: inline-block;
        margin-top: 32px;
        padding: 12px 18px;
        font-size: 14px;
        color: rgb(27, 27, 27);
        background-color: rgb(228, 228, 228);
        border: 4px solid rgb(204, 204, 204);
    }

    .enter:hover {
        background-color: rgb(204, 204, 204);
        border-color: rgb(189, 189, 189);
        text-decoration: none;
    }

    @media (max-width: 480px) {
        .directory {
            padding: 24px 16px 48px;
        }

        h1 {
            font-size: 20px;
        }
    }
</style>

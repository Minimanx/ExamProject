<script>
    import { resolve } from "$app/paths";
    import { formatTimeOfDay } from "$lib/services/duration.js";

    let { data } = $props();
    const club = data.club;

    /**
     * The next meeting, on the reader's own clock.
     *
     * The club's schedule is kept in its own timezone — that is what makes it
     * mean the same thing after the clocks change — but a reader in another
     * country wants to know when that is for them.
     */
    const nextMeetingLocal = $derived(club.nextMeeting ? formatTimeOfDay(club.nextMeeting) : null);

    const nextMeetingDate = $derived(
        club.nextMeeting
            ? new Date(club.nextMeeting).toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
              })
            : null
    );
</script>

<svelte:head>
    <title>{club.name} — FlixDrive</title>
    <meta name="description" content={club.description || `${club.name} on FlixDrive`} />
</svelte:head>

<article class="club">
    <h1>{club.name}</h1>
    {#if club.description}
        <p class="description">{club.description}</p>
    {/if}

    <section>
        <h2>Meets</h2>
        <p>{club.scheduleText}</p>
        {#if nextMeetingDate}
            <p class="next">
                Next: {nextMeetingDate} at {nextMeetingLocal}
                <span class="yourTime">(your local time)</span>
            </p>
        {/if}
    </section>

    <section>
        <h2>Members ({club.members.length})</h2>
        <ul>
            {#each club.members as member (member.userID)}
                <li>
                    {member.username}
                    {#if member.role !== "member"}
                        <span class="role">{member.role}</span>
                    {/if}
                </li>
            {/each}
        </ul>
    </section>

    <a class="enter" href={resolve("/")}>Enter FlixDrive</a>
</article>

<style>
    /* A standalone page, not one of the app's panels. The body is dark with
       dark text — which works everywhere else because every panel paints its
       own light background — so a page rendered straight onto it came out
       near-black on near-black. */
    .club {
        max-width: 640px;
        margin: 0 auto;
        padding: 40px 20px 64px;
        color: rgb(27, 27, 27);
        line-height: 1.6;
    }

    :global(body:has(.club)) {
        background-color: rgb(241, 241, 241);
    }

    h1 {
        margin: 0 0 12px;
        font-size: 26px;
        line-height: 1.35;
    }

    h2 {
        font-size: 13px;
        margin: 28px 0 6px;
        color: rgb(100, 100, 100);
    }

    .description {
        margin: 0;
        font-size: 14px;
    }

    .next {
        margin: 6px 0 0;
        font-size: 14px;
    }

    .yourTime {
        color: rgb(110, 110, 110);
        font-size: 11px;
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        font-size: 14px;
    }

    li {
        padding: 3px 0;
    }

    .role {
        font-size: 10px;
        text-transform: uppercase;
        color: rgb(110, 110, 110);
        margin-left: 8px;
    }

    /* A link someone follows from a club page is most often on a phone, so it
       gets a target worth tapping rather than a line of text. */
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
        .club {
            padding: 24px 16px 48px;
        }

        h1 {
            font-size: 20px;
        }
    }
</style>

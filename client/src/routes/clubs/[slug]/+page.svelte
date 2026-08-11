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
                <span class="yourTime">your time</span>
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
    .club {
        max-width: 640px;
        margin: 0 auto;
        padding: 32px 16px;
        font-family: inherit;
    }

    h1 {
        margin: 0 0 8px;
    }

    h2 {
        font-size: 15px;
        margin: 24px 0 4px;
        opacity: 0.7;
    }

    .description {
        margin: 0;
    }

    .next {
        margin: 4px 0 0;
    }

    .yourTime {
        opacity: 0.6;
        font-size: 12px;
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    li {
        padding: 2px 0;
    }

    .role {
        font-size: 11px;
        text-transform: uppercase;
        opacity: 0.6;
        margin-left: 6px;
    }

    .enter {
        display: inline-block;
        margin-top: 24px;
    }
</style>

<script>
    import Panel from "./Panel.svelte";
    // Two-way: InteractiveSpace passes this with bind:, and back() writes to it
    // to close the panel. In runes mode that requires $bindable().
    let { aboutPageBool = $bindable() } = $props();

    function back() {
        aboutPageBool = false;
    }
</script>

<Panel onBack={back}>
    <div class="prose">
        <p>This webapp is a little project made for my 4th semester, Node.js elective.</p>
        <p>
            The assignment was to make a "passion project", with authentication/authorization,
            websockets and express.
        </p>
        <p>I chose to use Svelte for my front end, since I enjoy working with it.</p>
        <p>
            The purpose of this webapp, is for users to be able to watch movies together, with other
            people, while chatting. You could set up events for your friends, film clubs,
            communities or for anyone who wants to watch!
        </p>
        <p>
            You're only able to create one event at the time, per user. Events can only be created
            24 hours in advance.
        </p>
        <p>Hope you enjoy!</p>
    </div>
</Panel>

<style>
    /* The panel owns the frame; this is how prose sits in it — centred and
       spread down the column, which is what it looked like before this screen
       stopped carrying its own copy of the frame. */
    .prose {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-around;
        text-align: center;
        padding: 0 12px;
    }
</style>

<script>
	import { page } from "$app/state";
	import { user } from "$lib/stores/userStore.js";
	import InsideTheater from "$lib/pages/InsideTheater.svelte";
	import InteractiveSpace from "$lib/pages/InteractiveSpace.svelte";
</script>

<!-- The previous router guarded this route on the login state and fell through
     to the world otherwise; that behaviour is preserved exactly. -->
{#if $user.loggedIn === true}
	<InsideTheater id={page.params.id} />
{:else}
	<InteractiveSpace />
{/if}

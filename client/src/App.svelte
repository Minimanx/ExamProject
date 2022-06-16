<script>
	import { Router, Link, Route } from "svelte-navigator";
	import InteractiveSpace from "./pages/InteractiveSpace.svelte";
	import { SvelteToast } from "@zerodevx/svelte-toast";
	import InsideTheater from "./pages/InsideTheater.svelte";
	import { user } from "./stores/userStore.js";

</script>

<div class="toasts">
	<SvelteToast options={{ intro: { y: -500 } }} />
</div>

<Router>
	<main>
		<Route path="/" component={InteractiveSpace} />
		{#if $user.loggedIn === true}
			<Route path="/theaters/:id" component={InsideTheater} />
		{/if}

		<Route path="/*" component={InteractiveSpace} />
	</main>
</Router>

<style>
	main {
		user-select: none;
	}
	@media only screen and (max-width: 1500px) {
		main {
			zoom: 0.8;
		}
	}
	:root {
		--toastContainerTop: 8rem;
		--toastContainerRight: auto;
		--toastContainerBottom: auto;
		--toastContainerLeft: calc(50vw - 8rem);
  	}
</style>
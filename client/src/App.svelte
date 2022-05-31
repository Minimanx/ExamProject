<script>
import InteractiveSpace from "./pages/InteractiveSpace.svelte";
import { SvelteToast } from "@zerodevx/svelte-toast";

</script>

<div class="toasts">
	<SvelteToast options={{ intro: { y: -500 } }} />
</div>


<main>
	<InteractiveSpace />
</main>

<style>
	@media only screen and (max-width: 1500px) {
		main {
			zoom: 0.8;
		}
	}
	.toasts {
		font-family: 'Press Start 2P', cursive;
	}
	:root {
		--toastContainerTop: 8rem;
		--toastContainerRight: auto;
		--toastContainerBottom: auto;
		--toastContainerLeft: calc(50vw - 8rem);
  	}
</style>
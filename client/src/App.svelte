<script>
	import { onMount } from "svelte";
	import { Router, Route } from "svelte-navigator";
	import InteractiveSpace from "./pages/InteractiveSpace.svelte";
	import { SvelteToast } from "@zerodevx/svelte-toast";
	import InsideTheater from "./pages/InsideTheater.svelte";
	import { user } from "./stores/userStore.js";

	const stageWidth = 1500;
	const stageHeight = 800;

	function getStageScale() {
		const viewport = window.visualViewport;
		const viewportWidth = viewport?.width || window.innerWidth;
		const viewportHeight = viewport?.height || window.innerHeight;

		return Math.min(1, viewportWidth / stageWidth, viewportHeight / stageHeight);
	}

	let stageScale = getStageScale();

	onMount(() => {
		function updateStageScale() {
			stageScale = getStageScale();
		}

		window.addEventListener("resize", updateStageScale);
		window.visualViewport?.addEventListener("resize", updateStageScale);

		return () => {
			window.removeEventListener("resize", updateStageScale);
			window.visualViewport?.removeEventListener("resize", updateStageScale);
		};
	});
</script>

<div class="toasts">
	<SvelteToast options={{ intro: { y: -500 } }} />
</div>

<Router>
	<main style="--stage-scale: {stageScale};">
		<Route path="/" component={InteractiveSpace} />
		{#if $user.loggedIn === true}
			<Route path="/theaters/:id" component={InsideTheater} />
		{/if}

		<Route path="/*" component={InteractiveSpace} />
	</main>
</Router>

<style>
	main {
		width: 1500px;
		height: 800px;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) scale(var(--stage-scale));
		transform-origin: center;
		user-select: none;
		will-change: transform;
	}
	:root {
		--toastContainerTop: 8rem;
		--toastContainerRight: auto;
		--toastContainerBottom: auto;
		--toastContainerLeft: calc(50vw - 8rem);
  	}
</style>

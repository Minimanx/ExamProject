<script>
	import { onMount } from "svelte";
	import { Router, Route } from "svelte-navigator";
	import InteractiveSpace from "./pages/InteractiveSpace.svelte";
	import { SvelteToast } from "@zerodevx/svelte-toast";
	import InsideTheater from "./pages/InsideTheater.svelte";
	import { user } from "./stores/userStore.js";

	const stageWidth = 1500;
	const stageHeight = 800;

	function getStageLayout() {
		const viewport = window.visualViewport;
		const viewportWidth = viewport?.width || window.innerWidth;
		const viewportHeight = viewport?.height || window.innerHeight;
		const scale = Math.min(viewportWidth / stageWidth, viewportHeight / stageHeight);
		const height = viewportHeight / scale;

		return {
			scale,
			height,
			sceneOffset: Math.max(0, height - stageHeight),
		};
	}

	let stageLayout = getStageLayout();

	onMount(() => {
		function updateStageLayout() {
			stageLayout = getStageLayout();
		}

		window.addEventListener("resize", updateStageLayout);
		window.visualViewport?.addEventListener("resize", updateStageLayout);

		return () => {
			window.removeEventListener("resize", updateStageLayout);
			window.visualViewport?.removeEventListener("resize", updateStageLayout);
		};
	});
</script>

<div class="toasts">
	<SvelteToast options={{ intro: { y: -500 } }} />
</div>

<Router>
	<main
		style="--stage-scale: {stageLayout.scale}; --stage-height: {stageLayout.height}px; --scene-offset: {stageLayout.sceneOffset}px;"
	>
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
		height: var(--stage-height);
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

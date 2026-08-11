<script>
    import { SvelteToast } from "@zerodevx/svelte-toast";

    let { children } = $props();
</script>

<div class="toasts">
    <SvelteToast options={{ intro: { y: -500 } }} />
</div>

{@render children()}

<style>
    :root {
        --toastContainerTop: 8rem;
        --toastContainerRight: auto;
        --toastContainerBottom: auto;
        --toastContainerLeft: calc(50vw - 8rem);
    }
</style>

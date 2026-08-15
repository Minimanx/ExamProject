<script>
    /**
     * The right-hand panel every screen in the world opens into.
     *
     * Five components carried their own copy of this frame — the same position,
     * size, borders, colours, and the same Back button pinned to the same
     * corner. That is five places to keep in step, and it had already drifted
     * once: the friends screen arrived as a plain white box floating over pixel
     * art, because a copy is easy to forget to make.
     *
     * It owns the frame and the way out, and deliberately nothing else. The
     * screens inside lay themselves out differently — a scrolling list, a
     * centred form, a spread of sections — and folding those into props here
     * would trade five copies of some CSS for one component with a flag per
     * caller.
     */
    let { title = "", onBack = null, backLabel = "Back", children } = $props();
</script>

<div class="panel" class:hasBack={onBack}>
    {#if title}
        <h2>{title}</h2>
    {/if}
    {@render children()}
</div>

{#if onBack}
    <button class="panelBack" onclick={onBack}>{backLabel}</button>
{/if}

<style>
    .panel {
        position: fixed;
        background-color: rgb(241, 241, 241);
        z-index: 100;
        right: 0;
        top: 80px;
        height: calc(var(--stage-height) - 80px);
        width: 500px;
        border-top: 3px solid rgb(27, 27, 27);
        border-left: 3px solid rgb(27, 27, 27);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
    }

    /* The padding exists because of the button, so it comes with it. A panel
       without a way out — the theater sign you drive up to, which closes when
       you drive away — has nothing down there to clear. */
    .hasBack {
        padding-bottom: 80px;
    }

    h2 {
        margin: 0;
        padding: 12px 12px 0;
        font-size: 22px;
        text-align: center;
    }

    .panelBack {
        position: fixed;
        right: 10px;
        bottom: 0;
        height: 60px;
        width: 235px;
        z-index: 101;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: inherit;
        font-size: 20px;
        border: 4px solid rgb(204, 204, 204);
        box-sizing: border-box;
        background-color: rgb(228, 228, 228);
        color: rgb(100, 100, 100);
    }

    .panelBack:hover {
        background-color: rgb(204, 204, 204);
        border-color: rgb(189, 189, 189);
        color: rgb(85, 85, 85);
        cursor: pointer;
    }
</style>

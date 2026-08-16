/**
 * A colour a client sent, made safe to hand to every other client.
 *
 * A car's colour and a chat message's colour both come from the client and are
 * broadcast to everyone in the lobby. The chat one is rendered into a style
 * attribute — `style="color: {message.color}"` — and nothing checked that it was
 * a colour. It is a whole run of CSS declarations if the sender says so:
 *
 *     "red; position: fixed; top: 0; left: 0; width: 100vw;
 *      height: 100vh; background: black; z-index: 9999"
 *
 * which is a black rectangle over the screen of everyone in the theater, sent by
 * anyone in it. Loading a remote `url()` from the same place quietly reports
 * every viewer's address to whoever asked for it.
 *
 * Escaping is not the fix. The value is interpolated inside a quoted attribute,
 * so the quotes are already escaped and there is no tag to break out of — the
 * injection is CSS into a place that legitimately holds CSS. Only "is this
 * actually a colour" answers it.
 *
 * Three- and six-digit hex, because that is what a colour input produces and
 * what the app has always sent. Anything else becomes the default rather than
 * being dropped: a message with no colour renders as unstyled text, which looks
 * like a bug rather than like a refusal.
 */

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** The grey the server's own system messages use. */
export const DEFAULT_COLOR = "#646464";

export function safeColor(value) {
    return typeof value === "string" && HEX_COLOR.test(value) ? value : DEFAULT_COLOR;
}

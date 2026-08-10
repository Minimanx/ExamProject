import {
    $ as e,
    C as t,
    J as n,
    R as r,
    W as i,
    X as a,
    Y as o,
    Z as s,
    ct as c,
    et as l,
    h as u,
    j as d,
    k as f,
    lt as p,
    mt as m,
    pt as h,
    r as g,
} from "../chunks/DMBGR548.js";
import "../chunks/xihTtKlq.js";
import { t as _ } from "../chunks/DBPkbVYH.js";
var v = m({ prerender: () => !1, ssr: () => !1 }),
    y = d(`<div class="toasts"><!></div> <main class="svelte-12qhfyh"><!></main>`, 1);
function b(d, m) {
    p(m, !0);
    function v() {
        let e = window.visualViewport,
            t = e?.width || window.innerWidth,
            n = e?.height || window.innerHeight,
            r = Math.min(t / 1500, n / 800),
            i = n / r;
        return { scale: r, height: i, width: t / r, sceneOffset: Math.max(0, i - 800) };
    }
    let b = l(s(v()));
    g(() => {
        function t() {
            e(b, v(), !0);
        }
        return (
            window.addEventListener(`resize`, t),
            window.visualViewport?.addEventListener(`resize`, t),
            () => {
                (window.removeEventListener(`resize`, t),
                    window.visualViewport?.removeEventListener(`resize`, t));
            }
        );
    });
    var x = y(),
        S = o(x),
        C = n(S);
    (_(C, { options: { intro: { y: -500 } } }), h(S));
    var w = a(S, 2),
        T = n(w);
    (t(T, () => m.children),
        h(w),
        i(() =>
            u(
                w,
                `--stage-scale: ${r(b).scale ?? ``}; --stage-height: ${r(b).height ?? ``}px; --stage-width: ${r(b).width ?? ``}px; --scene-offset: ${r(b).sceneOffset ?? ``}px;`
            )
        ),
        f(d, x),
        c());
}
export { b as component, v as universal };

import {
    $ as e,
    A as t,
    D as n,
    H as r,
    I as i,
    J as a,
    L as o,
    Q as s,
    R as c,
    S as l,
    T as u,
    U as d,
    V as f,
    W as p,
    X as m,
    Y as h,
    _ as g,
    a as _,
    b as v,
    ct as y,
    dt as b,
    g as x,
    h as S,
    j as C,
    k as w,
    lt as T,
    m as E,
    n as ee,
    nt as D,
    o as te,
    ot as O,
    pt as k,
    r as ne,
    rt as A,
    s as j,
    v as M,
    w as re,
    x as N,
    y as P,
} from "./DMBGR548.js";
import "./BhJxURJ-.js";
import "./xihTtKlq.js";
b();
var F = (e) => e;
function I(e) {
    let t = e - 1;
    return t * t * t + 1;
}
function L(e) {
    let t = typeof e == `string` && e.match(/^\s*(-?[\d.]+)([^\s]*)\s*$/);
    return t ? [parseFloat(t[1]), t[2] || `px`] : [e, `px`];
}
function R(e, { delay: t = 0, duration: n = 400, easing: r = F } = {}) {
    let i = +getComputedStyle(e).opacity;
    return { delay: t, duration: n, easing: r, css: (e) => `opacity: ${e * i}` };
}
function z(
    e,
    { delay: t = 0, duration: n = 400, easing: r = I, x: i = 0, y: a = 0, opacity: o = 0 } = {}
) {
    let s = getComputedStyle(e),
        c = +s.opacity,
        l = s.transform === `none` ? `` : s.transform,
        u = c * (1 - o),
        [d, f] = L(i),
        [p, m] = L(a);
    return {
        delay: t,
        duration: n,
        easing: r,
        css: (e, t) => `
			transform: ${l} translate(${(1 - e) * d}${f}, ${(1 - e) * p}${m});
			opacity: ${c - u * t}`,
    };
}
function B(e) {
    return e;
}
function V(e) {
    let t = e - 1;
    return t * t * t + 1;
}
function H(e, { from: t, to: n }, r = {}) {
    var { delay: i = 0, duration: a = (e) => Math.sqrt(e) * 120, easing: o = V } = r,
        s = getComputedStyle(e),
        c = s.transform === `none` ? `` : s.transform,
        [l, u] = s.transformOrigin.split(` `).map(parseFloat);
    ((l /= e.clientWidth), (u /= e.clientHeight));
    var d = U(e),
        f = e.clientWidth / n.width / d,
        p = e.clientHeight / n.height / d,
        m = t.left + t.width * l,
        h = t.top + t.height * u,
        g = n.left + n.width * l,
        _ = n.top + n.height * u,
        v = (m - g) * f,
        y = (h - _) * p,
        b = t.width / n.width,
        x = t.height / n.height;
    return {
        delay: i,
        duration: typeof a == `function` ? a(Math.sqrt(v * v + y * y)) : a,
        easing: o,
        css: (e, t) =>
            `transform: ${c} translate(${t * v}px, ${t * y}px) scale(${e + t * b}, ${e + t * x});`,
    };
}
function U(e) {
    if (`currentCSSZoom` in e) return e.currentCSSZoom;
    for (var t = e, n = 1; t !== null;) ((n *= +getComputedStyle(t).zoom), (t = t.parentElement));
    return n;
}
var W = {
    duration: 4e3,
    initial: 1,
    next: 0,
    pausable: !1,
    dismissable: !0,
    reversed: !1,
    intro: { x: 256 },
};
function G() {
    let { subscribe: e, update: t } = O([]),
        n = {},
        r = 0;
    function i(e) {
        return e instanceof Object;
    }
    function a(e = `default`, t = {}) {
        return ((n[e] = t), n);
    }
    function o(e, a) {
        let o = { target: `default`, ...(i(e) ? e : { ...a, msg: e }) },
            s = n[o.target] || {},
            c = {
                ...W,
                ...s,
                ...o,
                theme: { ...s.theme, ...o.theme },
                classes: [...(s.classes || []), ...(o.classes || [])],
                id: ++r,
            };
        return (t((e) => (c.reversed ? [...e, c] : [c, ...e])), r);
    }
    function s(e) {
        t((t) => {
            if (!t.length || e === 0) return [];
            if (typeof e == `function`) return t.filter((t) => e(t));
            if (i(e)) return t.filter((t) => t.target !== e.target);
            let n = e || Math.max(...t.map((e) => e.id));
            return t.filter((e) => e.id !== n);
        });
    }
    function c(e, n) {
        let r = i(e) ? e : { ...n, id: e };
        t((e) => {
            let t = e.findIndex((e) => e.id === r.id);
            return (t > -1 && (e[t] = { ...e[t], ...r }), e);
        });
    }
    return { subscribe: e, push: o, pop: s, set: c, _init: a };
}
var K = G();
function q(e) {
    return Object.prototype.toString.call(e) === `[object Date]`;
}
function J(e, t) {
    if (e === t || e !== e) return () => e;
    let n = typeof e;
    if (n !== typeof t || Array.isArray(e) !== Array.isArray(t))
        throw Error(`Cannot interpolate values of different type`);
    if (Array.isArray(e)) {
        let n = t.map((t, n) => J(e[n], t));
        return (e) => n.map((t) => t(e));
    }
    if (n === `object`) {
        if (!e || !t) throw Error(`Object cannot be null`);
        if (q(e) && q(t)) {
            let n = e.getTime(),
                r = t.getTime() - n;
            return (e) => new Date(n + e * r);
        }
        let n = Object.keys(t),
            r = {};
        return (
            n.forEach((n) => {
                r[n] = J(e[n], t[n]);
            }),
            (e) => {
                let t = {};
                return (
                    n.forEach((n) => {
                        t[n] = r[n](e);
                    }),
                    t
                );
            }
        );
    }
    if (n === `number`) {
        let n = t - e;
        return (t) => e + t * n;
    }
    return () => t;
}
function ie(e, t = {}) {
    let n = O(e),
        r,
        i = e;
    function a(a, o) {
        if (((i = a), e == null)) return (n.set((e = a)), Promise.resolve());
        let s = r,
            c = !1,
            { delay: l = 0, duration: u = 400, easing: d = B, interpolate: f = J } = { ...t, ...o };
        if (u === 0) return ((s &&= (s.abort(), null)), n.set((e = i)), Promise.resolve());
        let p = N.now() + l,
            m;
        return (
            (r = v((t) => {
                if (t < p) return !0;
                ((c ||= ((m = f(e, a)), typeof u == `function` && (u = u(e, a)), !0)),
                    (s &&= (s.abort(), null)));
                let r = t - p;
                return r > u ? (n.set((e = a)), !1) : (n.set((e = m(d(r / u)))), !0);
            })),
            r.promise
        );
    }
    return { set: a, update: (t, n) => a(t(i, e), n), subscribe: n.subscribe };
}
var ae = C(`<div class="_toastBtn pe svelte-1irx82o" role="button" tabindex="0"></div>`),
    oe = C(
        `<div role="status"><div><!></div> <!> <progress class="_toastBar svelte-1irx82o"></progress></div>`
    );
function Y(u, g) {
    T(g, !1);
    let v = () => A(L, `$progress`, b),
        [b, S] = D(),
        C = _(g, `item`, 12),
        O = s(C().initial),
        M = s(c(O)),
        N = s(!1),
        P = s({}),
        F,
        I,
        L = ie(C().initial, { duration: C().duration, easing: B });
    function R(e) {
        (e && (I = e), K.pop(C().id));
    }
    function z() {
        (v() === 1 || v() === 0) && R();
    }
    function V() {
        !c(N) && v() !== c(O) && (L.set(v(), { duration: 0 }), e(N, !0));
    }
    function H() {
        if (c(N)) {
            let t = C().duration,
                n = t - t * ((v() - c(M)) / (c(O) - c(M)));
            (L.set(c(O), { duration: n }).then(z), e(N, !1));
        }
    }
    function U(e, t = `undefined`) {
        return typeof e === t;
    }
    function W(e = document) {
        if (U(e.hidden)) return;
        let t = () => (e.hidden ? V() : H()),
            n = `visibilitychange`;
        (e.addEventListener(n, t), (F = () => e.removeEventListener(n, t)), t());
    }
    (ne(W),
        ee(() => {
            (C().onpop && C().onpop(C().id, { event: I }), F && F());
        }),
        r(
            () => (c(O), o(C()), v()),
            () => {
                c(O) !== C().next && (e(O, C().next), e(M, v()), e(N, !1), L.set(c(O)).then(z));
            }
        ),
        r(
            () => o(C()),
            () => {
                if (C().component) {
                    let { props: t = {}, sendIdTo: n } = C().component;
                    e(P, { ...t, ...(n && { [n]: C().id }) });
                }
            }
        ),
        r(
            () => o(C()),
            () => {
                U(C().progress) || C((C().next = C().progress), !0);
            }
        ),
        d(),
        j());
    var G = oe();
    let q;
    var J = a(G);
    let Y;
    var X = a(J),
        Z = (e) => {
            var n = t(),
                r = h(n);
            (l(
                r,
                () => C().component.src,
                (e, t) => {
                    t(
                        e,
                        te(() => c(P))
                    );
                }
            ),
                w(e, n));
        },
        Q = (e) => {
            var n = t(),
                r = h(n);
            (re(r, () => (o(C()), f(() => C().msg))), w(e, n));
        };
    (n(X, (e) => {
        (o(C()), f(() => C().component) ? e(Z) : e(Q, -1));
    }),
        k(J));
    var $ = m(J, 2),
        se = (e) => {
            var t = ae();
            (i(`click`, t, (e) => R(e)),
                i(`keydown`, t, (e) => {
                    e instanceof KeyboardEvent && [`Enter`, ` `].includes(e.key) && R(e);
                }),
                w(e, t));
        };
    n($, (e) => {
        (o(C()), f(() => C().dismissable) && e(se));
    });
    var ce = m($, 2);
    (k(G),
        p(() => {
            ((q = x(G, 1, `_toastItem svelte-1irx82o`, null, q, { pe: C().pausable })),
                (Y = x(J, 1, `_toastMsg svelte-1irx82o`, null, Y, { pe: C().component })),
                E(ce, v()));
        }),
        i(`mouseenter`, G, () => {
            C().pausable && V();
        }),
        i(`mouseleave`, G, H),
        w(u, G),
        y(),
        S());
}
var X = C(`<li><!></li>`),
    Z = C(`<ul class="_toastContainer svelte-1dwp7pi"></ul>`);
function Q(t, n) {
    T(n, !1);
    let i = () => A(K, `$toast`, l),
        [l, m] = D(),
        h = _(n, `options`, 24, () => ({})),
        v = _(n, `target`, 8, `default`),
        b = s([]);
    function C(e) {
        return e ? Object.keys(e).reduce((t, n) => `${t}${n}:${e[n]};`, ``) : void 0;
    }
    (r(
        () => (o(v()), o(h())),
        () => {
            K._init(v(), h());
        }
    ),
        r(
            () => (i(), o(v())),
            () => {
                e(
                    b,
                    i().filter((e) => e.target === v())
                );
            }
        ),
        d(),
        j());
    var E = Z();
    (u(
        E,
        13,
        () => c(b),
        (e) => e.id,
        (e, t) => {
            var n = X();
            (Y(a(n), {
                get item() {
                    return c(t);
                },
            }),
                k(n),
                p(
                    (e, t) => {
                        (x(n, 1, e, `svelte-1dwp7pi`), S(n, t));
                    },
                    [
                        () => g((c(t), f(() => c(t).classes?.join(` `)))),
                        () => (c(t), f(() => C(c(t).theme))),
                    ]
                ),
                P(
                    1,
                    n,
                    () => z,
                    () => c(t).intro
                ),
                P(2, n, () => R),
                M(
                    n,
                    () => H,
                    () => ({ duration: 200 })
                ),
                w(e, n));
        }
    ),
        k(E),
        w(t, E),
        y(),
        m());
}
export { K as n, Q as t };

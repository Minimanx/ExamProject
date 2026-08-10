import {
    $ as e,
    A as t,
    D as n,
    E as r,
    F as i,
    I as a,
    J as o,
    O as s,
    P as c,
    R as l,
    T as u,
    W as d,
    X as f,
    Y as p,
    Z as m,
    c as h,
    ct as g,
    d as ee,
    et as _,
    f as te,
    h as v,
    j as y,
    k as b,
    lt as x,
    nt as S,
    pt as C,
    r as w,
    rt as T,
    s as E,
    tt as D,
} from "../chunks/DMBGR548.js";
import "../chunks/xihTtKlq.js";
import "../chunks/DBPkbVYH.js";
import { t as O } from "../chunks/CvRJ_r6W.js";
import { a as k, i as A, n as j, o as M, r as N, s as P, t as F } from "../chunks/Dz2lUSOE.js";
var I = y(`<h1>Starts in:</h1> <h1> </h1>`, 1),
    ne = y(`<h1>Ongoing:</h1> <h1> </h1>`, 1),
    re = y(`<h1>Closing in:</h1> <h1> </h1>`, 1),
    ie = y(`<h1>Closed</h1>`),
    ae = y(
        `<button class="menuButton svelte-1sq95i5" id="deleteTheaterButton" title="Delete theater"><svg width="40px" xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 20 23" shape-rendering="crispEdges"><path stroke="rgb(100, 100, 100)" d="M6 0h8M6 1h8M4 2h2M14 2h2M4 3h2M14 3h2M1 4h18M1 5h18M0 6h2M18 6h2M1 7h18M1 8h18M1 9h2M17 9h2M1 10h2M17 10h2M1 11h2M17 11h2M1 12h2M5 12h2M9 12h2M13 12h2M17 12h2M1 13h2M5 13h2M9 13h2M13 13h2M17 13h2M1 14h2M5 14h2M9 14h2M13 14h2M17 14h2M2 15h2M5 15h2M9 15h2M13 15h2M16 15h2M2 16h2M5 16h2M9 16h2M13 16h2M16 16h2M2 17h2M5 17h2M9 17h2M13 17h2M16 17h2M2 18h2M5 18h2M9 18h2M13 18h2M16 18h2M2 19h2M5 19h2M9 19h2M13 19h2M16 19h2M2 20h2M16 20h2M2 21h16M3 22h14"></path></svg></button>`
    ),
    oe = y(
        `<div class="wholeMessage svelte-1sq95i5"><ul class="svelte-1sq95i5"><div class="messageInfo svelte-1sq95i5"><li> </li> <li class="timeStamp svelte-1sq95i5"> </li></div> <li> </li></ul></div>`
    ),
    se = y(
        `<div class="movieInfoContainer svelte-1sq95i5"><div class="timeOfMovie svelte-1sq95i5"><!></div></div> <div class="liveChatContainer svelte-1sq95i5"><div class="topBar svelte-1sq95i5"><button class="menuButton svelte-1sq95i5" id="leaveTheaterButton" title="Leave theater"><svg width="40px" xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 19 23" shape-rendering="crispEdges"><path stroke="rgb(100, 100, 100)" d="M0 0h15M0 1h15M0 2h6M13 2h2M0 3h2M4 3h4M13 3h2M0 4h2M6 4h4M13 4h2M0 5h2M8 5h2M13 5h2M0 6h2M8 6h2M13 6h2M0 7h2M8 7h2M13 7h2M0 8h2M8 8h2M13 8h2M0 9h2M8 9h2M16 9h2M0 10h2M8 10h2M11 10h8M0 11h2M8 11h2M11 11h8M0 12h2M8 12h2M16 12h2M0 13h2M8 13h2M13 13h2M0 14h2M8 14h2M13 14h2M0 15h2M8 15h2M13 15h2M0 16h2M8 16h2M13 16h2M0 17h2M8 17h2M13 17h2M0 18h2M8 18h7M0 19h4M8 19h7M2 20h4M8 20h2M4 21h6M6 22h4"></path></svg></button> <button class="menuButton svelte-1sq95i5" id="inviteToTheaterButton" title="Copy invite link"><svg width="40px" xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 19 23" shape-rendering="crispEdges"><path stroke="rgb(100, 100, 100)" d="M0 0h15M0 1h15M0 2h2M13 2h2M0 3h2M13 3h2M0 4h2M4 4h15M0 5h2M4 5h15M0 6h2M4 6h2M17 6h2M0 7h2M4 7h2M17 7h2M0 8h2M4 8h2M17 8h2M0 9h2M4 9h2M17 9h2M0 10h2M4 10h2M17 10h2M0 11h2M4 11h2M17 11h2M0 12h2M4 12h2M17 12h2M0 13h2M4 13h2M17 13h2M0 14h2M4 14h2M17 14h2M0 15h2M4 15h2M17 15h2M0 16h2M4 16h2M17 16h2M0 17h2M4 17h2M17 17h2M0 18h6M17 18h2M0 19h6M17 19h2M4 20h2M17 20h2M4 21h15M4 22h15"></path></svg></button> <!></div> <div class="liveChat svelte-1sq95i5"></div> <div class="messageDiv svelte-1sq95i5"><form><input class="messageInput svelte-1sq95i5" type="text" maxlength="200"/> <button class="messageButton menuButton svelte-1sq95i5">></button></form></div></div>`,
        1
    ),
    L = y(`<div id="loadingSpinner" class="svelte-1sq95i5"><!></div>`),
    R = y(`<div class="container svelte-1sq95i5"><!></div>`);
function z(c, y) {
    x(y, !0);
    let E = () => T(k, `$user`, O),
        [O, F] = S(),
        z = P(),
        B = _(void 0),
        V = _(m([])),
        H = _(void 0),
        U = _(void 0),
        W = _(void 0),
        G = _(void 0),
        K = _(void 0),
        q = _(void 0),
        J = _(void 0),
        Y = _(m(new Date())),
        X;
    function Z({ text: t, username: n, color: r }) {
        (e(V, [...l(V), { text: t, time: new Date(), username: n, color: r }], !0),
            cancelAnimationFrame(X),
            (X = requestAnimationFrame(() => {
                l(W) && (l(W).scrollTop = l(W).scrollHeight);
            })));
    }
    function Q() {
        l(B) &&
            (e(Y, new Date(), !0),
            e(G, new Date(l(Y).getTime() - 36e5 - new Date(l(B).startTime).getTime()), !0),
            e(K, l(G).getHours(), !0),
            e(q, l(G).getMinutes(), !0),
            e(J, l(G).getSeconds(), !0));
    }
    w(() => {
        let t = !0;
        (z.on(`newMessage`, Z), z.emit(`enteredTheater`, { theaterId: y.id }));
        async function n() {
            let n = await (await M(`/theaters/` + y.id)).json();
            t && (e(B, n.data, !0), Q());
        }
        n().catch((e) => console.error(`Failed to load theater`, e));
        let r = setInterval(Q, 1e3);
        return () => {
            ((t = !1),
                clearInterval(r),
                cancelAnimationFrame(X),
                z.off(`newMessage`, Z),
                z.emit(`leftTheater`));
        };
    });
    function ce() {
        !l(H) ||
            !l(H).trim().length ||
            (z.emit(`sendNewMessage`, { sendMessage: l(H), color: E().playerColor }),
            e(H, ``),
            l(U)?.focus());
    }
    function le() {
        window.location.href = `/`;
    }
    function ue() {
        (navigator.clipboard.writeText(`${window.location.origin}?position=${l(B).position}`),
            A(`Invite link copied to clipboard!`));
    }
    async function de() {
        let e = await M(`/theaters/` + l(B)._id, { method: `DELETE` }),
            t = await e.json();
        (e.status === 400 && N(t.message), e.status === 200 && (window.location.href = `/`));
    }
    var $ = R(),
        fe = o($),
        pe = (c) => {
            var m = se(),
                g = p(m),
                _ = o(g),
                y = o(_),
                x = (e) => {
                    var t = I(),
                        n = f(p(t), 2),
                        r = o(n);
                    (C(n),
                        d(
                            (e, t, n) => s(r, `${e ?? ``}:${t ?? ``}:${n ?? ``}`),
                            [
                                () =>
                                    (new Date(
                                        new Date(l(B).startTime).getTime() - 36e5 - l(Y).getTime()
                                    ).getHours() < 10
                                        ? `0`
                                        : ``) +
                                    String(
                                        new Date(
                                            new Date(l(B).startTime).getTime() -
                                                36e5 -
                                                l(Y).getTime()
                                        ).getHours()
                                    ),
                                () =>
                                    (new Date(
                                        new Date(l(B).startTime).getTime() - l(Y).getTime()
                                    ).getMinutes() < 10
                                        ? `0`
                                        : ``) +
                                    new Date(
                                        new Date(l(B).startTime).getTime() - l(Y).getTime()
                                    ).getMinutes(),
                                () =>
                                    (new Date(
                                        new Date(l(B).startTime).getTime() - l(Y).getTime()
                                    ).getSeconds() < 10
                                        ? `0`
                                        : ``) +
                                    new Date(
                                        new Date(l(B).startTime).getTime() - l(Y).getTime()
                                    ).getSeconds(),
                            ]
                        ),
                        b(e, t));
                },
                S = D(() => l(Y).getTime() < new Date(l(B).startTime).getTime()),
                w = (e) => {
                    var t = ne(),
                        n = f(p(t), 2),
                        r = o(n);
                    (C(n),
                        d(() =>
                            s(
                                r,
                                `${(l(K) < 10 ? `0` + l(K) : l(K)) ?? ``}:${(l(q) < 10 ? `0` + l(q) : l(q)) ?? ``}:${(l(J) < 10 ? `0` + l(J) : l(J)) ?? ``}`
                            )
                        ),
                        b(e, t));
                },
                T = D(
                    () =>
                        l(Y).getTime() > new Date(l(B).startTime).getTime() &&
                        l(Y).getTime() < new Date(l(B).timeToClose).getTime() - 9e5
                ),
                O = (e) => {
                    var t = re(),
                        n = f(p(t), 2),
                        r = o(n);
                    (C(n),
                        d(
                            (e, t, n) => s(r, `${e ?? ``}:${t ?? ``}:${n ?? ``}`),
                            [
                                () =>
                                    (new Date(
                                        new Date(l(B).timeToClose).getTime() - 36e5 - new Date(l(Y))
                                    ).getHours() < 10
                                        ? `0`
                                        : ``) +
                                    String(
                                        new Date(
                                            new Date(l(B).timeToClose).getTime() -
                                                36e5 -
                                                new Date(l(Y))
                                        ).getHours()
                                    ),
                                () =>
                                    (new Date(
                                        new Date(l(B).timeToClose).getTime() - new Date(l(Y))
                                    ).getMinutes() < 10
                                        ? `0`
                                        : ``) +
                                    String(
                                        new Date(
                                            new Date(l(B).timeToClose).getTime() - new Date(l(Y))
                                        ).getMinutes()
                                    ),
                                () =>
                                    (new Date(
                                        new Date(l(B).timeToClose).getTime() - new Date(l(Y))
                                    ).getSeconds() < 10
                                        ? `0`
                                        : ``) +
                                    String(
                                        new Date(
                                            new Date(l(B).timeToClose).getTime() - new Date(l(Y))
                                        ).getSeconds()
                                    ),
                            ]
                        ),
                        b(e, t));
                },
                k = D(
                    () =>
                        l(Y).getTime() > new Date(l(B).timeToClose).getTime() - 9e5 &&
                        l(Y).getTime() < new Date(l(B).timeToClose).getTime()
                ),
                A = (e) => {
                    var t = ie();
                    b(e, t);
                };
            (n(y, (e) => {
                l(S) ? e(x) : l(T) ? e(w, 1) : l(k) ? e(O, 2) : e(A, -1);
            }),
                C(_),
                C(g));
            var j = f(g, 2),
                M = o(j),
                N = o(M),
                P = f(N, 2),
                F = f(P, 2),
                L = (e) => {
                    var r = t(),
                        a = p(r),
                        o = (e) => {
                            var t = ae();
                            (i(`click`, t, de), b(e, t));
                        };
                    (n(a, (e) => {
                        l(B).ownerID === E().userID && e(o);
                    }),
                        b(e, r));
                };
            (n(F, (e) => {
                l(B) && e(L);
            }),
                C(M));
            var R = f(M, 2);
            (u(
                R,
                21,
                () => l(V),
                r,
                (e, t) => {
                    var n = oe(),
                        r = o(n),
                        i = o(r),
                        a = o(i),
                        c = o(a, !0);
                    C(a);
                    var u = f(a, 2),
                        p = o(u);
                    (C(u), C(i));
                    var m = f(i, 2),
                        h = o(m, !0);
                    (C(m),
                        C(r),
                        C(n),
                        d(
                            (e, n, r) => {
                                (v(a, `color: ${l(t).color ?? ``}`),
                                    s(c, l(t).username),
                                    s(p, `${e ?? ``}:${n ?? ``}:${r ?? ``}`),
                                    s(h, l(t).text));
                            },
                            [
                                () => (l(t).time.getHours() < 10 ? `0` : ``) + l(t).time.getHours(),
                                () =>
                                    (l(t).time.getMinutes() < 10 ? `0` : ``) +
                                    l(t).time.getMinutes(),
                                () =>
                                    (l(t).time.getSeconds() < 10 ? `0` : ``) +
                                    l(t).time.getSeconds(),
                            ]
                        ),
                        b(e, n));
                }
            ),
                C(R),
                h(
                    R,
                    (t) => e(W, t),
                    () => l(W)
                ));
            var z = f(R, 2),
                G = o(z),
                X = o(G);
            (te(X),
                h(
                    X,
                    (t) => e(U, t),
                    () => l(U)
                ));
            var Z = f(X, 2);
            (C(G),
                C(z),
                C(j),
                i(`click`, N, le),
                i(`click`, P, ue),
                a(`submit`, G, (e) => e.preventDefault()),
                ee(
                    X,
                    () => l(H),
                    (t) => e(H, t)
                ),
                i(`click`, Z, ce),
                b(c, m));
        },
        me = (e) => {
            var t = L(),
                n = o(t);
            (j(n, { size: `80`, color: `aqua`, unit: `px`, duration: `1s` }), C(t), b(e, t));
        };
    (n(fe, (e) => {
        l(B) ? e(pe) : e(me, -1);
    }),
        C($),
        b(c, $),
        g(),
        F());
}
c([`click`]);
function B(e, r) {
    x(r, !1);
    let i = () => T(k, `$user`, a),
        [a, o] = S();
    E();
    var s = t(),
        c = p(s),
        l = (e) => {
            z(e, {
                get id() {
                    return O.params.id;
                },
            });
        },
        u = (e) => {
            F(e, {});
        };
    (n(c, (e) => {
        i().loggedIn === !0 ? e(l) : e(u, -1);
    }),
        b(e, s),
        g(),
        o());
}
export { B as component };

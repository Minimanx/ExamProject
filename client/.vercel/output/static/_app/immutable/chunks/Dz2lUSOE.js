import {
    $ as e,
    A as t,
    D as n,
    E as r,
    F as i,
    I as a,
    J as o,
    L as s,
    M as c,
    O as l,
    P as u,
    R as d,
    T as f,
    V as p,
    W as m,
    X as h,
    Y as g,
    Z as _,
    _ as v,
    a as y,
    at as b,
    ct as x,
    d as S,
    et as C,
    f as w,
    ft as T,
    g as E,
    h as D,
    it as O,
    j as k,
    k as A,
    l as j,
    lt as M,
    m as ee,
    mt as N,
    nt as te,
    ot as P,
    p as F,
    pt as I,
    q as L,
    r as ne,
    rt as re,
    s as ie,
    tt as ae,
    u as oe,
} from "./DMBGR548.js";
import { c as se, t as ce } from "./C4rghkfP.js";
import "./BhJxURJ-.js";
import "./xihTtKlq.js";
import { n as R } from "./DBPkbVYH.js";
import { t as le } from "./CvRJ_r6W.js";
var z = Object.create(null);
((z.open = `0`),
    (z.close = `1`),
    (z.ping = `2`),
    (z.pong = `3`),
    (z.message = `4`),
    (z.upgrade = `5`),
    (z.noop = `6`));
var B = Object.create(null);
Object.keys(z).forEach((e) => {
    B[z[e]] = e;
});
var V = { type: `error`, data: `parser error` },
    ue =
        typeof Blob == `function` ||
        (typeof Blob < `u` && Object.prototype.toString.call(Blob) === `[object BlobConstructor]`),
    H = typeof ArrayBuffer == `function`,
    de = (e) =>
        typeof ArrayBuffer.isView == `function`
            ? ArrayBuffer.isView(e)
            : e && e.buffer instanceof ArrayBuffer,
    fe = ({ type: e, data: t }, n, r) =>
        ue && t instanceof Blob
            ? n
                ? r(t)
                : pe(t, r)
            : H && (t instanceof ArrayBuffer || de(t))
              ? n
                  ? r(t)
                  : pe(new Blob([t]), r)
              : r(z[e] + (t || ``)),
    pe = (e, t) => {
        let n = new FileReader();
        return (
            (n.onload = function () {
                let e = n.result.split(`,`)[1];
                t(`b` + (e || ``));
            }),
            n.readAsDataURL(e)
        );
    };
function U(e) {
    return e instanceof Uint8Array
        ? e
        : e instanceof ArrayBuffer
          ? new Uint8Array(e)
          : new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
}
var me;
function he(e, t) {
    if (ue && e.data instanceof Blob) return e.data.arrayBuffer().then(U).then(t);
    if (H && (e.data instanceof ArrayBuffer || de(e.data))) return t(U(e.data));
    fe(e, !1, (e) => {
        ((me ||= new TextEncoder()), t(me.encode(e)));
    });
}
var W = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`,
    G = typeof Uint8Array > `u` ? [] : new Uint8Array(256);
for (let e = 0; e < 64; e++) G[W.charCodeAt(e)] = e;
var ge = (e) => {
        let t = e.length * 0.75,
            n = e.length,
            r,
            i = 0,
            a,
            o,
            s,
            c;
        e[e.length - 1] === `=` && (t--, e[e.length - 2] === `=` && t--);
        let l = new ArrayBuffer(t),
            u = new Uint8Array(l);
        for (r = 0; r < n; r += 4)
            ((a = G[e.charCodeAt(r)]),
                (o = G[e.charCodeAt(r + 1)]),
                (s = G[e.charCodeAt(r + 2)]),
                (c = G[e.charCodeAt(r + 3)]),
                (u[i++] = (a << 2) | (o >> 4)),
                (u[i++] = ((o & 15) << 4) | (s >> 2)),
                (u[i++] = ((s & 3) << 6) | (c & 63)));
        return l;
    },
    _e = typeof ArrayBuffer == `function`,
    ve = (e, t) => {
        if (typeof e != `string`) return { type: `message`, data: be(e, t) };
        let n = e.charAt(0);
        return n === `b`
            ? { type: `message`, data: ye(e.substring(1), t) }
            : B[n]
              ? e.length > 1
                  ? { type: B[n], data: e.substring(1) }
                  : { type: B[n] }
              : V;
    },
    ye = (e, t) => (_e ? be(ge(e), t) : { base64: !0, data: e }),
    be = (e, t) => {
        switch (t) {
            case `blob`:
                return e instanceof Blob ? e : new Blob([e]);
            default:
                return e instanceof ArrayBuffer ? e : e.buffer;
        }
    },
    xe = ``,
    Se = (e, t) => {
        let n = e.length,
            r = Array(n),
            i = 0;
        e.forEach((e, a) => {
            fe(e, !1, (e) => {
                ((r[a] = e), ++i === n && t(r.join(xe)));
            });
        });
    },
    Ce = (e, t) => {
        let n = e.split(xe),
            r = [];
        for (let e = 0; e < n.length; e++) {
            let i = ve(n[e], t);
            if ((r.push(i), i.type === `error`)) break;
        }
        return r;
    };
function we() {
    return new TransformStream({
        transform(e, t) {
            he(e, (n) => {
                let r = n.length,
                    i;
                if (r < 126) ((i = new Uint8Array(1)), new DataView(i.buffer).setUint8(0, r));
                else if (r < 65536) {
                    i = new Uint8Array(3);
                    let e = new DataView(i.buffer);
                    (e.setUint8(0, 126), e.setUint16(1, r));
                } else {
                    i = new Uint8Array(9);
                    let e = new DataView(i.buffer);
                    (e.setUint8(0, 127), e.setBigUint64(1, BigInt(r)));
                }
                (e.data && typeof e.data != `string` && (i[0] |= 128), t.enqueue(i), t.enqueue(n));
            });
        },
    });
}
var Te;
function Ee(e) {
    return e.reduce((e, t) => e + t.length, 0);
}
function De(e, t) {
    if (e[0].length === t) return e.shift();
    let n = new Uint8Array(t),
        r = 0;
    for (let i = 0; i < t; i++) ((n[i] = e[0][r++]), r === e[0].length && (e.shift(), (r = 0)));
    return (e.length && r < e[0].length && (e[0] = e[0].slice(r)), n);
}
function Oe(e, t) {
    Te ||= new TextDecoder();
    let n = [],
        r = 0,
        i = -1,
        a = !1;
    return new TransformStream({
        transform(o, s) {
            for (n.push(o); ;) {
                if (r === 0) {
                    if (Ee(n) < 1) break;
                    let e = De(n, 1);
                    ((a = (e[0] & 128) == 128),
                        (i = e[0] & 127),
                        (r = i < 126 ? 3 : i === 126 ? 1 : 2));
                } else if (r === 1) {
                    if (Ee(n) < 2) break;
                    let e = De(n, 2);
                    ((i = new DataView(e.buffer, e.byteOffset, e.length).getUint16(0)), (r = 3));
                } else if (r === 2) {
                    if (Ee(n) < 8) break;
                    let e = De(n, 8),
                        t = new DataView(e.buffer, e.byteOffset, e.length),
                        a = t.getUint32(0);
                    if (a > 2 ** 21 - 1) {
                        s.enqueue(V);
                        break;
                    }
                    ((i = a * 2 ** 32 + t.getUint32(4)), (r = 3));
                } else {
                    if (Ee(n) < i) break;
                    let e = De(n, i);
                    (s.enqueue(ve(a ? e : Te.decode(e), t)), (r = 0));
                }
                if (i === 0 || i > e) {
                    s.enqueue(V);
                    break;
                }
            }
        },
    });
}
function K(e) {
    if (e) return ke(e);
}
function ke(e) {
    for (var t in K.prototype) e[t] = K.prototype[t];
    return e;
}
((K.prototype.on = K.prototype.addEventListener =
    function (e, t) {
        return (
            (this._callbacks = this._callbacks || {}),
            (this._callbacks[`$` + e] = this._callbacks[`$` + e] || []).push(t),
            this
        );
    }),
    (K.prototype.once = function (e, t) {
        function n() {
            (this.off(e, n), t.apply(this, arguments));
        }
        return ((n.fn = t), this.on(e, n), this);
    }),
    (K.prototype.off =
        K.prototype.removeListener =
        K.prototype.removeAllListeners =
        K.prototype.removeEventListener =
            function (e, t) {
                if (((this._callbacks = this._callbacks || {}), arguments.length == 0))
                    return ((this._callbacks = {}), this);
                var n = this._callbacks[`$` + e];
                if (!n) return this;
                if (arguments.length == 1) return (delete this._callbacks[`$` + e], this);
                for (var r, i = 0; i < n.length; i++)
                    if (((r = n[i]), r === t || r.fn === t)) {
                        n.splice(i, 1);
                        break;
                    }
                return (n.length === 0 && delete this._callbacks[`$` + e], this);
            }),
    (K.prototype.emit = function (e) {
        this._callbacks = this._callbacks || {};
        for (
            var t = Array(arguments.length - 1), n = this._callbacks[`$` + e], r = 1;
            r < arguments.length;
            r++
        )
            t[r - 1] = arguments[r];
        if (n) {
            n = n.slice(0);
            for (var r = 0, i = n.length; r < i; ++r) n[r].apply(this, t);
        }
        return this;
    }),
    (K.prototype.emitReserved = K.prototype.emit),
    (K.prototype.listeners = function (e) {
        return ((this._callbacks = this._callbacks || {}), this._callbacks[`$` + e] || []);
    }),
    (K.prototype.hasListeners = function (e) {
        return !!this.listeners(e).length;
    }));
var Ae =
        typeof Promise == `function` && typeof Promise.resolve == `function`
            ? (e) => Promise.resolve().then(e)
            : (e, t) => t(e, 0),
    q = typeof self < `u` ? self : typeof window < `u` ? window : Function(`return this`)(),
    je = `arraybuffer`;
function Me(e, ...t) {
    return t.reduce((t, n) => (e.hasOwnProperty(n) && (t[n] = e[n]), t), {});
}
var Ne = q.setTimeout,
    Pe = q.clearTimeout;
function Fe(e, t) {
    t.useNativeTimers
        ? ((e.setTimeoutFn = Ne.bind(q)), (e.clearTimeoutFn = Pe.bind(q)))
        : ((e.setTimeoutFn = q.setTimeout.bind(q)), (e.clearTimeoutFn = q.clearTimeout.bind(q)));
}
var Ie = 1.33;
function Le(e) {
    return typeof e == `string` ? Re(e) : Math.ceil((e.byteLength || e.size) * Ie);
}
function Re(e) {
    let t = 0,
        n = 0;
    for (let r = 0, i = e.length; r < i; r++)
        ((t = e.charCodeAt(r)),
            t < 128
                ? (n += 1)
                : t < 2048
                  ? (n += 2)
                  : t < 55296 || t >= 57344
                    ? (n += 3)
                    : (r++, (n += 4)));
    return n;
}
function ze() {
    return Date.now().toString(36).substring(3) + Math.random().toString(36).substring(2, 5);
}
function Be(e) {
    let t = ``;
    for (let n in e)
        e.hasOwnProperty(n) &&
            (t.length && (t += `&`), (t += encodeURIComponent(n) + `=` + encodeURIComponent(e[n])));
    return t;
}
function Ve(e) {
    let t = {},
        n = e.split(`&`);
    for (let e = 0, r = n.length; e < r; e++) {
        let r = n[e].split(`=`);
        t[decodeURIComponent(r[0])] = decodeURIComponent(r[1]);
    }
    return t;
}
var He = class extends Error {
        constructor(e, t, n) {
            (super(e), (this.description = t), (this.context = n), (this.type = `TransportError`));
        }
    },
    Ue = class extends K {
        constructor(e) {
            (super(),
                (this.writable = !1),
                Fe(this, e),
                (this.opts = e),
                (this.query = e.query),
                (this.socket = e.socket),
                (this.supportsBinary = !e.forceBase64));
        }
        onError(e, t, n) {
            return (super.emitReserved(`error`, new He(e, t, n)), this);
        }
        open() {
            return ((this.readyState = `opening`), this.doOpen(), this);
        }
        close() {
            return (
                (this.readyState === `opening` || this.readyState === `open`) &&
                    (this.doClose(), this.onClose()),
                this
            );
        }
        send(e) {
            this.readyState === `open` && this.write(e);
        }
        onOpen() {
            ((this.readyState = `open`), (this.writable = !0), super.emitReserved(`open`));
        }
        onData(e) {
            let t = ve(e, this.socket.binaryType);
            this.onPacket(t);
        }
        onPacket(e) {
            super.emitReserved(`packet`, e);
        }
        onClose(e) {
            ((this.readyState = `closed`), super.emitReserved(`close`, e));
        }
        pause(e) {}
        createUri(e, t = {}) {
            return e + `://` + this._hostname() + this._port() + this.opts.path + this._query(t);
        }
        _hostname() {
            let e = this.opts.hostname;
            return e.indexOf(`:`) === -1 ? e : `[` + e + `]`;
        }
        _port() {
            return this.opts.port &&
                ((this.opts.secure && Number(this.opts.port) !== 443) ||
                    (!this.opts.secure && Number(this.opts.port) !== 80))
                ? `:` + this.opts.port
                : ``;
        }
        _query(e) {
            let t = Be(e);
            return t.length ? `?` + t : ``;
        }
    },
    We = class extends Ue {
        constructor() {
            (super(...arguments), (this._polling = !1));
        }
        get name() {
            return `polling`;
        }
        doOpen() {
            this._poll();
        }
        pause(e) {
            this.readyState = `pausing`;
            let t = () => {
                ((this.readyState = `paused`), e());
            };
            if (this._polling || !this.writable) {
                let e = 0;
                (this._polling &&
                    (e++,
                    this.once(`pollComplete`, function () {
                        --e || t();
                    })),
                    this.writable ||
                        (e++,
                        this.once(`drain`, function () {
                            --e || t();
                        })));
            } else t();
        }
        _poll() {
            ((this._polling = !0), this.doPoll(), this.emitReserved(`poll`));
        }
        onData(e) {
            (Ce(e, this.socket.binaryType).forEach((e) => {
                if (
                    (this.readyState === `opening` && e.type === `open` && this.onOpen(),
                    e.type === `close`)
                )
                    return (this.onClose({ description: `transport closed by the server` }), !1);
                this.onPacket(e);
            }),
                this.readyState !== `closed` &&
                    ((this._polling = !1),
                    this.emitReserved(`pollComplete`),
                    this.readyState === `open` && this._poll()));
        }
        doClose() {
            let e = () => {
                this.write([{ type: `close` }]);
            };
            this.readyState === `open` ? e() : this.once(`open`, e);
        }
        write(e) {
            ((this.writable = !1),
                Se(e, (e) => {
                    this.doWrite(e, () => {
                        ((this.writable = !0), this.emitReserved(`drain`));
                    });
                }));
        }
        uri() {
            let e = this.opts.secure ? `https` : `http`,
                t = this.query || {};
            return (
                !1 !== this.opts.timestampRequests && (t[this.opts.timestampParam] = ze()),
                !this.supportsBinary && !t.sid && (t.b64 = 1),
                this.createUri(e, t)
            );
        }
    },
    Ge = !1;
try {
    Ge = typeof XMLHttpRequest < `u` && `withCredentials` in new XMLHttpRequest();
} catch {}
var Ke = Ge;
function qe() {}
var Je = class extends We {
        constructor(e) {
            if ((super(e), typeof location < `u`)) {
                let t = location.protocol === `https:`,
                    n = location.port;
                ((n ||= t ? `443` : `80`),
                    (this.xd =
                        (typeof location < `u` && e.hostname !== location.hostname) ||
                        n !== e.port));
            }
        }
        doWrite(e, t) {
            let n = this.request({ method: `POST`, data: e });
            (n.on(`success`, t),
                n.on(`error`, (e, t) => {
                    this.onError(`xhr post error`, e, t);
                }));
        }
        doPoll() {
            let e = this.request();
            (e.on(`data`, this.onData.bind(this)),
                e.on(`error`, (e, t) => {
                    this.onError(`xhr poll error`, e, t);
                }),
                (this.pollXhr = e));
        }
    },
    Ye = class e extends K {
        constructor(e, t, n) {
            (super(),
                (this.createRequest = e),
                Fe(this, n),
                (this._opts = n),
                (this._method = n.method || `GET`),
                (this._uri = t),
                (this._data = n.data === void 0 ? null : n.data),
                this._create());
        }
        _create() {
            var t;
            let n = Me(
                this._opts,
                `agent`,
                `pfx`,
                `key`,
                `passphrase`,
                `cert`,
                `ca`,
                `ciphers`,
                `rejectUnauthorized`,
                `autoUnref`
            );
            n.xdomain = !!this._opts.xd;
            let r = (this._xhr = this.createRequest(n));
            try {
                r.open(this._method, this._uri, !0);
                try {
                    if (this._opts.extraHeaders) {
                        r.setDisableHeaderCheck && r.setDisableHeaderCheck(!0);
                        for (let e in this._opts.extraHeaders)
                            this._opts.extraHeaders.hasOwnProperty(e) &&
                                r.setRequestHeader(e, this._opts.extraHeaders[e]);
                    }
                } catch {}
                if (this._method === `POST`)
                    try {
                        r.setRequestHeader(`Content-type`, `text/plain;charset=UTF-8`);
                    } catch {}
                try {
                    r.setRequestHeader(`Accept`, `*/*`);
                } catch {}
                ((t = this._opts.cookieJar) == null || t.addCookies(r),
                    `withCredentials` in r && (r.withCredentials = this._opts.withCredentials),
                    this._opts.requestTimeout && (r.timeout = this._opts.requestTimeout),
                    (r.onreadystatechange = () => {
                        var e;
                        (r.readyState === 3 &&
                            ((e = this._opts.cookieJar) == null ||
                                e.parseCookies(r.getResponseHeader(`set-cookie`))),
                            r.readyState === 4 &&
                                (r.status === 200 || r.status === 1223
                                    ? this._onLoad()
                                    : this.setTimeoutFn(() => {
                                          this._onError(typeof r.status == `number` ? r.status : 0);
                                      }, 0)));
                    }),
                    r.send(this._data));
            } catch (e) {
                this.setTimeoutFn(() => {
                    this._onError(e);
                }, 0);
                return;
            }
            typeof document < `u` &&
                ((this._index = e.requestsCount++), (e.requests[this._index] = this));
        }
        _onError(e) {
            (this.emitReserved(`error`, e, this._xhr), this._cleanup(!0));
        }
        _cleanup(t) {
            if (this._xhr !== void 0 && this._xhr !== null) {
                if (((this._xhr.onreadystatechange = qe), t))
                    try {
                        this._xhr.abort();
                    } catch {}
                (typeof document < `u` && delete e.requests[this._index], (this._xhr = null));
            }
        }
        _onLoad() {
            let e = this._xhr.responseText;
            e !== null &&
                (this.emitReserved(`data`, e), this.emitReserved(`success`), this._cleanup());
        }
        abort() {
            this._cleanup();
        }
    };
if (((Ye.requestsCount = 0), (Ye.requests = {}), typeof document < `u`)) {
    if (typeof attachEvent == `function`) attachEvent(`onunload`, Xe);
    else if (typeof addEventListener == `function`) {
        let e = `onpagehide` in q ? `pagehide` : `unload`;
        addEventListener(e, Xe, !1);
    }
}
function Xe() {
    for (let e in Ye.requests) Ye.requests.hasOwnProperty(e) && Ye.requests[e].abort();
}
var Ze = (function () {
        let e = $e({ xdomain: !1 });
        return e && e.responseType !== null;
    })(),
    Qe = class extends Je {
        constructor(e) {
            super(e);
            let t = e && e.forceBase64;
            this.supportsBinary = Ze && !t;
        }
        request(e = {}) {
            return (Object.assign(e, { xd: this.xd }, this.opts), new Ye($e, this.uri(), e));
        }
    };
function $e(e) {
    let t = e.xdomain;
    try {
        if (typeof XMLHttpRequest < `u` && (!t || Ke)) return new XMLHttpRequest();
    } catch {}
    if (!t)
        try {
            return new q[[`Active`, `Object`].join(`X`)](`Microsoft.XMLHTTP`);
        } catch {}
}
var et =
        typeof navigator < `u` &&
        typeof navigator.product == `string` &&
        navigator.product.toLowerCase() === `reactnative`,
    tt = class extends Ue {
        get name() {
            return `websocket`;
        }
        doOpen() {
            let e = this.uri(),
                t = this.opts.protocols,
                n = et
                    ? {}
                    : Me(
                          this.opts,
                          `agent`,
                          `perMessageDeflate`,
                          `pfx`,
                          `key`,
                          `passphrase`,
                          `cert`,
                          `ca`,
                          `ciphers`,
                          `rejectUnauthorized`,
                          `localAddress`,
                          `protocolVersion`,
                          `origin`,
                          `maxPayload`,
                          `family`,
                          `checkServerIdentity`
                      );
            this.opts.extraHeaders && (n.headers = this.opts.extraHeaders);
            try {
                this.ws = this.createSocket(e, t, n);
            } catch (e) {
                return this.emitReserved(`error`, e);
            }
            ((this.ws.binaryType = this.socket.binaryType), this.addEventListeners());
        }
        addEventListeners() {
            ((this.ws.onopen = () => {
                (this.opts.autoUnref && this.ws._socket.unref(), this.onOpen());
            }),
                (this.ws.onclose = (e) =>
                    this.onClose({ description: `websocket connection closed`, context: e })),
                (this.ws.onmessage = (e) => this.onData(e.data)),
                (this.ws.onerror = (e) => this.onError(`websocket error`, e)));
        }
        write(e) {
            this.writable = !1;
            for (let t = 0; t < e.length; t++) {
                let n = e[t],
                    r = t === e.length - 1;
                fe(n, this.supportsBinary, (e) => {
                    try {
                        this.doWrite(n, e);
                    } catch {}
                    r &&
                        Ae(() => {
                            ((this.writable = !0), this.emitReserved(`drain`));
                        }, this.setTimeoutFn);
                });
            }
        }
        doClose() {
            this.ws !== void 0 && ((this.ws.onerror = () => {}), this.ws.close(), (this.ws = null));
        }
        uri() {
            let e = this.opts.secure ? `wss` : `ws`,
                t = this.query || {};
            return (
                this.opts.timestampRequests && (t[this.opts.timestampParam] = ze()),
                this.supportsBinary || (t.b64 = 1),
                this.createUri(e, t)
            );
        }
    },
    nt = q.WebSocket || q.MozWebSocket,
    rt = {
        websocket: class extends tt {
            createSocket(e, t, n) {
                return et ? new nt(e, t, n) : t ? new nt(e, t) : new nt(e);
            }
            doWrite(e, t) {
                this.ws.send(t);
            }
        },
        webtransport: class extends Ue {
            get name() {
                return `webtransport`;
            }
            doOpen() {
                try {
                    this._transport = new WebTransport(
                        this.createUri(`https`),
                        this.opts.transportOptions[this.name]
                    );
                } catch (e) {
                    return this.emitReserved(`error`, e);
                }
                (this._transport.closed
                    .then(() => {
                        this.onClose();
                    })
                    .catch((e) => {
                        this.onError(`webtransport error`, e);
                    }),
                    this._transport.ready.then(() => {
                        this._transport.createBidirectionalStream().then((e) => {
                            let t = Oe(2 ** 53 - 1, this.socket.binaryType),
                                n = e.readable.pipeThrough(t).getReader(),
                                r = we();
                            (r.readable.pipeTo(e.writable),
                                (this._writer = r.writable.getWriter()));
                            let i = () => {
                                n.read()
                                    .then(({ done: e, value: t }) => {
                                        e || (this.onPacket(t), i());
                                    })
                                    .catch((e) => {});
                            };
                            i();
                            let a = { type: `open` };
                            (this.query.sid && (a.data = `{"sid":"${this.query.sid}"}`),
                                this._writer.write(a).then(() => this.onOpen()));
                        });
                    }));
            }
            write(e) {
                this.writable = !1;
                for (let t = 0; t < e.length; t++) {
                    let n = e[t],
                        r = t === e.length - 1;
                    this._writer.write(n).then(() => {
                        r &&
                            Ae(() => {
                                ((this.writable = !0), this.emitReserved(`drain`));
                            }, this.setTimeoutFn);
                    });
                }
            }
            doClose() {
                var e;
                (e = this._transport) == null || e.close();
            }
        },
        polling: Qe,
    },
    it =
        /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,
    at = [
        `source`,
        `protocol`,
        `authority`,
        `userInfo`,
        `user`,
        `password`,
        `host`,
        `port`,
        `relative`,
        `path`,
        `directory`,
        `file`,
        `query`,
        `anchor`,
    ];
function ot(e) {
    if (e.length > 8e3) throw `URI too long`;
    let t = e,
        n = e.indexOf(`[`),
        r = e.indexOf(`]`);
    n != -1 &&
        r != -1 &&
        (e = e.substring(0, n) + e.substring(n, r).replace(/:/g, `;`) + e.substring(r, e.length));
    let i = it.exec(e || ``),
        a = {},
        o = 14;
    for (; o--;) a[at[o]] = i[o] || ``;
    return (
        n != -1 &&
            r != -1 &&
            ((a.source = t),
            (a.host = a.host.substring(1, a.host.length - 1).replace(/;/g, `:`)),
            (a.authority = a.authority.replace(`[`, ``).replace(`]`, ``).replace(/;/g, `:`)),
            (a.ipv6uri = !0)),
        (a.pathNames = st(a, a.path)),
        (a.queryKey = ct(a, a.query)),
        a
    );
}
function st(e, t) {
    let n = t.replace(/\/{2,9}/g, `/`).split(`/`);
    return (
        (t.slice(0, 1) == `/` || t.length === 0) && n.splice(0, 1),
        t.slice(-1) == `/` && n.splice(n.length - 1, 1),
        n
    );
}
function ct(e, t) {
    let n = {};
    return (
        t.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function (e, t, r) {
            t && (n[t] = r);
        }),
        n
    );
}
var lt = typeof addEventListener == `function` && typeof removeEventListener == `function`,
    ut = [];
lt &&
    addEventListener(
        `offline`,
        () => {
            ut.forEach((e) => e());
        },
        !1
    );
var dt = class e extends K {
    constructor(e, t) {
        if (
            (super(),
            (this.binaryType = je),
            (this.writeBuffer = []),
            (this._prevBufferLen = 0),
            (this._pingInterval = -1),
            (this._pingTimeout = -1),
            (this._maxPayload = -1),
            (this._pingTimeoutTime = 1 / 0),
            e && typeof e == `object` && ((t = e), (e = null)),
            e)
        ) {
            let n = ot(e);
            ((t.hostname = n.host),
                (t.secure = n.protocol === `https` || n.protocol === `wss`),
                (t.port = n.port),
                n.query && (t.query = n.query));
        } else t.host && (t.hostname = ot(t.host).host);
        (Fe(this, t),
            (this.secure =
                t.secure == null
                    ? typeof location < `u` && location.protocol === `https:`
                    : t.secure),
            t.hostname && !t.port && (t.port = this.secure ? `443` : `80`),
            (this.hostname =
                t.hostname || (typeof location < `u` ? location.hostname : `localhost`)),
            (this.port =
                t.port ||
                (typeof location < `u` && location.port
                    ? location.port
                    : this.secure
                      ? `443`
                      : `80`)),
            (this.transports = []),
            (this._transportsByName = {}),
            t.transports.forEach((e) => {
                let t = e.prototype.name;
                (this.transports.push(t), (this._transportsByName[t] = e));
            }),
            (this.opts = Object.assign(
                {
                    path: `/engine.io`,
                    agent: !1,
                    withCredentials: !1,
                    upgrade: !0,
                    timestampParam: `t`,
                    rememberUpgrade: !1,
                    addTrailingSlash: !0,
                    rejectUnauthorized: !0,
                    perMessageDeflate: { threshold: 1024 },
                    transportOptions: {},
                    closeOnBeforeunload: !1,
                },
                t
            )),
            (this.opts.path =
                this.opts.path.replace(/\/$/, ``) + (this.opts.addTrailingSlash ? `/` : ``)),
            typeof this.opts.query == `string` && (this.opts.query = Ve(this.opts.query)),
            lt &&
                (this.opts.closeOnBeforeunload &&
                    ((this._beforeunloadEventListener = () => {
                        this.transport &&
                            (this.transport.removeAllListeners(), this.transport.close());
                    }),
                    addEventListener(`beforeunload`, this._beforeunloadEventListener, !1)),
                this.hostname !== `localhost` &&
                    ((this._offlineEventListener = () => {
                        this._onClose(`transport close`, {
                            description: `network connection lost`,
                        });
                    }),
                    ut.push(this._offlineEventListener))),
            this.opts.withCredentials && (this._cookieJar = void 0),
            this._open());
    }
    createTransport(e) {
        let t = Object.assign({}, this.opts.query);
        ((t.EIO = 4), (t.transport = e), this.id && (t.sid = this.id));
        let n = Object.assign(
            {},
            this.opts,
            {
                query: t,
                socket: this,
                hostname: this.hostname,
                secure: this.secure,
                port: this.port,
            },
            this.opts.transportOptions[e]
        );
        return new this._transportsByName[e](n);
    }
    _open() {
        if (this.transports.length === 0) {
            this.setTimeoutFn(() => {
                this.emitReserved(`error`, `No transports available`);
            }, 0);
            return;
        }
        let t =
            this.opts.rememberUpgrade &&
            e.priorWebsocketSuccess &&
            this.transports.indexOf(`websocket`) !== -1
                ? `websocket`
                : this.transports[0];
        this.readyState = `opening`;
        let n = this.createTransport(t);
        (n.open(), this.setTransport(n));
    }
    setTransport(e) {
        (this.transport && this.transport.removeAllListeners(),
            (this.transport = e),
            e
                .on(`drain`, this._onDrain.bind(this))
                .on(`packet`, this._onPacket.bind(this))
                .on(`error`, this._onError.bind(this))
                .on(`close`, (e) => this._onClose(`transport close`, e)));
    }
    onOpen() {
        ((this.readyState = `open`),
            (e.priorWebsocketSuccess = this.transport.name === `websocket`),
            this.emitReserved(`open`),
            this.flush());
    }
    _onPacket(e) {
        if (
            this.readyState === `opening` ||
            this.readyState === `open` ||
            this.readyState === `closing`
        )
            switch ((this.emitReserved(`packet`, e), this.emitReserved(`heartbeat`), e.type)) {
                case `open`:
                    this.onHandshake(JSON.parse(e.data));
                    break;
                case `ping`:
                    (this._sendPacket(`pong`),
                        this.emitReserved(`ping`),
                        this.emitReserved(`pong`),
                        this._resetPingTimeout());
                    break;
                case `error`:
                    let t = Error(`server error`);
                    ((t.code = e.data), this._onError(t));
                    break;
                case `message`:
                    (this.emitReserved(`data`, e.data), this.emitReserved(`message`, e.data));
            }
    }
    onHandshake(e) {
        (this.emitReserved(`handshake`, e),
            (this.id = e.sid),
            (this.transport.query.sid = e.sid),
            (this._pingInterval = e.pingInterval),
            (this._pingTimeout = e.pingTimeout),
            (this._maxPayload = e.maxPayload),
            this.onOpen(),
            this.readyState !== `closed` && this._resetPingTimeout());
    }
    _resetPingTimeout() {
        this.clearTimeoutFn(this._pingTimeoutTimer);
        let e = this._pingInterval + this._pingTimeout;
        ((this._pingTimeoutTime = Date.now() + e),
            (this._pingTimeoutTimer = this.setTimeoutFn(() => {
                this._onClose(`ping timeout`);
            }, e)),
            this.opts.autoUnref && this._pingTimeoutTimer.unref());
    }
    _onDrain() {
        (this.writeBuffer.splice(0, this._prevBufferLen),
            (this._prevBufferLen = 0),
            this.writeBuffer.length === 0 ? this.emitReserved(`drain`) : this.flush());
    }
    flush() {
        if (
            this.readyState !== `closed` &&
            this.transport.writable &&
            !this.upgrading &&
            this.writeBuffer.length
        ) {
            let e = this._getWritablePackets();
            (this.transport.send(e), (this._prevBufferLen = e.length), this.emitReserved(`flush`));
        }
    }
    _getWritablePackets() {
        if (!(this._maxPayload && this.transport.name === `polling` && this.writeBuffer.length > 1))
            return this.writeBuffer;
        let e = 1;
        for (let t = 0; t < this.writeBuffer.length; t++) {
            let n = this.writeBuffer[t].data;
            if ((n && (e += Le(n)), t > 0 && e > this._maxPayload))
                return this.writeBuffer.slice(0, t);
            e += 2;
        }
        return this.writeBuffer;
    }
    _hasPingExpired() {
        if (!this._pingTimeoutTime) return !0;
        let e = Date.now() > this._pingTimeoutTime;
        return (
            e &&
                ((this._pingTimeoutTime = 0),
                Ae(() => {
                    this._onClose(`ping timeout`);
                }, this.setTimeoutFn)),
            e
        );
    }
    write(e, t, n) {
        return (this._sendPacket(`message`, e, t, n), this);
    }
    send(e, t, n) {
        return (this._sendPacket(`message`, e, t, n), this);
    }
    _sendPacket(e, t, n, r) {
        if (
            (typeof t == `function` && ((r = t), (t = void 0)),
            typeof n == `function` && ((r = n), (n = null)),
            this.readyState === `closing` || this.readyState === `closed`)
        )
            return;
        ((n ||= {}), (n.compress = !1 !== n.compress));
        let i = { type: e, data: t, options: n };
        (this.emitReserved(`packetCreate`, i),
            this.writeBuffer.push(i),
            r && this.once(`flush`, r),
            this.flush());
    }
    close() {
        let e = () => {
                (this._onClose(`forced close`), this.transport.close());
            },
            t = () => {
                (this.off(`upgrade`, t), this.off(`upgradeError`, t), e());
            },
            n = () => {
                (this.once(`upgrade`, t), this.once(`upgradeError`, t));
            };
        return (
            (this.readyState === `opening` || this.readyState === `open`) &&
                ((this.readyState = `closing`),
                this.writeBuffer.length
                    ? this.once(`drain`, () => {
                          this.upgrading ? n() : e();
                      })
                    : this.upgrading
                      ? n()
                      : e()),
            this
        );
    }
    _onError(t) {
        if (
            ((e.priorWebsocketSuccess = !1),
            this.opts.tryAllTransports &&
                this.transports.length > 1 &&
                this.readyState === `opening`)
        )
            return (this.transports.shift(), this._open());
        (this.emitReserved(`error`, t), this._onClose(`transport error`, t));
    }
    _onClose(e, t) {
        if (
            this.readyState === `opening` ||
            this.readyState === `open` ||
            this.readyState === `closing`
        ) {
            if (
                (this.clearTimeoutFn(this._pingTimeoutTimer),
                this.transport.removeAllListeners(`close`),
                this.transport.close(),
                this.transport.removeAllListeners(),
                lt &&
                    (this._beforeunloadEventListener &&
                        removeEventListener(`beforeunload`, this._beforeunloadEventListener, !1),
                    this._offlineEventListener))
            ) {
                let e = ut.indexOf(this._offlineEventListener);
                e !== -1 && ut.splice(e, 1);
            }
            ((this.readyState = `closed`),
                (this.id = null),
                this.emitReserved(`close`, e, t),
                (this.writeBuffer = []),
                (this._prevBufferLen = 0));
        }
    }
};
dt.protocol = 4;
var ft = class extends dt {
        constructor() {
            (super(...arguments), (this._upgrades = []));
        }
        onOpen() {
            if ((super.onOpen(), this.readyState === `open` && this.opts.upgrade))
                for (let e = 0; e < this._upgrades.length; e++) this._probe(this._upgrades[e]);
        }
        _probe(e) {
            let t = this.createTransport(e),
                n = !1;
            dt.priorWebsocketSuccess = !1;
            let r = () => {
                n ||
                    (t.send([{ type: `ping`, data: `probe` }]),
                    t.once(`packet`, (e) => {
                        if (!n) {
                            if (e.type === `pong` && e.data === `probe`) {
                                if (((this.upgrading = !0), this.emitReserved(`upgrading`, t), !t))
                                    return;
                                ((dt.priorWebsocketSuccess = t.name === `websocket`),
                                    this.transport.pause(() => {
                                        n ||
                                            (this.readyState !== `closed` &&
                                                (l(),
                                                this.setTransport(t),
                                                t.send([{ type: `upgrade` }]),
                                                this.emitReserved(`upgrade`, t),
                                                (t = null),
                                                (this.upgrading = !1),
                                                this.flush()));
                                    }));
                            } else {
                                let e = Error(`probe error`);
                                ((e.transport = t.name), this.emitReserved(`upgradeError`, e));
                            }
                        }
                    }));
            };
            function i() {
                n || ((n = !0), l(), t.close(), (t = null));
            }
            let a = (e) => {
                let n = Error(`probe error: ` + e);
                ((n.transport = t.name), i(), this.emitReserved(`upgradeError`, n));
            };
            function o() {
                a(`transport closed`);
            }
            function s() {
                a(`socket closed`);
            }
            function c(e) {
                t && e.name !== t.name && i();
            }
            let l = () => {
                (t.removeListener(`open`, r),
                    t.removeListener(`error`, a),
                    t.removeListener(`close`, o),
                    this.off(`close`, s),
                    this.off(`upgrading`, c));
            };
            (t.once(`open`, r),
                t.once(`error`, a),
                t.once(`close`, o),
                this.once(`close`, s),
                this.once(`upgrading`, c),
                this._upgrades.indexOf(`webtransport`) !== -1 && e !== `webtransport`
                    ? this.setTimeoutFn(() => {
                          n || t.open();
                      }, 200)
                    : t.open());
        }
        onHandshake(e) {
            ((this._upgrades = this._filterUpgrades(e.upgrades)), super.onHandshake(e));
        }
        _filterUpgrades(e) {
            let t = [];
            for (let n = 0; n < e.length; n++) ~this.transports.indexOf(e[n]) && t.push(e[n]);
            return t;
        }
    },
    pt = class extends ft {
        constructor(e, t = {}) {
            let n = typeof e == `object`,
                r = n ? { ...e } : { ...t };
            ((!r.transports || (r.transports && typeof r.transports[0] == `string`)) &&
                (r.transports = (r.transports || [`polling`, `websocket`, `webtransport`])
                    .map((e) => rt[e])
                    .filter((e) => !!e)),
                super(n ? r : e, r));
        }
    };
pt.protocol;
function mt(e, t = ``, n) {
    let r = e;
    ((n ||= typeof location < `u` && location),
        (e ??= n.protocol + `//` + n.host),
        typeof e == `string` &&
            (e.charAt(0) === `/` && (e = e.charAt(1) === `/` ? n.protocol + e : n.host + e),
            /^(https?|wss?):\/\//.test(e) ||
                (e = n === void 0 ? `https://` + e : n.protocol + `//` + e),
            (r = ot(e))),
        r.port ||
            (/^(http|ws)$/.test(r.protocol)
                ? (r.port = `80`)
                : /^(http|ws)s$/.test(r.protocol) && (r.port = `443`)),
        (r.path = r.path || `/`));
    let i = r.host.indexOf(`:`) === -1 ? r.host : `[` + r.host + `]`;
    return (
        (r.id = r.protocol + `://` + i + `:` + r.port + t),
        (r.href = r.protocol + `://` + i + (n && n.port === r.port ? `` : `:` + r.port)),
        r
    );
}
var ht = typeof ArrayBuffer == `function`,
    gt = (e) =>
        typeof ArrayBuffer.isView == `function`
            ? ArrayBuffer.isView(e)
            : e.buffer instanceof ArrayBuffer,
    _t = Object.prototype.toString,
    vt =
        typeof Blob == `function` ||
        (typeof Blob < `u` && _t.call(Blob) === `[object BlobConstructor]`),
    yt =
        typeof File == `function` ||
        (typeof File < `u` && _t.call(File) === `[object FileConstructor]`);
function bt(e) {
    return (
        (ht && (e instanceof ArrayBuffer || gt(e))) ||
        (vt && e instanceof Blob) ||
        (yt && e instanceof File)
    );
}
function xt(e, t) {
    if (!e || typeof e != `object`) return !1;
    if (Array.isArray(e)) {
        for (let t = 0, n = e.length; t < n; t++) if (xt(e[t])) return !0;
        return !1;
    }
    if (bt(e)) return !0;
    if (e.toJSON && typeof e.toJSON == `function` && arguments.length === 1)
        return xt(e.toJSON(), !0);
    for (let t in e) if (Object.prototype.hasOwnProperty.call(e, t) && xt(e[t])) return !0;
    return !1;
}
function St(e) {
    let t = [],
        n = e.data,
        r = e;
    return ((r.data = Ct(n, t)), (r.attachments = t.length), { packet: r, buffers: t });
}
function Ct(e, t, n) {
    if (!e) return e;
    if (bt(e)) {
        let n = { _placeholder: !0, num: t.length };
        return (t.push(e), n);
    }
    if (Array.isArray(e)) {
        let n = Array(e.length);
        for (let r = 0; r < e.length; r++) n[r] = Ct(e[r], t);
        return n;
    }
    if (typeof e == `object` && !(e instanceof Date)) {
        if (e.toJSON && typeof e.toJSON == `function` && !n) return Ct(e.toJSON(), t, !0);
        let r = {};
        for (let n in e) Object.prototype.hasOwnProperty.call(e, n) && (r[n] = Ct(e[n], t));
        return r;
    }
    return e;
}
function wt(e, t) {
    return ((e.data = Tt(e.data, t)), delete e.attachments, e);
}
function Tt(e, t) {
    if (!e) return e;
    if (e && e._placeholder === !0) {
        if (typeof e.num == `number` && e.num >= 0 && e.num < t.length) return t[e.num];
        throw Error(`illegal attachments`);
    }
    if (Array.isArray(e)) for (let n = 0; n < e.length; n++) e[n] = Tt(e[n], t);
    else if (typeof e == `object`)
        for (let n in e) Object.prototype.hasOwnProperty.call(e, n) && (e[n] = Tt(e[n], t));
    return e;
}
var Et = N({
        Decoder: () => kt,
        Encoder: () => Ot,
        PacketType: () => J,
        isPacketValid: () => It,
        protocol: () => 5,
    }),
    Dt = [
        `connect`,
        `connect_error`,
        `disconnect`,
        `disconnecting`,
        `newListener`,
        `removeListener`,
    ],
    J;
(function (e) {
    ((e[(e.CONNECT = 0)] = `CONNECT`),
        (e[(e.DISCONNECT = 1)] = `DISCONNECT`),
        (e[(e.EVENT = 2)] = `EVENT`),
        (e[(e.ACK = 3)] = `ACK`),
        (e[(e.CONNECT_ERROR = 4)] = `CONNECT_ERROR`),
        (e[(e.BINARY_EVENT = 5)] = `BINARY_EVENT`),
        (e[(e.BINARY_ACK = 6)] = `BINARY_ACK`));
})((J ||= {}));
var Ot = class {
        constructor(e) {
            this.replacer = e;
        }
        encode(e) {
            return (e.type === J.EVENT || e.type === J.ACK) && xt(e)
                ? this.encodeAsBinary({
                      type: e.type === J.EVENT ? J.BINARY_EVENT : J.BINARY_ACK,
                      nsp: e.nsp,
                      data: e.data,
                      id: e.id,
                  })
                : [this.encodeAsString(e)];
        }
        encodeAsString(e) {
            let t = `` + e.type;
            return (
                (e.type === J.BINARY_EVENT || e.type === J.BINARY_ACK) &&
                    (t += e.attachments + `-`),
                e.nsp && e.nsp !== `/` && (t += e.nsp + `,`),
                e.id != null && (t += e.id),
                e.data != null && (t += JSON.stringify(e.data, this.replacer)),
                t
            );
        }
        encodeAsBinary(e) {
            let t = St(e),
                n = this.encodeAsString(t.packet),
                r = t.buffers;
            return (r.unshift(n), r);
        }
    },
    kt = class e extends K {
        constructor(e) {
            (super(),
                (this.opts = Object.assign(
                    { reviver: void 0, maxAttachments: 10 },
                    typeof e == `function` ? { reviver: e } : e
                )));
        }
        add(e) {
            let t;
            if (typeof e == `string`) {
                if (this.reconstructor)
                    throw Error(`got plaintext data when reconstructing a packet`);
                t = this.decodeString(e);
                let n = t.type === J.BINARY_EVENT;
                n || t.type === J.BINARY_ACK
                    ? ((t.type = n ? J.EVENT : J.ACK), (this.reconstructor = new At(t)))
                    : super.emitReserved(`decoded`, t);
            } else if (bt(e) || e.base64) {
                if (this.reconstructor)
                    ((t = this.reconstructor.takeBinaryData(e)),
                        t && ((this.reconstructor = null), super.emitReserved(`decoded`, t)));
                else throw Error(`got binary data when not reconstructing a packet`);
            } else throw Error(`Unknown type: ` + e);
        }
        decodeString(t) {
            let n = 0,
                r = { type: Number(t.charAt(0)) };
            if (J[r.type] === void 0) throw Error(`unknown packet type ` + r.type);
            if (r.type === J.BINARY_EVENT || r.type === J.BINARY_ACK) {
                let e = n + 1;
                for (; t.charAt(++n) !== `-` && n != t.length;);
                let i = t.substring(e, n);
                if (i != Number(i) || t.charAt(n) !== `-`) throw Error(`Illegal attachments`);
                let a = Number(i);
                if (!Mt(a) || a < 1) throw Error(`Illegal attachments`);
                if (a > this.opts.maxAttachments) throw Error(`too many attachments`);
                r.attachments = a;
            }
            if (t.charAt(n + 1) === `/`) {
                let e = n + 1;
                for (; ++n && t.charAt(n) !== `,` && n !== t.length;);
                r.nsp = t.substring(e, n);
            } else r.nsp = `/`;
            let i = t.charAt(n + 1);
            if (i !== `` && Number(i) == i) {
                let e = n + 1;
                for (; ++n;) {
                    let e = t.charAt(n);
                    if (e == null || Number(e) != e) {
                        --n;
                        break;
                    }
                    if (n === t.length) break;
                }
                r.id = Number(t.substring(e, n + 1));
            }
            if (t.charAt(++n)) {
                let i = this.tryParse(t.substr(n));
                if (e.isPayloadValid(r.type, i)) r.data = i;
                else throw Error(`invalid payload`);
            }
            return r;
        }
        tryParse(e) {
            try {
                return JSON.parse(e, this.opts.reviver);
            } catch {
                return !1;
            }
        }
        static isPayloadValid(e, t) {
            switch (e) {
                case J.CONNECT:
                    return Pt(t);
                case J.DISCONNECT:
                    return t === void 0;
                case J.CONNECT_ERROR:
                    return typeof t == `string` || Pt(t);
                case J.EVENT:
                case J.BINARY_EVENT:
                    return (
                        Array.isArray(t) &&
                        (typeof t[0] == `number` ||
                            (typeof t[0] == `string` && Dt.indexOf(t[0]) === -1))
                    );
                case J.ACK:
                case J.BINARY_ACK:
                    return Array.isArray(t);
            }
        }
        destroy() {
            this.reconstructor &&= (this.reconstructor.finishedReconstruction(), null);
        }
    },
    At = class {
        constructor(e) {
            ((this.packet = e), (this.buffers = []), (this.reconPack = e));
        }
        takeBinaryData(e) {
            if ((this.buffers.push(e), this.buffers.length === this.reconPack.attachments)) {
                let e = wt(this.reconPack, this.buffers);
                return (this.finishedReconstruction(), e);
            }
            return null;
        }
        finishedReconstruction() {
            ((this.reconPack = null), (this.buffers = []));
        }
    };
function jt(e) {
    return typeof e == `string`;
}
var Mt =
    Number.isInteger ||
    function (e) {
        return typeof e == `number` && isFinite(e) && Math.floor(e) === e;
    };
function Nt(e) {
    return e === void 0 || Mt(e);
}
function Pt(e) {
    return Object.prototype.toString.call(e) === `[object Object]`;
}
function Ft(e, t) {
    switch (e) {
        case J.CONNECT:
            return t === void 0 || Pt(t);
        case J.DISCONNECT:
            return t === void 0;
        case J.EVENT:
            return (
                Array.isArray(t) &&
                (typeof t[0] == `number` || (typeof t[0] == `string` && Dt.indexOf(t[0]) === -1))
            );
        case J.ACK:
            return Array.isArray(t);
        case J.CONNECT_ERROR:
            return typeof t == `string` || Pt(t);
        default:
            return !1;
    }
}
function It(e) {
    return jt(e.nsp) && Nt(e.id) && Ft(e.type, e.data);
}
function Y(e, t, n) {
    return (
        e.on(t, n),
        function () {
            e.off(t, n);
        }
    );
}
var Lt = Object.freeze({
        connect: 1,
        connect_error: 1,
        disconnect: 1,
        disconnecting: 1,
        newListener: 1,
        removeListener: 1,
    }),
    Rt = class extends K {
        constructor(e, t, n) {
            (super(),
                (this.connected = !1),
                (this.recovered = !1),
                (this.receiveBuffer = []),
                (this.sendBuffer = []),
                (this._queue = []),
                (this._queueSeq = 0),
                (this.ids = 0),
                (this.acks = {}),
                (this.flags = {}),
                (this.io = e),
                (this.nsp = t),
                n && n.auth && (this.auth = n.auth),
                (this._opts = Object.assign({}, n)),
                this.io._autoConnect && this.open());
        }
        get disconnected() {
            return !this.connected;
        }
        subEvents() {
            if (this.subs) return;
            let e = this.io;
            this.subs = [
                Y(e, `open`, this.onopen.bind(this)),
                Y(e, `packet`, this.onpacket.bind(this)),
                Y(e, `error`, this.onerror.bind(this)),
                Y(e, `close`, this.onclose.bind(this)),
            ];
        }
        get active() {
            return !!this.subs;
        }
        connect() {
            return this.connected
                ? this
                : (this.subEvents(),
                  this.io._reconnecting || this.io.open(),
                  this.io._readyState === `open` && this.onopen(),
                  this);
        }
        open() {
            return this.connect();
        }
        send(...e) {
            return (e.unshift(`message`), this.emit.apply(this, e), this);
        }
        emit(e, ...t) {
            if (Lt.hasOwnProperty(e))
                throw Error(`"` + e.toString() + `" is a reserved event name`);
            if ((t.unshift(e), this._opts.retries && !this.flags.fromQueue && !this.flags.volatile))
                return (this._addToQueue(t), this);
            let n = { type: J.EVENT, data: t };
            if (
                ((n.options = {}),
                (n.options.compress = this.flags.compress !== !1),
                typeof t[t.length - 1] == `function`)
            ) {
                let e = this.ids++,
                    r = t.pop();
                (this._registerAckCallback(e, r), (n.id = e));
            }
            let r = this.io.engine?.transport?.writable,
                i = this.connected && !this.io.engine?._hasPingExpired();
            return (
                (this.flags.volatile && !r) ||
                    (i
                        ? (this.notifyOutgoingListeners(n), this.packet(n))
                        : this.sendBuffer.push(n)),
                (this.flags = {}),
                this
            );
        }
        _registerAckCallback(e, t) {
            let n = this.flags.timeout ?? this._opts.ackTimeout;
            if (n === void 0) {
                this.acks[e] = t;
                return;
            }
            let r = this.io.setTimeoutFn(() => {
                    delete this.acks[e];
                    for (let t = 0; t < this.sendBuffer.length; t++)
                        this.sendBuffer[t].id === e && this.sendBuffer.splice(t, 1);
                    t.call(this, Error(`operation has timed out`));
                }, n),
                i = (...e) => {
                    (this.io.clearTimeoutFn(r), t.apply(this, e));
                };
            ((i.withError = !0), (this.acks[e] = i));
        }
        emitWithAck(e, ...t) {
            return new Promise((n, r) => {
                let i = (e, t) => (e ? r(e) : n(t));
                ((i.withError = !0), t.push(i), this.emit(e, ...t));
            });
        }
        _addToQueue(e) {
            let t;
            typeof e[e.length - 1] == `function` && (t = e.pop());
            let n = {
                id: this._queueSeq++,
                tryCount: 0,
                pending: !1,
                args: e,
                flags: Object.assign({ fromQueue: !0 }, this.flags),
            };
            (e.push(
                (e, ...r) => (
                    this._queue[0],
                    e === null
                        ? (this._queue.shift(), t && t(null, ...r))
                        : n.tryCount > this._opts.retries && (this._queue.shift(), t && t(e)),
                    (n.pending = !1),
                    this._drainQueue()
                )
            ),
                this._queue.push(n),
                this._drainQueue());
        }
        _drainQueue(e = !1) {
            if (!this.connected || this._queue.length === 0) return;
            let t = this._queue[0];
            (t.pending && !e) ||
                ((t.pending = !0),
                t.tryCount++,
                (this.flags = t.flags),
                this.emit.apply(this, t.args));
        }
        packet(e) {
            ((e.nsp = this.nsp), this.io._packet(e));
        }
        onopen() {
            typeof this.auth == `function`
                ? this.auth((e) => {
                      this._sendConnectPacket(e);
                  })
                : this._sendConnectPacket(this.auth);
        }
        _sendConnectPacket(e) {
            this.packet({
                type: J.CONNECT,
                data: this._pid
                    ? Object.assign({ pid: this._pid, offset: this._lastOffset }, e)
                    : e,
            });
        }
        onerror(e) {
            this.connected || this.emitReserved(`connect_error`, e);
        }
        onclose(e, t) {
            ((this.connected = !1),
                delete this.id,
                this.emitReserved(`disconnect`, e, t),
                this._clearAcks());
        }
        _clearAcks() {
            Object.keys(this.acks).forEach((e) => {
                if (!this.sendBuffer.some((t) => String(t.id) === e)) {
                    let t = this.acks[e];
                    (delete this.acks[e],
                        t.withError && t.call(this, Error(`socket has been disconnected`)));
                }
            });
        }
        onpacket(e) {
            if (e.nsp === this.nsp)
                switch (e.type) {
                    case J.CONNECT:
                        e.data && e.data.sid
                            ? this.onconnect(e.data.sid, e.data.pid)
                            : this.emitReserved(
                                  `connect_error`,
                                  Error(
                                      `It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)`
                                  )
                              );
                        break;
                    case J.EVENT:
                    case J.BINARY_EVENT:
                        this.onevent(e);
                        break;
                    case J.ACK:
                    case J.BINARY_ACK:
                        this.onack(e);
                        break;
                    case J.DISCONNECT:
                        this.ondisconnect();
                        break;
                    case J.CONNECT_ERROR:
                        this.destroy();
                        let t = Error(e.data.message);
                        ((t.data = e.data.data), this.emitReserved(`connect_error`, t));
                }
        }
        onevent(e) {
            let t = e.data || [];
            (e.id != null && t.push(this.ack(e.id)),
                this.connected ? this.emitEvent(t) : this.receiveBuffer.push(Object.freeze(t)));
        }
        emitEvent(e) {
            if (this._anyListeners && this._anyListeners.length) {
                let t = this._anyListeners.slice();
                for (let n of t) n.apply(this, e);
            }
            (super.emit.apply(this, e),
                this._pid &&
                    e.length &&
                    typeof e[e.length - 1] == `string` &&
                    (this._lastOffset = e[e.length - 1]));
        }
        ack(e) {
            let t = this,
                n = !1;
            return function (...r) {
                n || ((n = !0), t.packet({ type: J.ACK, id: e, data: r }));
            };
        }
        onack(e) {
            let t = this.acks[e.id];
            typeof t == `function` &&
                (delete this.acks[e.id],
                t.withError && e.data.unshift(null),
                t.apply(this, e.data));
        }
        onconnect(e, t) {
            ((this.id = e),
                (this.recovered = t && this._pid === t),
                (this._pid = t),
                (this.connected = !0),
                this.emitBuffered(),
                this._drainQueue(!0),
                this.emitReserved(`connect`));
        }
        emitBuffered() {
            (this.receiveBuffer.forEach((e) => this.emitEvent(e)),
                (this.receiveBuffer = []),
                this.sendBuffer.forEach((e) => {
                    (this.notifyOutgoingListeners(e), this.packet(e));
                }),
                (this.sendBuffer = []));
        }
        ondisconnect() {
            (this.destroy(), this.onclose(`io server disconnect`));
        }
        destroy() {
            ((this.subs &&= (this.subs.forEach((e) => e()), void 0)), this.io._destroy(this));
        }
        disconnect() {
            return (
                this.connected && this.packet({ type: J.DISCONNECT }),
                this.destroy(),
                this.connected && this.onclose(`io client disconnect`),
                this
            );
        }
        close() {
            return this.disconnect();
        }
        compress(e) {
            return ((this.flags.compress = e), this);
        }
        get volatile() {
            return ((this.flags.volatile = !0), this);
        }
        timeout(e) {
            return ((this.flags.timeout = e), this);
        }
        onAny(e) {
            return (
                (this._anyListeners = this._anyListeners || []),
                this._anyListeners.push(e),
                this
            );
        }
        prependAny(e) {
            return (
                (this._anyListeners = this._anyListeners || []),
                this._anyListeners.unshift(e),
                this
            );
        }
        offAny(e) {
            if (!this._anyListeners) return this;
            if (e) {
                let t = this._anyListeners;
                for (let n = 0; n < t.length; n++) if (e === t[n]) return (t.splice(n, 1), this);
            } else this._anyListeners = [];
            return this;
        }
        listenersAny() {
            return this._anyListeners || [];
        }
        onAnyOutgoing(e) {
            return (
                (this._anyOutgoingListeners = this._anyOutgoingListeners || []),
                this._anyOutgoingListeners.push(e),
                this
            );
        }
        prependAnyOutgoing(e) {
            return (
                (this._anyOutgoingListeners = this._anyOutgoingListeners || []),
                this._anyOutgoingListeners.unshift(e),
                this
            );
        }
        offAnyOutgoing(e) {
            if (!this._anyOutgoingListeners) return this;
            if (e) {
                let t = this._anyOutgoingListeners;
                for (let n = 0; n < t.length; n++) if (e === t[n]) return (t.splice(n, 1), this);
            } else this._anyOutgoingListeners = [];
            return this;
        }
        listenersAnyOutgoing() {
            return this._anyOutgoingListeners || [];
        }
        notifyOutgoingListeners(e) {
            if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
                let t = this._anyOutgoingListeners.slice();
                for (let n of t) n.apply(this, e.data);
            }
        }
    };
function zt(e) {
    ((e ||= {}),
        (this.ms = e.min || 100),
        (this.max = e.max || 1e4),
        (this.factor = e.factor || 2),
        (this.jitter = e.jitter > 0 && e.jitter <= 1 ? e.jitter : 0),
        (this.attempts = 0));
}
((zt.prototype.duration = function () {
    var e = this.ms * this.factor ** +this.attempts++;
    if (this.jitter) {
        var t = Math.random(),
            n = Math.floor(t * this.jitter * e);
        e = Math.floor(t * 10) & 1 ? e + n : e - n;
    }
    return Math.min(e, this.max) | 0;
}),
    (zt.prototype.reset = function () {
        this.attempts = 0;
    }),
    (zt.prototype.setMin = function (e) {
        this.ms = e;
    }),
    (zt.prototype.setMax = function (e) {
        this.max = e;
    }),
    (zt.prototype.setJitter = function (e) {
        this.jitter = e;
    }));
var Bt = class extends K {
        constructor(e, t) {
            (super(),
                (this.nsps = {}),
                (this.subs = []),
                e && typeof e == `object` && ((t = e), (e = void 0)),
                (t ||= {}),
                (t.path = t.path || `/socket.io`),
                (this.opts = t),
                Fe(this, t),
                this.reconnection(t.reconnection !== !1),
                this.reconnectionAttempts(t.reconnectionAttempts || 1 / 0),
                this.reconnectionDelay(t.reconnectionDelay || 1e3),
                this.reconnectionDelayMax(t.reconnectionDelayMax || 5e3),
                this.randomizationFactor(t.randomizationFactor ?? 0.5),
                (this.backoff = new zt({
                    min: this.reconnectionDelay(),
                    max: this.reconnectionDelayMax(),
                    jitter: this.randomizationFactor(),
                })),
                this.timeout(t.timeout == null ? 2e4 : t.timeout),
                (this._readyState = `closed`),
                (this.uri = e));
            let n = t.parser || Et;
            ((this.encoder = new n.Encoder()),
                (this.decoder = new n.Decoder()),
                (this._autoConnect = t.autoConnect !== !1),
                this._autoConnect && this.open());
        }
        reconnection(e) {
            return arguments.length
                ? ((this._reconnection = !!e), e || (this.skipReconnect = !0), this)
                : this._reconnection;
        }
        reconnectionAttempts(e) {
            return e === void 0
                ? this._reconnectionAttempts
                : ((this._reconnectionAttempts = e), this);
        }
        reconnectionDelay(e) {
            var t;
            return e === void 0
                ? this._reconnectionDelay
                : ((this._reconnectionDelay = e), (t = this.backoff) == null || t.setMin(e), this);
        }
        randomizationFactor(e) {
            var t;
            return e === void 0
                ? this._randomizationFactor
                : ((this._randomizationFactor = e),
                  (t = this.backoff) == null || t.setJitter(e),
                  this);
        }
        reconnectionDelayMax(e) {
            var t;
            return e === void 0
                ? this._reconnectionDelayMax
                : ((this._reconnectionDelayMax = e),
                  (t = this.backoff) == null || t.setMax(e),
                  this);
        }
        timeout(e) {
            return arguments.length ? ((this._timeout = e), this) : this._timeout;
        }
        maybeReconnectOnOpen() {
            !this._reconnecting &&
                this._reconnection &&
                this.backoff.attempts === 0 &&
                this.reconnect();
        }
        open(e) {
            if (~this._readyState.indexOf(`open`)) return this;
            this.engine = new pt(this.uri, this.opts);
            let t = this.engine,
                n = this;
            ((this._readyState = `opening`), (this.skipReconnect = !1));
            let r = Y(t, `open`, function () {
                    (n.onopen(), e && e());
                }),
                i = (t) => {
                    (this.cleanup(),
                        (this._readyState = `closed`),
                        this.emitReserved(`error`, t),
                        e ? e(t) : this.maybeReconnectOnOpen());
                },
                a = Y(t, `error`, i);
            if (!1 !== this._timeout) {
                let e = this._timeout,
                    n = this.setTimeoutFn(() => {
                        (r(), i(Error(`timeout`)), t.close());
                    }, e);
                (this.opts.autoUnref && n.unref(),
                    this.subs.push(() => {
                        this.clearTimeoutFn(n);
                    }));
            }
            return (this.subs.push(r), this.subs.push(a), this);
        }
        connect(e) {
            return this.open(e);
        }
        onopen() {
            (this.cleanup(), (this._readyState = `open`), this.emitReserved(`open`));
            let e = this.engine;
            this.subs.push(
                Y(e, `ping`, this.onping.bind(this)),
                Y(e, `data`, this.ondata.bind(this)),
                Y(e, `error`, this.onerror.bind(this)),
                Y(e, `close`, this.onclose.bind(this)),
                Y(this.decoder, `decoded`, this.ondecoded.bind(this))
            );
        }
        onping() {
            this.emitReserved(`ping`);
        }
        ondata(e) {
            try {
                this.decoder.add(e);
            } catch (e) {
                this.onclose(`parse error`, e);
            }
        }
        ondecoded(e) {
            Ae(() => {
                this.emitReserved(`packet`, e);
            }, this.setTimeoutFn);
        }
        onerror(e) {
            this.emitReserved(`error`, e);
        }
        socket(e, t) {
            let n = this.nsps[e];
            return (
                n
                    ? this._autoConnect && !n.active && n.connect()
                    : ((n = new Rt(this, e, t)), (this.nsps[e] = n)),
                n
            );
        }
        _destroy(e) {
            let t = Object.keys(this.nsps);
            for (let e of t) if (this.nsps[e].active) return;
            this._close();
        }
        _packet(e) {
            let t = this.encoder.encode(e);
            for (let n = 0; n < t.length; n++) this.engine.write(t[n], e.options);
        }
        cleanup() {
            (this.subs.forEach((e) => e()), (this.subs.length = 0), this.decoder.destroy());
        }
        _close() {
            ((this.skipReconnect = !0), (this._reconnecting = !1), this.onclose(`forced close`));
        }
        disconnect() {
            return this._close();
        }
        onclose(e, t) {
            var n;
            (this.cleanup(),
                (n = this.engine) == null || n.close(),
                this.backoff.reset(),
                (this._readyState = `closed`),
                this.emitReserved(`close`, e, t),
                this._reconnection && !this.skipReconnect && this.reconnect());
        }
        reconnect() {
            if (this._reconnecting || this.skipReconnect) return this;
            let e = this;
            if (this.backoff.attempts >= this._reconnectionAttempts)
                (this.backoff.reset(),
                    this.emitReserved(`reconnect_failed`),
                    (this._reconnecting = !1));
            else {
                let t = this.backoff.duration();
                this._reconnecting = !0;
                let n = this.setTimeoutFn(() => {
                    e.skipReconnect ||
                        (this.emitReserved(`reconnect_attempt`, e.backoff.attempts),
                        !e.skipReconnect &&
                            e.open((t) => {
                                t
                                    ? ((e._reconnecting = !1),
                                      e.reconnect(),
                                      this.emitReserved(`reconnect_error`, t))
                                    : e.onreconnect();
                            }));
                }, t);
                (this.opts.autoUnref && n.unref(),
                    this.subs.push(() => {
                        this.clearTimeoutFn(n);
                    }));
            }
        }
        onreconnect() {
            let e = this.backoff.attempts;
            ((this._reconnecting = !1), this.backoff.reset(), this.emitReserved(`reconnect`, e));
        }
    },
    Vt = {};
function Ht(e, t) {
    (typeof e == `object` && ((t = e), (e = void 0)), (t ||= {}));
    let n = mt(e, t.path || `/socket.io`),
        r = n.source,
        i = n.id,
        a = n.path,
        o = Vt[i] && a in Vt[i].nsps,
        s = t.forceNew || t[`force new connection`] || !1 === t.multiplex || o,
        c;
    return (
        s ? (c = new Bt(r, t)) : (Vt[i] || (Vt[i] = new Bt(r, t)), (c = Vt[i])),
        n.query && !t.query && (t.query = n.queryKey),
        c.socket(n.path, t)
    );
}
Object.assign(Ht, { Manager: Bt, Socket: Rt, io: Ht, connect: Ht });
var Ut = `http://localhost:5055`,
    Wt,
    Gt = (Ut || ``).replace(/\/$/, ``);
function X(e, t = {}) {
    return fetch(`${Gt}${e}`, { ...t, credentials: `include` });
}
function Kt() {
    return ((Wt ||= Ht(Gt || void 0, { withCredentials: !0 })), Wt);
}
var qt = localStorage.getItem(`user`),
    Z = P(qt ? JSON.parse(qt) : { loggedIn: !1 });
Z.subscribe((e) => localStorage.setItem(`user`, JSON.stringify(e)));
var Jt = (e) => {
        (R.pop(),
            R.push(e, {
                theme: {
                    "--toastBackground": `green`,
                    "--toastColor": `white`,
                    "--toastBarBackground": `olive`,
                },
            }));
    },
    Q = (e) => {
        (R.pop(),
            R.push(e, {
                theme: { "--toastBackground": `#F56565`, "--toastBarBackground": `#C53030` },
            }));
    },
    $ = P(!1),
    Yt = k(`<input type="password" maxlength="24" placeholder="Type password here..."/>`),
    Xt = k(
        `<div class="container svelte-1fjnfxl"><div class="infoContainer svelte-1fjnfxl"><div class="majorInfoContainer svelte-1fjnfxl"><div class="majorTextContainer svelte-1fjnfxl"><h2 class="svelte-1fjnfxl"> </h2> <h3 class="svelte-1fjnfxl"> </h3> <h4 class="svelte-1fjnfxl"> </h4> <h4 class="svelte-1fjnfxl"> </h4></div> <img alt="poster" class="svelte-1fjnfxl"/></div> <h4 class="svelte-1fjnfxl"> </h4> <h4 class="svelte-1fjnfxl"> </h4> <h4 class="svelte-1fjnfxl"> </h4> <h4 class="svelte-1fjnfxl"> <svg width="22px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path d="M224 256c70.7 0 128-57.31 128-128S294.7 0 224 0C153.3 0 96 57.31 96 128S153.3 256 224 256zM274.7 304H173.3c-95.73 0-173.3 77.6-173.3 173.3C0 496.5 15.52 512 34.66 512H413.3C432.5 512 448 496.5 448 477.3C448 381.6 370.4 304 274.7 304zM479.1 320h-73.85C451.2 357.7 480 414.1 480 477.3C480 490.1 476.2 501.9 470 512h138C625.7 512 640 497.6 640 479.1C640 391.6 568.4 320 479.1 320zM432 256C493.9 256 544 205.9 544 144S493.9 32 432 32c-25.11 0-48.04 8.555-66.72 22.51C376.8 76.63 384 101.4 384 128c0 35.52-11.93 68.14-31.59 94.71C372.7 243.2 400.8 256 432 256z"></path></svg></h4> <!></div> <button class="joinTheaterButton svelte-1fjnfxl"> </button></div>`
    );
function Zt(t, r) {
    M(r, !0);
    let s = () => re(Z, `$user`, c),
        [c, u] = te(),
        f = Kt(),
        g = C(``),
        _ = C(!1);
    async function v() {
        if (!d(_)) {
            if (new Date(r.theater.timeToClose).getTime() < new Date().getTime()) {
                Q(`Theater is closed`);
                return;
            }
            e(_, !0);
            try {
                let e = await X(`/theaters/` + r.theater._id, {
                        method: `PATCH`,
                        headers: { "Content-Type": `application/json` },
                        body: JSON.stringify({ userID: s().userID, password: d(g), joining: !0 }),
                    }),
                    t = await e.text(),
                    n = {};
                if (t)
                    try {
                        n = JSON.parse(t);
                    } catch {}
                if (!e.ok) {
                    Q(n.message || `Unable to join theater (${e.status})`);
                    return;
                }
                (Jt(n.message || `Successfully joined lobby`),
                    f.emit(`joinedTheater`),
                    O(Z, (p(s).insideTheater = !0), p(s)),
                    ce(se(`/theaters/[id]`, { id: r.theater._id })));
            } catch {
                Q(`Unable to reach the server`);
            } finally {
                e(_, !1);
            }
        }
    }
    var y = Xt(),
        E = o(y),
        D = o(E),
        k = o(D),
        j = o(k),
        ee = o(j, !0);
    I(j);
    var N = h(j, 2),
        P = o(N);
    I(N);
    var L = h(N, 2),
        ne = o(L, !0);
    I(L);
    var ie = h(L, 2),
        ae = o(ie);
    (I(ie), I(k));
    var oe = h(k, 2);
    I(D);
    var R = h(D, 2),
        le = o(R, !0);
    I(R);
    var z = h(R, 2),
        B = o(z);
    I(z);
    var V = h(z, 2),
        ue = o(V);
    I(V);
    var H = h(V, 2),
        de = o(H);
    (T(), I(H));
    var fe = h(H, 2),
        pe = (t) => {
            var n = Yt();
            (w(n),
                a(`focus`, n, () => b($, !1)),
                a(`blur`, n, () => b($, !0)),
                S(
                    n,
                    () => d(g),
                    (t) => e(g, t)
                ),
                A(t, n));
        };
    (n(fe, (e) => {
        r.theater.passwordBool && e(pe);
    }),
        I(E));
    var U = h(E, 2),
        me = o(U, !0);
    (I(U),
        I(y),
        m(
            (e) => {
                (l(ee, r.theater.eventName),
                    l(P, `${r.theater.movieName ?? ``} (${r.theater.movieReleaseYear ?? ``})`),
                    l(ne, r.theater.movieGenres),
                    l(ae, `Runtime: ${r.theater.movieRuntime ?? ``} min`),
                    F(oe, `src`, r.theater.hrefPoster),
                    l(le, r.theater.moviePlot),
                    l(B, `IMDb rating: ${r.theater.imdbRating ?? ``}`),
                    l(ue, `Starts: ${e ?? ``}`),
                    l(
                        de,
                        `${r.theater.usersInsideTheater.length ?? ``}/${r.theater.amountOfSpaces ?? ``} `
                    ),
                    (U.disabled = d(_)),
                    l(me, d(_) ? `Joining...` : `Join`));
            },
            [
                () =>
                    new Date(r.theater.startTime).toLocaleString(`en-US`, {
                        weekday: `long`,
                        hour: `2-digit`,
                        minute: `2-digit`,
                    }),
            ]
        ),
        i(`click`, U, v),
        A(t, y),
        x(),
        u());
}
u([`click`]);
var Qt = k(
        `<div class="container svelte-2jpsc9"><label for="email" class="svelte-2jpsc9">Email</label> <input name="email" type="email" placeholder="Type email here..." class="svelte-2jpsc9"/> <label for="password" class="svelte-2jpsc9">Password</label> <input name="password" type="password" placeholder="Type password here..." maxlength="24" class="svelte-2jpsc9"/> <button id="mainbutton" class="svelte-2jpsc9">Login</button> <div class="otherOptions svelte-2jpsc9"><button class="svelte-2jpsc9">Sign Up</button> <button class="svelte-2jpsc9">Forgot Password</button></div></div>`
    ),
    $t = k(
        `<div class="container svelte-2jpsc9"><label for="email" class="svelte-2jpsc9">Email</label> <input name="email" type="email" placeholder="Type email here..." class="svelte-2jpsc9"/> <label for="username" class="svelte-2jpsc9">Username</label> <input name="username" type="text" placeholder="Type username here..." maxlength="16" class="svelte-2jpsc9"/> <label for="password" class="svelte-2jpsc9">Password</label> <input name="password" type="password" placeholder="Type password here..." maxlength="24" class="svelte-2jpsc9"/> <label for="passwordRepeat" class="svelte-2jpsc9">Repeat Password</label> <input name="passwordRepeat" type="password" placeholder="Type password here..." maxlength="24" class="svelte-2jpsc9"/> <button id="mainbutton" class="svelte-2jpsc9">Create Account</button> <div class="otherOptions svelte-2jpsc9"><button class="svelte-2jpsc9">Back</button></div></div>`
    ),
    en = k(
        `<div class="container svelte-2jpsc9"><label for="email" class="svelte-2jpsc9">Email</label> <input name="email" type="email" placeholder="Type email here..." class="svelte-2jpsc9"/> <button id="mainbutton" class="svelte-2jpsc9">Click here to reset password</button> <div class="otherOptions svelte-2jpsc9"><button class="svelte-2jpsc9">Back</button></div></div>`
    ),
    tn = k(
        `<div class="container svelte-2jpsc9"><label for="token" class="svelte-2jpsc9">Email Code</label> <input name="token" type="text" placeholder="Type code from email here..." class="svelte-2jpsc9"/> <button id="mainbutton" class="svelte-2jpsc9">Click here to confirm</button> <div class="otherOptions svelte-2jpsc9"><button class="svelte-2jpsc9">Back</button></div></div>`
    ),
    nn = k(
        `<div class="container svelte-2jpsc9"><label for="password" class="svelte-2jpsc9">New Password</label> <input name="password" type="password" placeholder="Type password here..." maxlength="24" class="svelte-2jpsc9"/> <label for="passwordRepeat" class="svelte-2jpsc9">Repeat Password</label> <input name="passwordRepeat" type="password" placeholder="Type password here..." maxlength="24" class="svelte-2jpsc9"/> <button id="mainbutton" class="svelte-2jpsc9">Change Password</button> <div class="otherOptions svelte-2jpsc9"><button class="svelte-2jpsc9">Back</button></div></div>`
    ),
    rn = k(`<!> <!> <!> <!> <!>`, 1);
function an(t, r) {
    M(r, !0);
    let a = () => re(Z, `$user`, s),
        [s, c] = te(),
        l = C(void 0),
        u = C(void 0),
        f = C(void 0),
        m = C(void 0),
        _ = C(void 0),
        v = C(!0),
        y = C(!1),
        T = C(!1),
        E = C(!1),
        D = C(!1);
    async function k() {
        let e = await X(`/login`, {
                method: `POST`,
                headers: { "Content-Type": `application/json` },
                body: JSON.stringify({ email: d(l), password: d(f) }),
            }),
            t = await e.json();
        if (e.status === 400) {
            Q(t.message);
            return;
        }
        e.status === 200 &&
            (O(Z, (p(a).loggedIn = !0), p(a)),
            O(Z, (p(a).username = t.data.username), p(a)),
            O(Z, (p(a).userID = t.data._id), p(a)),
            O(
                Z,
                (p(a).playerColor = `#` + Math.floor(Math.random() * 16777215).toString(16)),
                p(a)
            ),
            O(Z, (p(a).insideTheater = !1), p(a)),
            b($, !0),
            r.socket.disconnect().connect(),
            r.socket.emit(`carUpdate`, { name: t.data.username, color: a().playerColor }),
            Jt(t.message));
    }
    async function j() {
        let e = await X(`/users`, {
                method: `POST`,
                headers: { "Content-Type": `application/json` },
                body: JSON.stringify({
                    email: d(l),
                    username: d(u),
                    password: d(f),
                    passwordRepeat: d(m),
                }),
            }),
            t = await e.json();
        if (e.status === 400) {
            Q(t.message);
            return;
        }
        e.status === 200 && (Jt(t.message), F());
    }
    async function ee() {
        let e = await X(`/forgotpassword`, {
                method: `POST`,
                headers: { "Content-Type": `application/json` },
                body: JSON.stringify({ email: d(l) }),
            }),
            t = await e.json();
        if (e.status === 400) {
            Q(t.message);
            return;
        }
        (Jt(t.message), ie(d(l)));
    }
    async function N() {
        let e = await X(`/resetpassword`, {
                method: `POST`,
                headers: { "Content-Type": `application/json` },
                body: JSON.stringify({ email: d(l), token: d(_) }),
            }),
            t = await e.json();
        if (e.status === 400) {
            Q(t.message);
            return;
        }
        ae(d(l), d(_));
    }
    async function P() {
        let e = await X(`/resetpassword`, {
                method: `PATCH`,
                headers: { "Content-Type": `application/json` },
                body: JSON.stringify({
                    email: d(l),
                    token: d(_),
                    password: d(f),
                    passwordRepeat: d(m),
                }),
            }),
            t = await e.json();
        if (e.status === 400) {
            Q(t.message);
            return;
        }
        e.status === 200 && (Jt(t.message), F());
    }
    function F() {
        (e(v, !0), e(y, !1), e(T, !1), e(E, !1), e(D, !1), oe());
    }
    function L() {
        (e(v, !1), e(y, !0), e(T, !1), e(E, !1), e(D, !1), oe());
    }
    function ne() {
        (e(v, !1), e(y, !1), e(T, !0), e(E, !1), e(D, !1), oe());
    }
    function ie(t) {
        (e(v, !1), e(y, !1), e(T, !1), e(E, !0), e(D, !1), oe(), e(l, t, !0));
    }
    function ae(t, n) {
        (e(v, !1), e(y, !1), e(T, !1), e(E, !1), e(D, !0), oe(), e(l, t, !0), e(_, n, !0));
    }
    function oe() {
        (e(l, ``), e(u, ``), e(f, ``), e(m, ``), e(_, ``));
    }
    var se = rn(),
        ce = g(se),
        R = (t) => {
            var n = Qt(),
                r = h(o(n), 2);
            w(r);
            var a = h(r, 4);
            w(a);
            var s = h(a, 2),
                c = h(s, 2),
                u = o(c),
                p = h(u, 2);
            (I(c),
                I(n),
                S(
                    r,
                    () => d(l),
                    (t) => e(l, t)
                ),
                S(
                    a,
                    () => d(f),
                    (t) => e(f, t)
                ),
                i(`click`, s, k),
                i(`click`, u, L),
                i(`click`, p, ne),
                A(t, n));
        };
    n(ce, (e) => {
        d(v) === !0 && e(R);
    });
    var le = h(ce, 2),
        z = (t) => {
            var n = $t(),
                r = h(o(n), 2);
            w(r);
            var a = h(r, 4);
            w(a);
            var s = h(a, 4);
            w(s);
            var c = h(s, 4);
            w(c);
            var p = h(c, 2),
                g = h(p, 2),
                _ = o(g);
            (I(g),
                I(n),
                S(
                    r,
                    () => d(l),
                    (t) => e(l, t)
                ),
                S(
                    a,
                    () => d(u),
                    (t) => e(u, t)
                ),
                S(
                    s,
                    () => d(f),
                    (t) => e(f, t)
                ),
                S(
                    c,
                    () => d(m),
                    (t) => e(m, t)
                ),
                i(`click`, p, j),
                i(`click`, _, F),
                A(t, n));
        };
    n(le, (e) => {
        d(y) === !0 && e(z);
    });
    var B = h(le, 2),
        V = (t) => {
            var n = en(),
                r = h(o(n), 2);
            w(r);
            var a = h(r, 2),
                s = h(a, 2),
                c = o(s);
            (I(s),
                I(n),
                S(
                    r,
                    () => d(l),
                    (t) => e(l, t)
                ),
                i(`click`, a, ee),
                i(`click`, c, F),
                A(t, n));
        };
    n(B, (e) => {
        d(T) === !0 && e(V);
    });
    var ue = h(B, 2),
        H = (t) => {
            var n = tn(),
                r = h(o(n), 2);
            w(r);
            var a = h(r, 2),
                s = h(a, 2),
                c = o(s);
            (I(s),
                I(n),
                S(
                    r,
                    () => d(_),
                    (t) => e(_, t)
                ),
                i(`click`, a, N),
                i(`click`, c, F),
                A(t, n));
        };
    n(ue, (e) => {
        d(E) === !0 && e(H);
    });
    var de = h(ue, 2),
        fe = (t) => {
            var n = nn(),
                r = h(o(n), 2);
            w(r);
            var a = h(r, 4);
            w(a);
            var s = h(a, 2),
                c = h(s, 2),
                l = o(c);
            (I(c),
                I(n),
                S(
                    r,
                    () => d(f),
                    (t) => e(f, t)
                ),
                S(
                    a,
                    () => d(m),
                    (t) => e(m, t)
                ),
                i(`click`, s, P),
                i(`click`, l, F),
                A(t, n));
        };
    (n(de, (e) => {
        d(D) === !0 && e(fe);
    }),
        A(t, se),
        x(),
        c());
}
u([`click`]);
var on = c(
        `<svg width="22px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"></path></svg>`
    ),
    sn = c(
        `<svg fill="#646464" width="22px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M144 192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80V144C80 64.47 144.5 0 224 0C281.5 0 331 33.69 354.1 82.27C361.7 98.23 354.9 117.3 338.1 124.9C322.1 132.5 303.9 125.7 296.3 109.7C283.4 82.63 255.9 64 224 64C179.8 64 144 99.82 144 144L144 192z"></path></svg>`
    ),
    cn = k(
        `<ul class="unorderedList svelte-jmtxgt"><li class="svelte-jmtxgt"></li> <div class="names svelte-jmtxgt"><li class="namesInsideDiv svelte-jmtxgt"> </li> <li class="namesInsideDiv movieName svelte-jmtxgt"> </li></div> <div class="eventInfo svelte-jmtxgt"><div class="eventInfoSingle svelte-jmtxgt"><li class="svelte-jmtxgt"> </li> <li class="svelte-jmtxgt">min</li></div> <div class="eventInfoSingle svelte-jmtxgt"><li class="svelte-jmtxgt"> </li></div> <div class="eventInfoSingle svelte-jmtxgt"><li class="svelte-jmtxgt"> </li></div> <div class="eventInfoSingle svelte-jmtxgt"><li class="svelte-jmtxgt"><!></li></div></div></ul>`
    ),
    ln = k(
        `<div class="container svelte-jmtxgt"><div class="headers svelte-jmtxgt"><ul class="unorderedListHeaders svelte-jmtxgt"><li class="svelte-jmtxgt"></li> <li class="svelte-jmtxgt">Name/Movie</li> <li class="svelte-jmtxgt">Time</li> <li class="svelte-jmtxgt">Starts</li> <li class="svelte-jmtxgt"><svg width="22px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path d="M224 256c70.7 0 128-57.31 128-128S294.7 0 224 0C153.3 0 96 57.31 96 128S153.3 256 224 256zM274.7 304H173.3c-95.73 0-173.3 77.6-173.3 173.3C0 496.5 15.52 512 34.66 512H413.3C432.5 512 448 496.5 448 477.3C448 381.6 370.4 304 274.7 304zM479.1 320h-73.85C451.2 357.7 480 414.1 480 477.3C480 490.1 476.2 501.9 470 512h138C625.7 512 640 497.6 640 479.1C640 391.6 568.4 320 479.1 320zM432 256C493.9 256 544 205.9 544 144S493.9 32 432 32c-25.11 0-48.04 8.555-66.72 22.51C376.8 76.63 384 101.4 384 128c0 35.52-11.93 68.14-31.59 94.71C372.7 243.2 400.8 256 432 256z"></path></svg></li> <li class="svelte-jmtxgt"><svg width="20px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M80 192V144C80 64.47 144.5 0 224 0C303.5 0 368 64.47 368 144V192H384C419.3 192 448 220.7 448 256V448C448 483.3 419.3 512 384 512H64C28.65 512 0 483.3 0 448V256C0 220.7 28.65 192 64 192H80zM144 192H304V144C304 99.82 268.2 64 224 64C179.8 64 144 99.82 144 144V192z"></path></svg></li></ul></div> <div class="list svelte-jmtxgt"></div></div>`
    );
function un(t, r) {
    M(r, !0);
    let a = y(r, `teleportToTheater`, 3, () => {}),
        s = C(0),
        c = C(0),
        u = C(0),
        p = C(0),
        g = [`color: black;`, `color: red;`, `color: green;`];
    function _() {
        (e(s, 0),
            e(u, 0),
            e(p, 0),
            d(c) === 0 || d(c) === 1
                ? (r.theaters.sort((e, t) => {
                      if (e.eventName > t.eventName) return 1;
                      if (e.eventName < t.eventName) return -1;
                  }),
                  e(c, 2))
                : (r.theaters.sort((e, t) => {
                      if (e.eventName < t.eventName) return 1;
                      if (e.eventName > t.eventName) return -1;
                  }),
                  e(c, 1)));
    }
    function v() {
        (e(c, 0),
            e(u, 0),
            e(p, 0),
            d(s) === 0 || d(s) === 1
                ? (r.theaters.sort((e, t) => e.amountOfSpaces - t.amountOfSpaces), e(s, 2))
                : (r.theaters.sort((e, t) => t.amountOfSpaces - e.amountOfSpaces), e(s, 1)));
    }
    function b() {
        (e(s, 0),
            e(c, 0),
            e(p, 0),
            d(u) === 0 || d(u) === 1
                ? (r.theaters.sort((e, t) => t.movieRuntime - e.movieRuntime), e(u, 2))
                : (r.theaters.sort((e, t) => e.movieRuntime - t.movieRuntime), e(u, 1)));
    }
    function S() {
        (e(s, 0),
            e(c, 0),
            e(u, 0),
            d(p) === 0 || d(p) === 1
                ? (r.theaters.sort(
                      (e, t) => new Date(e.startTime).getTime() - new Date(t.startTime).getTime()
                  ),
                  e(p, 2))
                : (r.theaters.sort(
                      (e, t) => new Date(t.startTime).getTime() - new Date(e.startTime).getTime()
                  ),
                  e(p, 1)));
    }
    var w = ln(),
        E = o(w),
        O = o(E),
        k = h(o(O), 2),
        j = h(k, 2),
        ee = h(j, 2),
        N = h(ee, 2),
        te = o(N);
    (I(N), T(2), I(O), I(E));
    var P = h(E, 2);
    (f(
        P,
        21,
        () => r.theaters,
        (e) => e._id,
        (e, t) => {
            var r = cn(),
                s = h(o(r), 2),
                c = o(s),
                u = o(c, !0);
            I(c);
            var f = h(c, 2),
                p = o(f, !0);
            (I(f), I(s));
            var g = h(s, 2),
                _ = o(g),
                v = o(_),
                y = o(v, !0);
            (I(v), T(2), I(_));
            var b = h(_, 2),
                x = o(b),
                S = o(x);
            (I(x), I(b));
            var C = h(b, 2),
                w = o(C),
                E = o(w);
            (I(w), I(C));
            var D = h(C, 2),
                O = o(D),
                k = o(O),
                j = (e) => {
                    var t = on();
                    A(e, t);
                },
                M = (e) => {
                    var t = sn();
                    A(e, t);
                };
            (n(k, (e) => {
                d(t).passwordBool ? e(j) : e(M, -1);
            }),
                I(O),
                I(D),
                I(g),
                I(r),
                m(
                    (e, n) => {
                        (l(u, d(t).eventName),
                            l(p, d(t).movieName),
                            l(y, d(t).movieRuntime),
                            l(S, `${e ?? ``}:${n ?? ``}`),
                            l(
                                E,
                                `${d(t).usersInsideTheater.length ?? ``}/${d(t).amountOfSpaces ?? ``}`
                            ));
                    },
                    [
                        () =>
                            (new Date(d(t).startTime).getHours() < 10 ? `0` : ``) +
                            new Date(d(t).startTime).getHours(),
                        () =>
                            (new Date(d(t).startTime).getMinutes() < 10 ? `0` : ``) +
                            new Date(d(t).startTime).getMinutes(),
                    ]
                ),
                i(`click`, r, () => a()(d(t).position)),
                A(e, r));
        }
    ),
        I(P),
        I(w),
        m(
            (e) => {
                (D(k, g[d(c)]), D(j, g[d(u)]), D(ee, g[d(p)]), F(te, `fill`, e));
            },
            [() => g[d(s)].split(` `)[1].split(`;`)[0]]
        ),
        i(`click`, k, _),
        i(`click`, j, b),
        i(`click`, ee, S),
        i(`click`, N, v),
        A(t, w),
        x());
}
u([`click`]);
var dn = /[a-zA-Z]/,
    fn = (e, t = 0) => [...Array(e).keys()].map((e) => e + t),
    pn = k(`<div></div>`),
    mn = k(`<div class="wrapper svelte-1yesw5o"></div>`);
function hn(e, t) {
    M(t, !1);
    let n = y(t, `color`, 8, `#FF3E00`),
        i = y(t, `unit`, 8, `px`),
        a = y(t, `duration`, 8, `1.5s`),
        o = y(t, `size`, 8, `60`),
        c = y(t, `pause`, 8, !1),
        l = a().match(dn)?.[0] ?? `s`,
        u = a().replace(dn, ``);
    ie();
    var h = mn();
    (f(
        h,
        5,
        () => (s(fn), p(() => fn(3, 0))),
        r,
        (e, t) => {
            var n = pn();
            let r;
            (m(() => {
                ((r = E(n, 1, `cube svelte-1yesw5o`, null, r, { "pause-animation": c() })),
                    D(
                        n,
                        `animation-delay: ${d(t) * (u / 10)}${l ?? ``}; left: ${d(t) * (o() / 3 + o() / 15) + i()};`
                    ));
            }),
                A(e, n));
        }
    ),
        I(h),
        m(() =>
            D(
                h,
                `--size: ${o() ?? ``}${i() ?? ``}; --color: ${n() ?? ``}; --duration: ${a() ?? ``}`
            )
        ),
        A(e, h),
        x());
}
var gn = k(`<div id="loadingSpinner" class="svelte-1yres1s"><!></div>`),
    _n = k(
        `<ul><li id="imageItem" class="svelte-1yres1s"><img alt="poster" class="svelte-1yres1s"/></li> <li> </li> <li></li></ul>`
    ),
    vn = k(
        `<input name="password" type="password" maxlength="24" placeholder="Type password here..." class="svelte-1yres1s"/>`
    ),
    yn = k(`<label for="searchMovie" class="svelte-1yres1s">Private event?</label>`),
    bn = k(
        `<div class="container svelte-1yres1s"><div><label for="eventName" class="svelte-1yres1s">Event name</label> <input name="eventName" type="text" maxlength="18" placeholder="Max 18 chars..." class="svelte-1yres1s"/></div> <div><label for="searchMovie" class="svelte-1yres1s">Search for a movie</label> <input name="searchMovie" type="text" placeholder="Type movie here..." class="svelte-1yres1s"/></div> <div class="movieSearchContainer svelte-1yres1s"><!> <!></div> <div class="inputContainer svelte-1yres1s"><label for="startTime" class="svelte-1yres1s">Time of start</label> <input name="startTime" type="time" class="svelte-1yres1s"/></div> <div class="inputContainer svelte-1yres1s"><label for="amountOfSpaces" class="svelte-1yres1s">Amount of spaces</label> <input id="amountOfSpaceInput" name="amountOfSpaces" type="number" max="99" min="1" placeholder="#" class="svelte-1yres1s"/></div> <div class="passwordInputs svelte-1yres1s"><!> <input id="passwordCheckbox" name="searchMovie" type="checkbox" class="svelte-1yres1s"/></div> <button class="menuButton svelte-1yres1s" id="addTheaterButton">Create Event</button> <button class="menuButton svelte-1yres1s" id="backButton">Back</button></div>`
    );
function xn(t, r) {
    M(r, !0);
    let [s, c] = te(),
        u = y(r, `createEventBool`, 15),
        p = Kt(),
        g = C(``),
        D = C(``),
        O = C(!1),
        k = C(``),
        j = C(void 0),
        ee = C(void 0),
        N = C(``),
        P,
        L = C(!1),
        ne = C(_([]));
    function re() {
        clearTimeout(P);
        let t = d(D).trim();
        if ((e(ne, [], !0), !t)) {
            e(L, !1);
            return;
        }
        (e(L, !0),
            (P = setTimeout(async () => {
                try {
                    let n = await X(`/movies?s=${encodeURIComponent(t)}`),
                        r = await n.json();
                    if (!n.ok) {
                        Q(r.message || `Movie search is temporarily unavailable`);
                        return;
                    }
                    if (r.data && r.data.Response === `False`) {
                        Q(r.data.Error || `No movies found`);
                        return;
                    }
                    if (!r.data || !Array.isArray(r.data.Search)) {
                        Q(`Movie search returned an invalid response`);
                        return;
                    }
                    e(ne, r.data.Search, !0);
                } catch {
                    Q(`Movie search is temporarily unavailable`);
                } finally {
                    e(L, !1);
                }
            }, 2e3)));
    }
    async function ie() {
        let e = await X(`/theaters`, {
                method: `POST`,
                headers: { "Content-Type": `application/json` },
                body: JSON.stringify({
                    data: {
                        eventName: d(g),
                        imdbID: d(N),
                        passwordBool: d(O),
                        password: d(k),
                        amountOfSpaces: d(j),
                        startTime: new Date(new Date().toDateString() + ` ` + d(ee)),
                    },
                }),
            }),
            t = await e.json();
        (e.status === 400 && Q(t.message),
            e.status === 200 && (Jt(t.message), p.emit(`theaterAdded`), ae()));
    }
    function ae() {
        u(!1);
    }
    var se = bn(),
        ce = o(se),
        R = h(o(ce), 2);
    (w(R), I(ce));
    var le = h(ce, 2),
        z = h(o(le), 2);
    (w(z), I(le));
    var B = h(le, 2),
        V = o(B),
        ue = (e) => {
            var t = gn();
            (hn(o(t), { size: `80`, color: `aqua`, unit: `px`, duration: `1s` }), I(t), A(e, t));
        };
    n(V, (e) => {
        d(L) && e(ue);
    });
    var H = h(V, 2);
    (f(
        H,
        17,
        () => d(ne),
        (e) => e.imdbID,
        (t, n) => {
            var r = _n(),
                a = o(r),
                s = o(a);
            I(a);
            var c = h(a, 2),
                u = o(c, !0);
            (I(c),
                T(2),
                I(r),
                m(() => {
                    (E(r, 1, v(d(n).imdbID === d(N) ? `selectedMovie` : ``), `svelte-1yres1s`),
                        F(
                            s,
                            `src`,
                            d(n).Poster === `N/A`
                                ? `https://www.tradeinn.com/f/13772/137720122/jibbitz-question-mark.jpg`
                                : d(n).Poster
                        ),
                        l(u, d(n).Title));
                }),
                i(`click`, r, () => e(N, d(n).imdbID, !0)),
                A(t, r));
        }
    ),
        I(B));
    var de = h(B, 2),
        fe = h(o(de), 2);
    (w(fe), I(de));
    var pe = h(de, 2),
        U = h(o(pe), 2);
    (w(U), I(pe));
    var me = h(pe, 2),
        he = o(me),
        W = (t) => {
            var n = vn();
            (w(n),
                a(`focus`, n, () => b($, !1)),
                a(`blur`, n, () => b($, !0)),
                S(
                    n,
                    () => d(k),
                    (t) => e(k, t)
                ),
                A(t, n));
        },
        G = (e) => {
            var t = yn();
            A(e, t);
        };
    n(he, (e) => {
        d(O) ? e(W) : e(G, -1);
    });
    var ge = h(he, 2);
    (w(ge), I(me));
    var _e = h(me, 2),
        ve = h(_e, 2);
    (I(se),
        a(`focus`, R, () => b($, !1)),
        a(`blur`, R, () => b($, !0)),
        S(
            R,
            () => d(g),
            (t) => e(g, t)
        ),
        i(`change`, z, re),
        a(`focus`, z, () => b($, !1)),
        a(`blur`, z, () => b($, !0)),
        S(
            z,
            () => d(D),
            (t) => e(D, t)
        ),
        S(
            fe,
            () => d(ee),
            (t) => e(ee, t)
        ),
        S(
            U,
            () => d(j),
            (t) => e(j, t)
        ),
        oe(
            ge,
            () => d(O),
            (t) => e(O, t)
        ),
        i(`click`, _e, ie),
        i(`click`, ve, ae),
        A(t, se),
        x(),
        c());
}
u([`change`, `click`]);
var Sn =
    k(`<div class="container svelte-1kt9k62"><p>This webapp is a little project made for my 4th semester, Node.js elective.</p> <p>The assignment was to make a "passion project", with authentication/authorization,
        websockets and express.</p> <p>I chose to use Svelte for my front end, since I enjoy working with it.</p> <p>The purpose of this webapp, is for users to be able to watch movies together, with other
        people, while chatting. You could set up events for your friends, film clubs, communities or
        for anyone who wants to watch!</p> <p>You're only able to create one event at the time, per user. Events can only be created 24
        hours in advance.</p> <p>Hope you enjoy!</p> <button class="menuButton svelte-1kt9k62" id="backButton">Back</button></div>`);
function Cn(e, t) {
    M(t, !0);
    let n = y(t, `aboutPageBool`, 15);
    function r() {
        n(!1);
    }
    var a = Sn(),
        s = h(o(a), 12);
    (I(a), i(`click`, s, r), A(e, a), x());
}
u([`click`]);
var wn = c(
    `<svg class="backgroundimg svelte-177nr3w" xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 400 140" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges"><path stroke="#110626" d="M0 0h400M0 1h190M205 1h195M0 2h8M44 2h12M120 2h20M219 2h70M344 2h56M234 3h32M357 3h43"></path><path stroke="#270f52" d="M190 1h15M8 2h36M56 2h64M140 2h79M289 2h55M0 3h234M266 3h91M0 4h400M0 5h400M0 6h400M0 7h13M31 7h369M0 8h5M40 8h360M0 9h2M50 9h160M255 9h119M392 9h8M60 10h130M267 10h92M70 11h102M276 11h69M80 12h77M284 12h51M97 13h51M122 14h15"></path><path stroke="#33146b" d="M13 7h18M5 8h35M2 9h48M210 9h45M374 9h18M0 10h60M190 10h77M359 10h41M0 11h70M172 11h104M345 11h55M0 12h80M157 12h127M335 12h65M0 13h97M148 13h252M0 14h122M137 14h263M0 15h400M0 16h400M0 17h400M0 18h400M0 19h204M244 19h156M0 20h175M268 20h132M0 21h107M293 21h107M0 22h22M311 22h89M0 23h8M323 23h77M0 24h5M331 24h64M0 25h1M347 25h37"></path><path stroke="#50187a" d="M204 19h40M175 20h93M107 21h186M22 22h289M8 23h315M5 24h326M395 24h5M1 25h346M384 25h16M0 26h400M0 27h400M0 28h400M0 29h400M0 30h327M353 30h47M0 31h267M284 31h24M369 31h31M0 32h261M290 32h4M389 32h11M0 33h257M0 34h216M2 35h183M4 36h168M6 37h157M9 38h43M91 38h65M12 39h12M101 39h48M111 40h32M123 41h13"></path><path stroke="#811685" d="M327 30h26M308 31h61M294 32h95M294 33h106M216 34h38M297 34h103M0 35h2M185 35h66M300 35h100M0 36h4M172 36h77M302 36h98M0 37h6M163 37h84M304 37h96M0 38h9M52 38h39M156 38h76M306 38h94M0 39h12M24 39h77M149 39h69M308 39h92M0 40h111M143 40h62M310 40h90M0 41h8M13 41h110M136 41h55M315 41h43M0 42h4M16 42h156M0 43h2M20 43h147M23 44h138M30 45h86M137 45h17M37 46h72M49 47h49"></path><path stroke="#671d5f" d="M267 31h17M261 32h29M257 33h27M254 34h24M264 35h7"></path><path stroke="#8e1b68" d="M284 33h10M278 34h19M251 35h13M271 35h29M249 36h53M247 37h57M248 38h20M283 38h23M258 39h4M289 39h19M293 40h17M296 41h10"></path><path stroke="#b01979" d="M232 38h13M218 39h25M205 40h36M8 41h5M191 41h49M311 41h4M358 41h42M4 42h12M172 42h66M313 42h87M2 43h18M167 43h70M314 43h86M0 44h23M161 44h75M315 44h85M0 45h30M116 45h21M154 45h81M316 45h84M0 46h37M109 46h125M317 46h83M0 47h49M98 47h135M318 47h82M0 48h232M319 48h81M0 49h231M320 49h80M0 50h230M321 50h79M0 51h229M322 51h63M0 52h228M323 52h52M0 53h227M324 53h43M0 54h162M194 54h33M324 54h38M6 55h131M212 55h14M325 55h30M21 56h103M326 56h22M34 57h69M326 57h15M61 58h24"></path><path stroke="#b21e5e" d="M245 38h3M243 39h15M241 40h17M240 41h15M306 41h5M238 42h14M299 42h14M237 43h13M301 43h13M236 44h12M303 44h12M235 45h11M305 45h11M234 46h11M306 46h11M233 47h10M308 47h10M232 48h10M309 48h10M231 49h10M310 49h10M230 50h9M312 50h9M229 51h9M313 51h9M228 52h9M314 52h9M227 53h9M315 53h9M227 54h9M315 54h9M226 55h9M316 55h9M227 56h7M317 56h9M318 57h8M318 58h8"></path><path stroke="#9d256d" d="M268 38h15M262 39h27M269 40h24M291 41h5"></path><path stroke="#c12763" d="M258 40h11M255 41h36M252 42h47M250 43h51M248 44h55M246 45h22M283 45h22M245 46h18M288 46h18M243 47h17M291 47h17M242 48h15M294 48h15M241 49h14M296 49h14M239 50h14M298 50h14M238 51h13M300 51h13M237 52h12M302 52h12M236 53h12M303 53h12M236 54h11M304 54h11M235 55h11M305 55h11M234 56h6M307 56h10M308 57h10M309 58h9"></path><path stroke="#c13072" d="M268 45h15M263 46h25M260 47h31M257 48h37M255 49h41M253 50h16M282 50h16M251 51h14M286 51h14M249 52h13M289 52h13M248 53h11M292 53h11M247 54h10M294 54h10M246 55h9M296 55h9M297 56h10M299 57h9"></path><path stroke="#ff9900" d="M269 50h13M265 51h21M262 52h27M259 53h33M257 54h37M255 55h41M254 56h43M252 57h47M251 58h49M250 59h51M249 60h53M248 61h55M247 62h4M296 62h8"></path><path stroke="#d12291" d="M385 51h15M375 52h25M367 53h33M162 54h32M362 54h38M0 55h6M137 55h75M355 55h45M0 56h21M124 56h101M348 56h52M0 57h34M103 57h122M341 57h59M0 58h61M85 58h139M327 58h73M0 59h224M327 59h73M0 60h223M328 60h72M0 61h223M328 61h72M0 62h222M329 62h71M0 63h222M329 63h71M0 64h222M329 64h70M0 65h60M94 65h127M330 65h52M0 66h39M113 66h108M339 66h27M0 67h24M131 67h90M0 68h15M148 68h73M0 69h4M169 69h52"></path><path stroke="#cc2571" d="M225 56h2M225 57h8M224 58h9M326 58h1M224 59h8M319 59h8M223 60h8M320 60h8M223 61h8M320 61h8M222 62h8M321 62h8M222 63h8M321 63h8M222 64h8M321 64h8M221 65h8M322 65h8M221 66h8M221 67h8M221 68h7M221 69h2"></path><path stroke="#db2f76" d="M240 56h4M233 57h10M233 58h9M232 59h9M310 59h9M231 60h10M310 60h10M231 61h9M311 61h9M230 62h9M312 62h9M230 63h8M313 63h8M230 64h8M313 64h8M229 65h8M314 65h8M229 66h8M229 67h7M228 68h8"></path><path stroke="#db3884" d="M244 56h10M243 57h9M242 58h9M300 58h9M241 59h9M301 59h9M241 60h8M302 60h8M240 61h8M303 61h8M239 62h8M304 62h8M238 63h8M305 63h8M238 64h7M306 64h7M237 65h7M307 65h7M237 66h6M236 67h7M236 68h6"></path><path stroke="#ff8800" d="M251 62h45M246 63h59M245 64h61M244 65h63M243 66h65M243 67h65M243 68h46"></path><path stroke="#7e10a3" d="M399 64h1M60 65h34M382 65h18M39 66h74M330 66h9M366 66h34M24 67h107M330 67h70M15 68h133M330 68h70M4 69h165M330 69h70M0 70h220M331 70h69M0 71h220M331 71h69M0 72h220M331 72h69M0 73h220M331 73h69M0 74h220M331 74h69M0 75h220"></path><path stroke="#9a2992" d="M308 66h6M308 67h7M309 68h6M236 69h6M309 69h6M235 70h6M310 70h6M235 71h5M311 71h5M235 72h5M311 72h5M234 73h6M311 73h6M234 74h5M312 74h5M234 75h5"></path><path stroke="#9a2084" d="M314 66h8M315 67h7M315 68h8M228 69h8M315 69h8M228 70h7M316 70h7M228 71h7M316 71h7M228 72h7M316 72h7M228 73h6M317 73h6M228 74h6M317 74h6M228 75h6"></path><path stroke="#8b177f" d="M322 66h8M322 67h8M323 68h7M223 69h5M323 69h7M220 70h8M323 70h8M220 71h8M323 71h8M220 72h8M323 72h8M220 73h8M323 73h8M220 74h8M323 74h8M220 75h8"></path><path stroke="#ff7300" d="M242 68h1M289 68h20M242 69h67M241 70h69M240 71h71M240 72h71M240 73h10"></path><path stroke="#ff4800" d="M250 73h61M239 74h72M239 75h73M239 76h28"></path><path stroke="#bc21eb" d="M311 74h1M238 76h1"></path><path stroke="#ce86e0" d="M312 75h23M216 76h22"></path><path stroke="#3458eb" d="M335 75h65M0 76h216"></path><path stroke="#e9d4ff" d="M267 76h42M245 77h46M256 78h20M261 79h4M276 79h5M265 80h7"></path><path stroke="#fa76d0" d="M309 76h23M219 77h26M291 77h37M221 78h6M234 78h22M276 78h34M228 79h6M255 79h6M265 79h11M310 79h2M251 80h4"></path><path stroke="#1e3ebd" d="M332 76h68M0 77h219"></path><path stroke="#2c23cf" d="M328 77h72M0 78h221M322 78h78M0 79h223M325 79h75M0 80h25M63 80h159M224 80h2M330 80h70M0 81h154M213 81h11M318 81h82M0 82h232M327 82h73M0 83h244M306 83h51M391 83h9M0 84h88M139 84h103M291 84h5M310 84h90M0 85h228M242 85h7M314 85h86M0 86h236M316 86h84M0 87h245M324 87h76M0 88h74M123 88h111M319 88h23M384 88h16M0 89h171M204 89h40M253 89h1M295 89h8M315 89h85M0 90h253M294 90h1M301 90h99M0 91h19M92 91h149M314 91h86M0 92h144M179 92h53M242 92h22M326 92h74M0 93h242M284 93h2M301 93h9M320 93h80M0 94h253M256 94h10M312 94h88M0 95h255M302 95h98M0 96h223M337 96h63M0 97h204M387 97h13M18 98h82M140 98h52M42 99h139M66 100h105M84 101h78M108 102h41"></path><path stroke="#8d55e0" d="M227 78h7M310 78h12M223 79h5M234 79h21M304 79h6M312 79h13M222 80h2M226 80h25M255 80h9M281 80h49M224 81h33M272 81h5M286 81h32M232 82h9M280 82h47M249 83h1M279 83h1M295 83h11"></path><path stroke="#ffc2ec" d="M281 79h23M272 80h9M257 81h15M243 82h14M244 83h5M249 84h42M269 85h8M263 86h7M287 86h5M270 87h21M275 88h7M271 89h4M271 90h2M273 91h12M283 92h12M277 93h6M273 94h4M271 95h4M275 96h12M281 97h13M275 98h6M275 99h7M282 100h11M285 101h10M280 102h5M278 103h2M278 104h8M286 105h13M287 106h6M283 107h4M283 108h6M289 109h3M287 110h2M287 111h1M287 112h4M286 113h3M285 114h1M286 115h5M290 116h3M290 117h1M290 118h2M291 119h2M292 120h1M292 121h2M294 122h2M295 123h2M297 124h2M297 125h2M297 126h1M298 127h1M298 128h2M300 129h2M302 130h2M304 131h3"></path><path stroke="#443beb" d="M25 80h38M154 81h59M357 83h34M88 84h51M74 88h49M342 88h42M171 89h33M19 91h73M144 92h35M100 98h40"></path><path stroke="#b2daff" d="M264 80h1M277 81h9M264 82h16M280 83h15M277 85h8M285 86h2M260 87h10M291 87h33M234 88h26M273 88h2M282 88h4M275 89h18M269 90h2M273 90h20M265 91h8M279 92h4M313 92h13M287 93h9M310 93h3M272 94h1M277 94h15M300 94h10M275 95h14M296 95h4M287 96h9M277 97h4M273 98h2M281 98h12M261 99h12M282 99h9M255 100h6M278 100h4M293 100h2M239 101h16M277 101h8M287 102h6M283 103h4M248 104h30M286 104h28M309 105h4M281 106h6M306 106h3M279 107h4M287 107h7M301 107h5M289 108h3M295 108h6M281 109h5M292 109h3M280 110h7M289 110h5M278 111h7M288 111h4M269 112h9M282 112h5M265 113h4M282 113h4M289 113h5M263 114h22M286 114h2M290 114h4M291 115h11M287 116h3M293 116h8M302 116h16M294 117h5M318 117h4M292 118h5M309 118h10M289 119h2M303 119h6M293 120h10M288 121h4M294 121h5M281 122h7M291 122h3M296 122h5M278 123h7M301 123h2M285 124h12M299 124h22M296 125h1M298 126h5M299 127h5M301 128h10M297 129h3M308 129h3M295 130h2M301 130h1M304 130h5M298 131h3M302 131h2M297 132h7M301 133h7M302 134h3M301 135h7M303 136h2M303 137h5M305 138h6M308 139h3"></path><path stroke="#5062eb" d="M241 82h2M257 82h7M250 83h29M242 84h7M296 84h14M228 85h14M249 85h20M285 85h29M236 86h27M270 86h15M292 86h24M245 87h15M289 88h30M254 89h17M303 89h12M267 90h2M293 90h1"></path><path stroke="#469beb" d="M260 88h13M286 88h3M244 89h9M293 89h2M253 90h14M295 90h6M241 91h24M285 91h29M232 92h10M264 92h15M295 92h18M242 93h35M283 93h1M286 93h1M296 93h5M313 93h7M253 94h3M266 94h6M292 94h8M310 94h2M255 95h16M289 95h7M300 95h2M260 96h15M296 96h10M255 97h22M294 97h12M260 98h13M293 98h17M260 99h1M273 99h2M291 99h20M272 100h6M295 100h12M268 101h7M264 102h16M285 102h2M293 102h17M277 103h1M280 103h3M287 103h11M275 105h6M293 106h2M297 106h2M276 107h2M280 109h1M294 110h5"></path><path stroke="#0f46bd" d="M223 96h37M306 96h31M204 97h51M306 97h81M0 98h18M192 98h68M310 98h90M0 99h42M181 99h79M311 99h89M0 100h66M171 100h84M261 100h11M307 100h93M0 101h84M162 101h77M255 101h13M275 101h2M295 101h105M0 102h108M149 102h115M310 102h17M339 102h61M0 103h277M298 103h102M0 104h248M314 104h86M0 105h264M299 105h10M313 105h87M0 106h105M140 106h127M299 106h7M309 106h22M370 106h30M0 107h272M274 107h2M311 107h89M0 108h14M83 108h188M310 108h90M0 109h267M271 109h9M301 109h99M0 110h267M299 110h101M0 111h155M216 111h56M292 111h4M303 111h69M398 111h2M0 112h45M85 112h184M314 112h86M0 113h265M269 113h3M304 113h96M0 114h263M296 114h104M0 115h280M377 115h23M0 116h74M161 116h112M394 116h6M0 117h258M0 118h241M0 119h226M23 120h184M42 121h148M66 122h113M84 123h89M132 124h19"></path><path stroke="#1656e0" d="M327 102h12M105 106h35M331 106h39M14 108h69M155 111h61M372 111h26M45 112h40M74 116h87"></path><path stroke="#80bcf5" d="M264 105h11M281 105h5M267 106h14M295 106h2M272 107h2M278 107h1M294 107h7M306 107h5M271 108h12M292 108h3M301 108h9M267 109h4M286 109h3M295 109h6M267 110h13M272 111h6M285 111h2M296 111h7M278 112h4M291 112h23M272 113h10M294 113h10M288 114h2M294 114h2M280 115h6M302 115h9M281 116h6M277 117h13M291 117h3M299 117h12M277 118h8M308 118h1M280 119h9M293 119h10M282 120h9M299 121h8M289 122h2M301 122h12M290 123h5M297 123h4M303 123h5M299 125h16M303 126h6M294 127h4M304 127h7M297 128h1M300 128h1M302 129h6M300 130h1M307 131h3"></path><path stroke="#177aeb" d="M311 115h66M273 116h8M301 116h1M318 116h76M258 117h19M311 117h7M322 117h78M241 118h36M285 118h5M297 118h11M319 118h81M226 119h54M309 119h91M0 120h23M207 120h75M291 120h1M303 120h97M0 121h42M190 121h98M307 121h24M372 121h28M0 122h66M179 122h102M288 122h1M313 122h87M0 123h84M173 123h105M285 123h5M308 123h92M0 124h132M151 124h134M321 124h79M0 125h8M65 125h231M315 125h85M0 126h297M309 126h91M0 127h294M311 127h89M0 128h178M206 128h91M311 128h89M0 129h297M311 129h45M375 129h25M0 130h295M297 130h3M309 130h91M0 131h298M301 131h1M310 131h90M0 132h297M304 132h96M0 133h301M308 133h92M0 134h48M190 134h112M305 134h95M0 135h301M308 135h9M382 135h18M0 136h303M305 136h95M0 137h303M308 137h92M0 138h305M311 138h89M0 139h308M311 139h89"></path><path stroke="#2e93ff" d="M331 121h41M8 125h57M178 128h28M356 129h19M48 134h142M317 135h65"></path></svg>`
);
function Tn(e) {
    var t = wn();
    A(e, t);
}
var En = c(
    `<svg class="streetSign svelte-7p1br3" xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 28 17" shape-rendering="crispEdges"><path stroke="#163d1d" d="M1 0h23M0 1h1M24 1h1M0 2h1M25 2h1M0 3h1M26 3h1M0 4h1M27 4h1M0 5h1M26 5h1M0 6h1M25 6h1M0 7h1M24 7h1M0 8h24"></path><path stroke="#25592e" d="M1 1h2M5 1h19M1 2h1M3 2h22M1 3h1M3 3h2M6 3h2M9 3h1M11 3h1M13 3h2M17 3h2M21 3h5M1 4h1M4 4h1M6 4h5M12 4h3M16 4h1M18 4h1M20 4h1M22 4h5M1 5h1M3 5h2M6 5h2M9 5h2M12 5h3M16 5h1M18 5h1M21 5h5M1 6h1M3 6h3M7 6h1M9 6h1M11 6h1M13 6h2M17 6h2M20 6h1M22 6h3M1 7h23"></path><path stroke="#f7f5ed" d="M3 1h2M2 2h1M2 3h1M5 3h1M8 3h1M10 3h1M12 3h1M15 3h2M19 3h2M2 4h2M5 4h1M11 4h1M15 4h1M17 4h1M19 4h1M21 4h1M2 5h1M5 5h1M8 5h1M11 5h1M15 5h1M17 5h1M19 5h2M2 6h1M6 6h1M8 6h1M10 6h1M12 6h1M15 6h2M19 6h1M21 6h1"></path><path stroke="#4d4d4d" d="M4 9h1M19 9h1M4 10h1M19 10h1M4 11h1M19 11h1M4 12h1M19 12h1M4 13h1M19 13h1M4 14h1M19 14h1M4 15h1M19 15h1"></path><path stroke="#5c585c" d="M5 9h1M20 9h1M5 10h1M20 10h1M5 11h1M20 11h1M5 12h1M20 12h1M5 13h1M20 13h1M5 14h1M20 14h1M5 15h1M20 15h1"></path><path stroke="#a1855a" d="M18 15h1M2 16h5M17 16h5"></path></svg>`
);
function Dn(e) {
    var t = En();
    A(e, t);
}
var On = c(
    `<svg width="40px" xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 19 23" shape-rendering="crispEdges"><path stroke="rgb(100, 100, 100)" d="M0 0h15M0 1h15M0 2h6M13 2h2M0 3h2M4 3h4M13 3h2M0 4h2M6 4h4M13 4h2M0 5h2M8 5h2M13 5h2M0 6h2M8 6h2M13 6h2M0 7h2M8 7h2M13 7h2M0 8h2M8 8h2M13 8h2M0 9h2M8 9h2M16 9h2M0 10h2M8 10h2M11 10h8M0 11h2M8 11h2M11 11h8M0 12h2M8 12h2M16 12h2M0 13h2M8 13h2M13 13h2M0 14h2M8 14h2M13 14h2M0 15h2M8 15h2M13 15h2M0 16h2M8 16h2M13 16h2M0 17h2M8 17h2M13 17h2M0 18h2M8 18h7M0 19h4M8 19h7M2 20h4M8 20h2M4 21h6M6 22h4"></path></svg>`
);
function kn(e) {
    var t = On();
    A(e, t);
}
var An = c(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 150 223" shape-rendering="crispEdges"><path stroke="#331b02" d="M14 0h128M14 1h1M141 1h1M14 2h1M141 2h1M14 3h1M141 3h1M14 4h1M141 4h1M14 5h1M141 5h1M14 6h1M141 6h1M14 7h1M141 7h1M14 8h1M141 8h1M14 9h1M141 9h1M14 10h1M141 10h1M14 11h1M141 11h1M14 12h1M141 12h1M14 13h1M141 13h1M14 14h1M141 14h1M14 15h1M141 15h1M14 16h1M141 16h1M14 17h1M141 17h1M14 18h1M141 18h1M14 19h1M141 19h1M14 20h1M141 20h1M14 21h1M141 21h1M14 22h1M141 22h1M14 23h1M141 23h1M14 24h1M141 24h1M14 25h1M141 25h1M14 26h1M141 26h1M14 27h1M141 27h1M14 28h1M141 28h1M14 29h1M141 29h1M14 30h1M141 30h1M14 31h1M141 31h1M14 32h1M141 32h1M14 33h1M141 33h1M14 34h1M141 34h1M14 35h1M141 35h1M14 36h1M141 36h1M14 37h1M141 37h1M14 38h1M141 38h1M14 39h1M141 39h1M14 40h1M141 40h1M14 41h1M141 41h1M14 42h1M141 42h1M14 43h1M141 43h1M14 44h1M141 44h1M14 45h1M141 45h1M14 46h1M141 46h1M14 47h1M141 47h1M14 48h1M141 48h1M14 49h1M141 49h1M14 50h1M141 50h1M14 51h1M141 51h1M14 52h1M141 52h1M14 53h1M141 53h1M14 54h1M141 54h1M14 55h1M141 55h1M14 56h1M141 56h1M14 57h1M141 57h1M14 58h1M141 58h1M14 59h1M141 59h1M14 60h1M141 60h1M14 61h1M141 61h1M14 62h1M141 62h1M14 63h1M141 63h1M14 64h1M141 64h1M14 65h1M141 65h1M14 66h1M141 66h1M14 67h1M141 67h1M14 68h1M141 68h1M14 69h128M19 70h3M134 70h3M19 71h3M134 71h3M19 72h3M134 72h3M19 73h3M134 73h3M19 74h3M134 74h3M19 75h3M134 75h3"></path><path stroke="#ffffff" d="M15 1h126M15 2h126M15 3h126M15 4h126M15 5h126M15 6h126M15 7h126M15 8h126M15 9h126M15 10h126M15 11h126M15 12h126M15 13h126M15 14h126M15 15h126M15 16h126M15 17h126M15 18h126M15 19h126M15 20h126M15 21h126M15 22h126M15 23h126M15 24h126M15 25h126M15 26h126M15 27h126M15 28h126M15 29h126M15 30h126M15 31h126M15 32h126M15 33h126M15 34h126M15 35h126M15 36h126M15 37h126M15 38h126M15 39h126M15 40h126M15 41h126M15 42h126M15 43h126M15 44h126M15 45h126M15 46h126M15 47h126M15 48h126M15 49h126M15 50h126M15 51h126M15 52h126M15 53h126M15 54h126M15 55h126M15 56h126M15 57h126M15 58h126M15 59h126M15 60h126M15 61h126M15 62h126M15 63h126M15 64h126M15 65h126M15 66h126M15 67h126M15 68h126"></path><path stroke="#8f8f8f" d="M0 49h1M9 49h5M142 49h3M148 49h2M0 50h11M143 50h7M3 51h3M144 51h2"></path><path stroke="#b39464" d="M11 50h3M142 50h1M0 51h3M6 51h5M143 51h1M146 51h4M3 52h4M144 52h2M0 67h4M0 68h10M148 68h2M0 69h14M144 69h6M0 70h9M11 70h8M23 70h74M142 70h8M0 71h7M11 71h8M23 71h78M138 71h3M144 71h6M0 72h7M11 72h8M23 72h82M137 72h5M147 72h3M0 73h6M10 73h9M23 73h86M137 73h7M149 73h1M0 74h6M10 74h1M18 74h1M23 74h92M129 74h4M137 74h8M1 75h4M16 75h3M24 75h107M138 75h10M2 76h3M14 76h3M25 76h105M139 76h2M148 76h1M3 77h2M13 77h127M4 78h1M18 78h125M20 79h61M116 79h32M19 80h48M119 80h30M21 81h38M123 81h27M15 82h3M23 82h27M125 82h23M11 83h10M23 83h20M126 83h20M10 84h29M128 84h17M2 85h3M12 85h23M129 85h15M149 85h1M0 86h5M7 86h1M13 86h19M130 86h13M147 86h3M0 87h5M7 87h1M14 87h15M131 87h11M146 87h4M0 88h5M7 88h1M15 88h13M132 88h10M143 88h7M0 89h5M7 89h2M15 89h11M136 89h14M0 90h5M7 90h3M15 90h9M141 90h9M0 91h5M7 91h5M15 91h5M147 91h3M0 92h5M131 115h1M130 116h8M130 117h9M141 117h5M130 118h9M141 118h5M149 118h1M0 119h3M129 119h10M141 119h9M0 120h11M129 120h10M141 120h9M0 121h26M129 121h10M141 121h9M0 122h26M128 122h11M141 122h9M0 123h27M128 123h11M141 123h9M0 124h28M128 124h11M141 124h9M0 125h28M128 125h11M141 125h9M0 126h29M128 126h11M141 126h9M0 127h30M128 127h11M141 127h9M0 128h30M128 128h11M141 128h9M0 129h31M128 129h11M141 129h9M0 130h31M128 130h11M141 130h9M0 131h32M128 131h22M0 132h32M128 132h22M0 133h33M128 133h22M0 134h33M128 134h22M0 135h33M129 135h21M0 136h33M129 136h21M0 137h33M129 137h21M0 138h33M130 138h20M0 139h33M130 139h20M0 140h33M131 140h19M0 141h33M131 141h19M0 142h32M131 142h19M0 143h32M132 143h18M0 144h31M132 144h18M7 145h23M133 145h11M14 146h16M16 147h13M97 207h2M106 207h2M113 207h3M85 208h3M94 208h2M101 208h2M104 208h5M110 208h3M116 208h2M137 208h1M0 209h7M19 209h1M49 209h4M54 209h6M62 209h2M65 209h3M71 209h6M80 209h4M88 209h2M93 209h2M102 209h3M109 209h2M117 209h1M120 209h3M132 209h4M138 209h2M145 209h5M0 210h1M6 210h3M17 210h1M20 210h2M27 210h4M32 210h5M48 210h1M53 210h1M63 210h2M69 210h3M80 210h1M89 210h5M103 210h2M115 210h7M125 210h10M139 210h6M149 210h1M8 211h10M21 211h10M35 211h2M42 211h1M48 211h1M58 211h1M64 211h1M67 211h3M114 211h1M129 211h1M134 211h1M142 211h1M8 212h3M15 212h2M22 212h1M29 212h1M43 212h1M46 212h2M58 212h2M113 212h1M142 212h1M46 213h2M57 213h3M59 214h3"></path><path stroke="#dbaf6d" d="M11 51h3M142 51h1M0 52h3M7 52h7M142 52h2M146 52h4M0 53h14M142 53h8M0 54h14M142 54h8M0 55h14M142 55h8M0 56h14M142 56h8M0 57h14M142 57h8M0 58h14M142 58h8M0 59h14M142 59h8M0 60h14M142 60h8M0 61h14M142 61h8M0 62h14M142 62h8M0 63h14M142 63h8M0 64h14M142 64h8M0 65h14M142 65h8M0 66h14M142 66h8M4 67h10M142 67h8M10 68h4M142 68h6M142 69h2M97 70h36M137 70h5M101 71h32M137 71h1M105 72h28M109 73h24M115 74h14M132 89h4M133 90h8M20 91h3M133 91h14M7 92h5M15 92h7M134 92h16M0 93h5M7 93h14M134 93h16M0 94h5M7 94h13M135 94h15M0 95h5M7 95h13M135 95h15M0 96h5M7 96h12M135 96h8M145 96h5M0 97h5M7 97h12M135 97h6M145 97h5M0 98h5M7 98h11M136 98h5M145 98h5M0 99h5M7 99h11M136 99h4M144 99h6M2 100h3M7 100h11M136 100h4M144 100h1M0 101h5M7 101h11M136 101h3M0 102h5M7 102h11M136 102h3M148 102h2M0 103h5M7 103h11M137 103h2M147 103h3M2 104h3M7 104h11M138 104h1M4 105h15M3 106h16M5 107h14M0 108h2M7 108h12M149 108h1M0 109h5M7 109h12M145 109h5M0 110h20M144 110h6M0 111h20M133 111h1M136 111h3M146 111h4M0 112h20M132 112h7M141 112h1M147 112h3M0 113h21M132 113h7M141 113h1M148 113h2M0 114h22M132 114h7M141 114h1M149 114h1M0 115h23M132 115h7M141 115h2M149 115h1M0 116h23M138 116h1M141 116h3M149 116h1M0 117h23M149 117h1M0 118h24M3 119h22M11 120h14M13 202h28M111 202h32M4 203h59M96 203h53M0 204h150M0 205h150M0 206h150M0 207h97M99 207h7M108 207h5M116 207h34M0 208h85M88 208h6M103 208h1M109 208h1M118 208h19M138 208h12M7 209h12M20 209h29M53 209h1M60 209h2M64 209h1M68 209h3M77 209h3M90 209h3M118 209h2M123 209h9M140 209h5M9 210h8M22 210h5M31 210h1M37 210h11M68 210h1M43 211h5"></path><path stroke="#79bd26" d="M9 70h1M7 71h3M142 71h2M7 72h2M143 72h4M6 73h2M146 73h3M6 74h1M5 75h2M5 76h1M141 76h7M5 77h1M148 77h1M5 78h1M12 78h6M11 79h2M146 83h1M145 84h2M10 85h2M144 85h2M11 86h2M143 86h2M12 87h2M13 88h2M14 89h1M143 96h1M126 97h2M141 97h3M127 98h4M141 98h2M130 99h3M140 99h2M140 100h1M139 101h2M125 102h7M139 102h1M132 103h1M139 103h1M0 104h2M139 104h1M146 104h4M145 105h2M130 109h1M129 110h2M128 111h2M144 111h2M127 112h2M145 112h2M146 113h2M147 114h2M148 115h1M107 209h2M115 209h2M136 209h2M18 210h2M58 210h5M65 210h3M84 210h2M105 210h1M108 210h2M114 210h1M137 210h2M19 211h2M59 211h2M86 211h1M105 211h2M113 211h1M138 211h3M17 212h1M20 212h2M44 212h2M60 212h1M106 212h1M112 212h1M17 213h1M21 213h1M43 213h2M60 213h2M87 213h1M111 213h1M17 214h1M17 215h1M22 215h4M45 215h1M45 216h1"></path><path stroke="#4b7038" d="M10 70h1M10 71h1M141 71h1M9 72h2M142 72h1M8 73h2M144 73h2M7 74h3M11 74h7M145 74h5M0 75h1M7 75h4M148 75h2M6 76h3M0 77h1M6 77h3M140 77h8M149 77h1M0 78h2M6 78h2M149 78h1M1 79h2M5 79h2M13 79h7M2 80h2M5 80h1M10 80h9M0 81h2M9 81h2M20 81h1M0 82h2M6 82h1M8 82h1M22 82h1M148 82h2M0 83h2M6 83h1M8 83h1M147 83h3M9 84h1M147 84h1M9 85h1M9 86h2M9 87h3M142 87h1M10 88h3M142 88h1M11 89h3M13 90h2M13 91h2M14 92h1M144 96h1M125 97h1M144 97h1M126 98h1M143 98h2M128 99h2M142 99h2M0 100h2M129 100h5M141 100h3M145 100h5M132 101h3M141 101h4M140 102h3M124 103h8M133 103h2M140 103h3M133 104h3M140 104h2M0 105h4M135 105h2M139 105h2M147 105h3M0 106h3M136 106h2M139 106h1M144 106h6M4 107h1M134 107h2M143 107h2M6 108h1M132 108h4M140 108h1M142 108h1M131 109h5M140 109h1M142 109h1M131 110h1M143 110h1M143 111h1M143 112h2M126 113h1M143 113h3M126 114h1M144 114h3M145 115h3M147 116h2M147 117h2M148 118h1M105 209h2M114 209h1M107 210h1M113 210h1M135 210h1M18 211h1M61 211h1M65 211h2M84 211h2M107 211h2M111 211h2M135 211h2M141 211h1M19 212h1M61 212h2M65 212h1M84 212h1M86 212h1M111 212h1M136 212h1M20 213h1M45 213h1M62 213h1M85 213h1M110 213h1M137 213h1M20 214h2M43 214h1M45 214h1M62 214h1M85 214h1M109 214h2M21 215h1M24 216h2M42 216h1M23 217h2M22 218h2M22 219h1"></path><path stroke="#63370b" d="M22 70h1M133 70h1M22 71h1M133 71h1M22 72h1M133 72h1M22 73h1M133 73h1M22 74h1M133 74h1M22 75h1M133 75h1"></path><path stroke="#244015" d="M11 75h5M0 76h2M9 76h5M149 76h1M1 77h2M9 77h4M2 78h2M8 78h4M143 78h6M0 79h1M3 79h2M7 79h4M148 79h2M0 80h2M4 80h1M6 80h4M149 80h1M2 81h7M11 81h9M2 82h4M7 82h1M9 82h6M18 82h4M2 83h3M7 83h1M9 83h2M21 83h2M0 84h4M6 84h3M148 84h2M0 85h2M7 85h2M146 85h3M8 86h1M145 86h2M8 87h1M143 87h3M8 88h2M9 89h2M10 90h3M12 91h1M12 92h2M145 101h5M133 102h3M143 102h5M135 103h2M143 103h4M127 104h6M136 104h2M142 104h4M132 105h3M137 105h2M141 105h4M133 106h3M138 106h1M140 106h4M0 107h4M136 107h7M145 107h5M2 108h4M136 108h4M141 108h1M143 108h6M5 109h2M136 109h3M141 109h1M143 109h2M132 110h6M140 110h3M130 111h3M134 111h2M141 111h2M129 112h2M142 112h1M127 113h3M142 113h1M142 114h2M143 115h2M144 116h3M146 117h1M146 118h2M113 208h3M111 209h3M106 210h1M110 210h3M136 210h1M62 211h2M109 211h2M137 211h1M18 212h1M63 212h2M85 212h1M107 212h4M137 212h5M18 213h2M64 213h2M86 213h1M107 213h3M139 213h3M18 214h2M44 214h1M65 214h1M86 214h2M107 214h2M137 214h1M18 215h3M43 215h2M87 215h1M108 215h2M18 216h1M20 216h4M44 216h1M109 216h1M18 217h1M20 217h3M42 217h1M18 218h1M21 218h1M21 219h1"></path><path stroke="#a1855a" d="M23 75h1M131 75h2M137 75h1M17 76h8M130 76h9M81 79h35M67 80h52M59 81h64M50 82h75M43 83h83M39 84h89M35 85h94M32 86h98M29 87h102M28 88h104M26 89h85M24 90h78M47 91h50M55 92h34M63 93h20M94 114h24M82 115h49M78 116h52M72 117h58M66 118h64M60 119h69M57 120h72M26 121h103M26 122h102M27 123h101M28 124h100M28 125h100M29 126h99M30 127h98M30 128h98M31 129h97M31 130h97M32 131h96M32 132h96M33 133h95M33 134h95M33 135h96M33 136h96M33 137h96M33 138h97M33 139h97M33 140h98M33 141h98M32 142h99M32 143h100M31 144h101M30 145h34M98 145h35M30 146h26M105 146h29M29 147h17M108 147h17M8 213h1"></path><path stroke="#805233" d="M5 83h1M4 84h2M5 85h2M5 86h2M5 87h2M5 88h2M5 89h2M5 90h2M5 91h2M5 92h2M5 93h2M5 94h2M5 95h2M5 96h2M5 97h2M5 98h2M5 99h2M5 100h2M5 101h2M5 102h2M5 103h2M5 104h2M139 109h1M138 110h2M139 111h2M139 112h2M139 113h2M139 114h2M139 115h2M139 116h2M139 117h2M139 118h2M139 119h2M139 120h2M139 121h2M139 122h2M139 123h2M139 124h2M139 125h2M139 126h2M139 127h2M139 128h2M139 129h2M139 130h2M63 213h1M138 213h1M63 214h2M138 214h3M86 215h1M107 215h1M19 216h1M43 216h1M107 216h2M19 217h1M43 217h1M108 217h2M19 218h2M19 219h2"></path><path stroke="#c79d5f" d="M111 89h21M102 90h31M23 91h24M97 91h36M22 92h33M89 92h45M21 93h42M83 93h51M20 94h115M20 95h115M19 96h116M19 97h106M128 97h7M18 98h108M131 98h5M18 99h110M133 99h3M18 100h111M134 100h2M18 101h114M135 101h1M18 102h107M132 102h1M18 103h106M18 104h109M19 105h113M19 106h114M19 107h115M19 108h113M19 109h111M20 110h109M20 111h108M20 112h107M131 112h1M21 113h105M130 113h2M22 114h72M118 114h8M127 114h5M23 115h59M23 116h55M23 117h49M24 118h42M25 119h35M25 120h32"></path><path stroke="#6e6860" d="M0 145h7M64 145h34M144 145h6M0 146h14M56 146h49M134 146h16M0 147h16M46 147h62M125 147h25M0 148h150M0 149h150M0 150h150M0 151h150M0 152h150M0 153h150M0 154h150M0 155h150M0 156h150M0 157h150M0 158h150M0 159h150M0 160h150M0 161h150M0 162h150M0 163h150M0 164h150M0 165h150M0 166h150M0 167h150M0 168h150M21 169h9M53 169h8M84 169h9M113 169h8M142 169h8M21 170h9M53 170h8M84 170h9M113 170h8M142 170h8M0 171h150M0 172h150M0 173h150M0 174h150M0 175h150M0 176h150M0 177h150M0 178h150M0 179h150M0 180h150M0 181h150M0 182h150M0 183h150M0 184h150M0 185h150M0 186h150M0 187h150M0 188h150M0 189h150M0 190h150M0 191h150M0 192h150M0 193h150M0 194h150M0 195h150M0 196h150M0 197h150M0 198h150M0 199h150M0 200h150M0 201h150M0 202h13M41 202h70M143 202h7M0 203h4M63 203h33M149 203h1"></path><path stroke="#c2c2c2" d="M0 169h21M30 169h23M61 169h23M93 169h20M121 169h21M0 170h21M30 170h23M61 170h23M93 170h20M121 170h21"></path><path stroke="#918e8b" d="M96 208h5M84 209h4M95 209h2M101 209h1M1 210h5M49 210h4M54 210h4M72 210h8M81 210h3M87 210h2M94 210h2M102 210h1M122 210h3M145 210h4M0 211h1M5 211h3M31 211h4M37 211h5M49 211h1M52 211h2M57 211h1M70 211h3M79 211h3M88 211h7M102 211h3M115 211h7M124 211h5M130 211h4M143 211h3M149 211h1M7 212h1M11 212h4M23 212h6M30 212h2M34 212h4M41 212h2M48 212h2M53 212h1M56 212h2M66 212h5M79 212h2M89 212h1M94 212h2M102 212h1M104 212h1M114 212h2M120 212h2M125 212h1M128 212h3M134 212h2M143 212h1M149 212h1M7 213h1M14 213h3M22 213h2M28 213h3M34 213h2M42 213h1M48 213h1M52 213h5M70 213h1M79 213h2M88 213h2M96 213h1M101 213h2M104 213h1M112 213h2M121 213h2M124 213h2M129 213h1M135 213h2M142 213h2M148 213h1M7 214h2M15 214h1M30 214h1M34 214h1M46 214h3M52 214h1M56 214h3M70 214h1M79 214h4M88 214h1M96 214h5M104 214h1M112 214h1M122 214h4M128 214h2M136 214h1M143 214h3M7 215h1M15 215h1M30 215h2M34 215h1M47 215h6M58 215h6M71 215h11M83 215h3M88 215h1M96 215h1M99 215h6M112 215h1M121 215h2M125 215h5M136 215h1M138 215h1M145 215h2M7 216h1M14 216h2M30 216h5M48 216h1M51 216h2M59 216h2M64 216h1M70 216h2M76 216h2M81 216h1M88 216h2M95 216h2M100 216h1M103 216h1M105 216h2M112 216h2M119 216h4M126 216h1M129 216h10M145 216h5M0 217h1M7 217h8M29 217h3M33 217h6M41 217h1M44 217h1M46 217h3M51 217h2M59 217h1M64 217h2M69 217h2M77 217h5M89 217h7M97 217h4M103 217h3M113 217h7M122 217h5M130 217h2M138 217h8M149 217h1M0 218h8M12 218h3M17 218h1M28 218h2M31 218h3M38 218h4M44 218h2M47 218h2M52 218h3M58 218h2M64 218h6M80 218h2M99 218h1M110 218h3M130 218h1M145 218h1M0 219h2M8 219h2M14 219h4M24 219h4M34 219h3M47 219h1M54 219h5M60 219h5M81 219h1M99 219h1M112 219h2M129 219h1M146 219h1M0 220h1M9 220h2M22 220h3M36 220h1M47 220h1M65 220h2M81 220h1M98 220h2M113 220h3M129 220h1M146 220h1M1 221h1M10 221h2M21 221h1M37 221h1M46 221h2M66 221h1M82 221h1M98 221h1M115 221h1M129 221h1M146 221h1M149 221h1M11 222h2M20 222h2M37 222h1M45 222h4M66 222h1M82 222h1M98 222h1M115 222h2M129 222h1M146 222h1"></path><path stroke="#bdbab6" d="M97 209h3M86 210h1M99 210h2M1 211h4M50 211h2M73 211h6M87 211h1M123 211h1M146 211h3M6 212h1M38 212h2M72 212h2M116 212h4M127 212h1M131 212h2M145 212h2M6 213h1M11 213h2M25 213h3M36 213h3M67 213h3M114 213h1M127 213h2M142 214h1M46 215h1M61 216h3M84 216h4M87 217h2M106 217h2M121 217h1M135 217h3M30 218h1M43 218h1M46 218h1M88 218h5M104 218h5M121 218h4M139 218h3M5 219h3M28 219h5M44 219h3M59 219h1M55 220h4"></path><path stroke="#a6a09c" d="M100 209h1M96 210h3M101 210h1M54 211h3M82 211h2M95 211h7M122 211h1M0 212h6M32 212h2M40 212h1M50 212h3M54 212h2M71 212h1M74 212h5M81 212h3M87 212h2M90 212h4M96 212h6M103 212h1M105 212h1M122 212h3M126 212h1M133 212h1M144 212h1M147 212h2M0 213h6M13 213h1M24 213h1M31 213h3M39 213h3M49 213h3M66 213h1M71 213h8M84 213h1M90 213h6M97 213h2M103 213h1M105 213h2M115 213h6M123 213h1M126 213h1M130 213h5M144 213h4M149 213h1M0 214h7M9 214h6M16 214h1M22 214h8M31 214h3M35 214h8M49 214h3M53 214h3M66 214h4M71 214h8M89 214h7M101 214h3M105 214h2M111 214h1M113 214h9M126 214h2M130 214h5M141 214h1M148 214h2M0 215h7M8 215h7M16 215h1M26 215h4M32 215h2M35 215h8M53 215h5M64 215h7M82 215h1M89 215h5M97 215h2M105 215h2M110 215h2M113 215h5M123 215h2M130 215h1M137 215h1M139 215h6M149 215h1M0 216h6M13 216h1M16 216h2M26 216h4M35 216h1M40 216h2M46 216h2M49 216h2M53 216h6M65 216h4M72 216h4M78 216h3M82 216h2M90 216h2M97 216h3M101 216h2M104 216h1M110 216h2M114 216h1M123 216h3M127 216h2M139 216h3M144 216h1M1 217h1M15 217h3M25 217h3M32 217h1M45 217h1M49 217h2M56 217h3M60 217h4M71 217h6M82 217h5M96 217h1M101 217h2M110 217h3M120 217h1M127 217h3M132 217h3M146 217h3M8 218h4M15 218h2M24 218h1M34 218h4M42 218h1M49 218h3M57 218h1M60 218h3M70 218h10M82 218h6M93 218h6M100 218h4M109 218h1M113 218h8M125 218h5M131 218h8M142 218h3M146 218h4M2 219h3M10 219h4M18 219h1M33 219h1M37 219h7M49 219h5M65 219h16M83 219h14M100 219h12M114 219h15M130 219h16M147 219h3M1 220h8M11 220h11M25 220h11M37 220h10M49 220h6M59 220h6M67 220h14M83 220h14M100 220h13M117 220h12M131 220h15M147 220h3M2 221h8M12 221h9M22 221h14M38 221h8M50 221h16M68 221h14M83 221h14M99 221h15M118 221h11M131 221h14M147 221h2M13 222h7M22 222h1M38 222h7M56 222h10M83 222h2M99 222h8M128 222h1"></path><path stroke="#756b64" d="M9 213h2"></path><path stroke="#858482" d="M81 213h3M99 213h2M83 214h2M135 214h1M146 214h2M94 215h2M118 215h3M131 215h5M147 215h2M6 216h1M8 216h5M36 216h4M69 216h1M92 216h3M115 216h4M142 216h2M2 217h5M28 217h1M39 217h2M53 217h3M66 217h3M25 218h3M55 218h2M63 218h1M48 219h1M82 219h1M97 219h2M48 220h1M82 220h1M97 220h1M116 220h1M130 220h1M0 221h1M36 221h1M48 221h2M67 221h1M97 221h1M114 221h1M116 221h2M130 221h1M145 221h1M0 222h11M23 222h14M49 222h7M67 222h15M85 222h13M107 222h8M117 222h11M130 222h16M147 222h3"></path><path stroke="#615c58" d="M23 219h1"></path><text y="78" x="52%">Empty</text></svg>`
);
function jn(e) {
    var t = An(),
        n = h(o(t), 20);
    (E(n, 0, `movieTitle ${`neoncolor` + Math.floor(Math.random() * 5)}`), I(t), A(e, t));
}
var Mn = c(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 48 18" shape-rendering="crispEdges" preserveAspectRatio="xMaxYMax meet" class="svelte-ww66fb"><text class="carName svelte-ww66fb" font-size="10px" font-weight="bold"> </text><path stroke="#000000" d="M22 0h2M21 1h1M23 1h1M20 2h1M22 2h1M19 3h1M21 3h1M18 4h1M20 4h1M27 4h2M34 4h4M17 5h1M19 5h1M26 5h1M28 5h1M33 5h1M35 5h1M38 5h3M9 6h8M18 6h17M41 6h6M4 7h5M17 7h1M30 7h1M46 7h1M2 8h2M17 8h1M27 8h2M31 8h1M46 8h1M1 9h1M16 9h1M31 9h1M46 9h1M0 10h1M7 10h4M16 10h1M30 10h1M35 10h4M47 10h1M0 11h1M6 11h1M11 11h1M16 11h1M30 11h1M34 11h1M39 11h1M47 11h1M0 12h3M5 12h1M12 12h1M16 12h1M29 12h1M33 12h1M40 12h1M44 12h4M0 13h1M3 13h3M12 13h22M40 13h4M47 13h1M1 14h1M5 14h1M12 14h1M33 14h1M40 14h1M45 14h2M2 15h4M12 15h22M40 15h5M6 16h1M11 16h1M34 16h1M39 16h1M7 17h4M35 17h4"></path><path d="M22 1h1M21 2h1M20 3h1M19 4h1M18 5h1M36 5h2M17 6h1M35 6h6M9 7h8M18 7h12M31 7h15M4 8h13M18 8h9M29 8h2M32 8h14M2 9h14M17 9h14M32 9h14M1 10h6M11 10h5M17 10h13M31 10h4M39 10h8M1 11h5M12 11h4M17 11h13M31 11h3M40 11h7M3 12h2M13 12h3M17 12h12M30 12h3M41 12h3M1 13h2M44 13h3M2 14h3M13 14h20M41 14h4"></path><path stroke="#613c0c" d="M27 5h1M34 5h1"></path><path stroke="#333333" d="M7 11h4M35 11h4M6 12h2M10 12h2M34 12h2M38 12h2M6 13h1M11 13h1M34 13h1M39 13h1M6 14h1M11 14h1M34 14h1M39 14h1M6 15h2M10 15h2M34 15h2M38 15h2M7 16h4M35 16h4"></path><path stroke="#7a7a7a" d="M8 12h2M36 12h2M7 13h1M10 13h1M35 13h1M38 13h1M7 14h1M10 14h1M35 14h1M38 14h1M8 15h2M36 15h2"></path><path stroke="#ababab" d="M8 13h2M36 13h2M8 14h2M36 14h2"></path></svg>`
);
function Nn(e, t) {
    var n = Mn(),
        r = o(n),
        i = o(r, !0);
    I(r);
    var a = h(r, 2);
    (T(4),
        I(n),
        m(() => {
            (F(n, `transform`, t.facingLeft === !1 ? `scale(-1, 1)` : ``),
                F(r, `transform`, t.facingLeft === !1 ? `scale(-1, 1)` : ``),
                F(r, `transform-origin`, t.facingLeft === !1 ? `50% 50%` : ``),
                l(i, t.name),
                F(a, `stroke`, t.color));
        }),
        A(e, n));
}
var Pn = c(
        `<text class="eventInfo svelte-1fikqxh" y="20" x="67%">Starts at:</text><text class="eventInfo startTime svelte-1fikqxh" y="26" x="67%"> </text>`,
        1
    ),
    Fn = c(
        `<text class="eventInfo startTime svelte-1fikqxh" y="23" x="67%">Currently showing</text>`
    ),
    In = c(`<text class="eventInfo closing svelte-1fikqxh" y="23" x="67%">Closing</text>`),
    Ln = c(`<text class="eventInfo closed svelte-1fikqxh" y="23" x="67%">Closed</text>`),
    Rn = c(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 150 223" shape-rendering="crispEdges"><path stroke="#331b02" d="M14 0h128M14 1h1M141 1h1M14 2h1M141 2h1M14 3h1M141 3h1M14 4h1M141 4h1M14 5h1M141 5h1M14 6h1M141 6h1M14 7h1M141 7h1M14 8h1M141 8h1M14 9h1M141 9h1M14 10h1M141 10h1M14 11h1M141 11h1M14 12h1M141 12h1M14 13h1M141 13h1M14 14h1M141 14h1M14 15h1M141 15h1M14 16h1M141 16h1M14 17h1M141 17h1M14 18h1M141 18h1M14 19h1M141 19h1M14 20h1M141 20h1M14 21h1M141 21h1M14 22h1M141 22h1M14 23h1M141 23h1M14 24h1M141 24h1M14 25h1M141 25h1M14 26h1M141 26h1M14 27h1M141 27h1M14 28h1M141 28h1M14 29h1M141 29h1M14 30h1M141 30h1M14 31h1M141 31h1M14 32h1M141 32h1M14 33h1M141 33h1M14 34h1M141 34h1M14 35h1M141 35h1M14 36h1M141 36h1M14 37h1M141 37h1M14 38h1M141 38h1M14 39h1M141 39h1M14 40h1M141 40h1M14 41h1M141 41h1M14 42h1M141 42h1M14 43h1M141 43h1M14 44h1M141 44h1M14 45h1M141 45h1M14 46h1M141 46h1M14 47h1M141 47h1M14 48h1M141 48h1M14 49h1M141 49h1M14 50h1M141 50h1M14 51h1M141 51h1M14 52h1M141 52h1M14 53h1M141 53h1M14 54h1M141 54h1M14 55h1M141 55h1M14 56h1M141 56h1M14 57h1M141 57h1M14 58h1M141 58h1M14 59h1M141 59h1M14 60h1M141 60h1M14 61h1M141 61h1M14 62h1M141 62h1M14 63h1M141 63h1M14 64h1M141 64h1M14 65h1M141 65h1M14 66h1M141 66h1M14 67h1M141 67h1M14 68h1M141 68h1M14 69h128M19 70h3M134 70h3M19 71h3M134 71h3M19 72h3M134 72h3M19 73h3M134 73h3M19 74h3M134 74h3M19 75h3M134 75h3"></path><path stroke="#ffffff" d="M15 1h126M15 2h126M15 3h126M15 4h126M15 5h126M15 6h126M15 7h126M15 8h126M15 9h126M15 10h126M15 11h126M15 12h126M15 13h126M15 14h126M15 15h126M15 16h126M15 17h126M15 18h126M15 19h126M15 20h126M15 21h126M15 22h126M15 23h126M15 24h126M15 25h126M15 26h126M15 27h126M15 28h126M15 29h126M15 30h126M15 31h126M15 32h126M15 33h126M15 34h126M15 35h126M15 36h126M15 37h126M15 38h126M15 39h126M15 40h126M15 41h126M15 42h126M15 43h126M15 44h126M15 45h126M15 46h126M15 47h126M15 48h126M15 49h126M15 50h126M15 51h126M15 52h126M15 53h126M15 54h126M15 55h126M15 56h126M15 57h126M15 58h126M15 59h126M15 60h126M15 61h126M15 62h126M15 63h126M15 64h126M15 65h126M15 66h126M15 67h126M15 68h126"></path><path stroke="#8f8f8f" d="M0 49h1M9 49h5M142 49h3M148 49h2M0 50h11M143 50h7M3 51h3M144 51h2"></path><path stroke="#b39464" d="M11 50h3M142 50h1M0 51h3M6 51h5M143 51h1M146 51h4M3 52h4M144 52h2M0 67h4M0 68h10M148 68h2M0 69h14M144 69h6M0 70h9M11 70h8M23 70h74M142 70h8M0 71h7M11 71h8M23 71h78M138 71h3M144 71h6M0 72h7M11 72h8M23 72h82M137 72h5M147 72h3M0 73h6M10 73h9M23 73h86M137 73h7M149 73h1M0 74h6M10 74h1M18 74h1M23 74h92M129 74h4M137 74h8M1 75h4M16 75h3M24 75h107M138 75h10M2 76h3M14 76h3M25 76h105M139 76h2M148 76h1M3 77h2M13 77h127M4 78h1M18 78h125M20 79h61M116 79h32M19 80h48M119 80h30M21 81h38M123 81h27M15 82h3M23 82h27M125 82h23M11 83h10M23 83h20M126 83h20M10 84h29M128 84h17M2 85h3M12 85h23M129 85h15M149 85h1M0 86h5M7 86h1M13 86h19M130 86h13M147 86h3M0 87h5M7 87h1M14 87h15M131 87h11M146 87h4M0 88h5M7 88h1M15 88h13M132 88h10M143 88h7M0 89h5M7 89h2M15 89h11M136 89h14M0 90h5M7 90h3M15 90h9M141 90h9M0 91h5M7 91h5M15 91h5M147 91h3M0 92h5M131 115h1M130 116h8M130 117h9M141 117h5M130 118h9M141 118h5M149 118h1M0 119h3M129 119h10M141 119h9M0 120h11M129 120h10M141 120h9M0 121h26M129 121h10M141 121h9M0 122h26M128 122h11M141 122h9M0 123h27M128 123h11M141 123h9M0 124h28M128 124h11M141 124h9M0 125h28M128 125h11M141 125h9M0 126h29M128 126h11M141 126h9M0 127h30M128 127h11M141 127h9M0 128h30M128 128h11M141 128h9M0 129h31M128 129h11M141 129h9M0 130h31M128 130h11M141 130h9M0 131h32M128 131h22M0 132h32M128 132h22M0 133h33M128 133h22M0 134h33M128 134h22M0 135h33M129 135h21M0 136h33M129 136h21M0 137h33M129 137h21M0 138h33M130 138h20M0 139h33M130 139h20M0 140h33M131 140h19M0 141h33M131 141h19M0 142h32M131 142h19M0 143h32M132 143h18M0 144h31M132 144h18M7 145h23M133 145h11M14 146h16M16 147h13M97 207h2M106 207h2M113 207h3M85 208h3M94 208h2M101 208h2M104 208h5M110 208h3M116 208h2M137 208h1M0 209h7M19 209h1M49 209h4M54 209h6M62 209h2M65 209h3M71 209h6M80 209h4M88 209h2M93 209h2M102 209h3M109 209h2M117 209h1M120 209h3M132 209h4M138 209h2M145 209h5M0 210h1M6 210h3M17 210h1M20 210h2M27 210h4M32 210h5M48 210h1M53 210h1M63 210h2M69 210h3M80 210h1M89 210h5M103 210h2M115 210h7M125 210h10M139 210h6M149 210h1M8 211h10M21 211h10M35 211h2M42 211h1M48 211h1M58 211h1M64 211h1M67 211h3M114 211h1M129 211h1M134 211h1M142 211h1M8 212h3M15 212h2M22 212h1M29 212h1M43 212h1M46 212h2M58 212h2M113 212h1M142 212h1M46 213h2M57 213h3M59 214h3"></path><path stroke="#dbaf6d" d="M11 51h3M142 51h1M0 52h3M7 52h7M142 52h2M146 52h4M0 53h14M142 53h8M0 54h14M142 54h8M0 55h14M142 55h8M0 56h14M142 56h8M0 57h14M142 57h8M0 58h14M142 58h8M0 59h14M142 59h8M0 60h14M142 60h8M0 61h14M142 61h8M0 62h14M142 62h8M0 63h14M142 63h8M0 64h14M142 64h8M0 65h14M142 65h8M0 66h14M142 66h8M4 67h10M142 67h8M10 68h4M142 68h6M142 69h2M97 70h36M137 70h5M101 71h32M137 71h1M105 72h28M109 73h24M115 74h14M132 89h4M133 90h8M20 91h3M133 91h14M7 92h5M15 92h7M134 92h16M0 93h5M7 93h14M134 93h16M0 94h5M7 94h13M135 94h15M0 95h5M7 95h13M135 95h15M0 96h5M7 96h12M135 96h8M145 96h5M0 97h5M7 97h12M135 97h6M145 97h5M0 98h5M7 98h11M136 98h5M145 98h5M0 99h5M7 99h11M136 99h4M144 99h6M2 100h3M7 100h11M136 100h4M144 100h1M0 101h5M7 101h11M136 101h3M0 102h5M7 102h11M136 102h3M148 102h2M0 103h5M7 103h11M137 103h2M147 103h3M2 104h3M7 104h11M138 104h1M4 105h15M3 106h16M5 107h14M0 108h2M7 108h12M149 108h1M0 109h5M7 109h12M145 109h5M0 110h20M144 110h6M0 111h20M133 111h1M136 111h3M146 111h4M0 112h20M132 112h7M141 112h1M147 112h3M0 113h21M132 113h7M141 113h1M148 113h2M0 114h22M132 114h7M141 114h1M149 114h1M0 115h23M132 115h7M141 115h2M149 115h1M0 116h23M138 116h1M141 116h3M149 116h1M0 117h23M149 117h1M0 118h24M3 119h22M11 120h14M13 202h28M111 202h32M4 203h59M96 203h53M0 204h150M0 205h150M0 206h150M0 207h97M99 207h7M108 207h5M116 207h34M0 208h85M88 208h6M103 208h1M109 208h1M118 208h19M138 208h12M7 209h12M20 209h29M53 209h1M60 209h2M64 209h1M68 209h3M77 209h3M90 209h3M118 209h2M123 209h9M140 209h5M9 210h8M22 210h5M31 210h1M37 210h11M68 210h1M43 211h5"></path><path stroke="#79bd26" d="M9 70h1M7 71h3M142 71h2M7 72h2M143 72h4M6 73h2M146 73h3M6 74h1M5 75h2M5 76h1M141 76h7M5 77h1M148 77h1M5 78h1M12 78h6M11 79h2M146 83h1M145 84h2M10 85h2M144 85h2M11 86h2M143 86h2M12 87h2M13 88h2M14 89h1M143 96h1M126 97h2M141 97h3M127 98h4M141 98h2M130 99h3M140 99h2M140 100h1M139 101h2M125 102h7M139 102h1M132 103h1M139 103h1M0 104h2M139 104h1M146 104h4M145 105h2M130 109h1M129 110h2M128 111h2M144 111h2M127 112h2M145 112h2M146 113h2M147 114h2M148 115h1M107 209h2M115 209h2M136 209h2M18 210h2M58 210h5M65 210h3M84 210h2M105 210h1M108 210h2M114 210h1M137 210h2M19 211h2M59 211h2M86 211h1M105 211h2M113 211h1M138 211h3M17 212h1M20 212h2M44 212h2M60 212h1M106 212h1M112 212h1M17 213h1M21 213h1M43 213h2M60 213h2M87 213h1M111 213h1M17 214h1M17 215h1M22 215h4M45 215h1M45 216h1"></path><path stroke="#4b7038" d="M10 70h1M10 71h1M141 71h1M9 72h2M142 72h1M8 73h2M144 73h2M7 74h3M11 74h7M145 74h5M0 75h1M7 75h4M148 75h2M6 76h3M0 77h1M6 77h3M140 77h8M149 77h1M0 78h2M6 78h2M149 78h1M1 79h2M5 79h2M13 79h7M2 80h2M5 80h1M10 80h9M0 81h2M9 81h2M20 81h1M0 82h2M6 82h1M8 82h1M22 82h1M148 82h2M0 83h2M6 83h1M8 83h1M147 83h3M9 84h1M147 84h1M9 85h1M9 86h2M9 87h3M142 87h1M10 88h3M142 88h1M11 89h3M13 90h2M13 91h2M14 92h1M144 96h1M125 97h1M144 97h1M126 98h1M143 98h2M128 99h2M142 99h2M0 100h2M129 100h5M141 100h3M145 100h5M132 101h3M141 101h4M140 102h3M124 103h8M133 103h2M140 103h3M133 104h3M140 104h2M0 105h4M135 105h2M139 105h2M147 105h3M0 106h3M136 106h2M139 106h1M144 106h6M4 107h1M134 107h2M143 107h2M6 108h1M132 108h4M140 108h1M142 108h1M131 109h5M140 109h1M142 109h1M131 110h1M143 110h1M143 111h1M143 112h2M126 113h1M143 113h3M126 114h1M144 114h3M145 115h3M147 116h2M147 117h2M148 118h1M105 209h2M114 209h1M107 210h1M113 210h1M135 210h1M18 211h1M61 211h1M65 211h2M84 211h2M107 211h2M111 211h2M135 211h2M141 211h1M19 212h1M61 212h2M65 212h1M84 212h1M86 212h1M111 212h1M136 212h1M20 213h1M45 213h1M62 213h1M85 213h1M110 213h1M137 213h1M20 214h2M43 214h1M45 214h1M62 214h1M85 214h1M109 214h2M21 215h1M24 216h2M42 216h1M23 217h2M22 218h2M22 219h1"></path><path stroke="#63370b" d="M22 70h1M133 70h1M22 71h1M133 71h1M22 72h1M133 72h1M22 73h1M133 73h1M22 74h1M133 74h1M22 75h1M133 75h1"></path><path stroke="#244015" d="M11 75h5M0 76h2M9 76h5M149 76h1M1 77h2M9 77h4M2 78h2M8 78h4M143 78h6M0 79h1M3 79h2M7 79h4M148 79h2M0 80h2M4 80h1M6 80h4M149 80h1M2 81h7M11 81h9M2 82h4M7 82h1M9 82h6M18 82h4M2 83h3M7 83h1M9 83h2M21 83h2M0 84h4M6 84h3M148 84h2M0 85h2M7 85h2M146 85h3M8 86h1M145 86h2M8 87h1M143 87h3M8 88h2M9 89h2M10 90h3M12 91h1M12 92h2M145 101h5M133 102h3M143 102h5M135 103h2M143 103h4M127 104h6M136 104h2M142 104h4M132 105h3M137 105h2M141 105h4M133 106h3M138 106h1M140 106h4M0 107h4M136 107h7M145 107h5M2 108h4M136 108h4M141 108h1M143 108h6M5 109h2M136 109h3M141 109h1M143 109h2M132 110h6M140 110h3M130 111h3M134 111h2M141 111h2M129 112h2M142 112h1M127 113h3M142 113h1M142 114h2M143 115h2M144 116h3M146 117h1M146 118h2M113 208h3M111 209h3M106 210h1M110 210h3M136 210h1M62 211h2M109 211h2M137 211h1M18 212h1M63 212h2M85 212h1M107 212h4M137 212h5M18 213h2M64 213h2M86 213h1M107 213h3M139 213h3M18 214h2M44 214h1M65 214h1M86 214h2M107 214h2M137 214h1M18 215h3M43 215h2M87 215h1M108 215h2M18 216h1M20 216h4M44 216h1M109 216h1M18 217h1M20 217h3M42 217h1M18 218h1M21 218h1M21 219h1"></path><path stroke="#a1855a" d="M23 75h1M131 75h2M137 75h1M17 76h8M130 76h9M81 79h35M67 80h52M59 81h64M50 82h75M43 83h83M39 84h89M35 85h94M32 86h98M29 87h102M28 88h104M26 89h85M24 90h78M47 91h50M55 92h34M63 93h20M94 114h24M82 115h49M78 116h52M72 117h58M66 118h64M60 119h69M57 120h72M26 121h103M26 122h102M27 123h101M28 124h100M28 125h100M29 126h99M30 127h98M30 128h98M31 129h97M31 130h97M32 131h96M32 132h96M33 133h95M33 134h95M33 135h96M33 136h96M33 137h96M33 138h97M33 139h97M33 140h98M33 141h98M32 142h99M32 143h100M31 144h101M30 145h34M98 145h35M30 146h26M105 146h29M29 147h17M108 147h17M8 213h1"></path><path stroke="#805233" d="M5 83h1M4 84h2M5 85h2M5 86h2M5 87h2M5 88h2M5 89h2M5 90h2M5 91h2M5 92h2M5 93h2M5 94h2M5 95h2M5 96h2M5 97h2M5 98h2M5 99h2M5 100h2M5 101h2M5 102h2M5 103h2M5 104h2M139 109h1M138 110h2M139 111h2M139 112h2M139 113h2M139 114h2M139 115h2M139 116h2M139 117h2M139 118h2M139 119h2M139 120h2M139 121h2M139 122h2M139 123h2M139 124h2M139 125h2M139 126h2M139 127h2M139 128h2M139 129h2M139 130h2M63 213h1M138 213h1M63 214h2M138 214h3M86 215h1M107 215h1M19 216h1M43 216h1M107 216h2M19 217h1M43 217h1M108 217h2M19 218h2M19 219h2"></path><path stroke="#c79d5f" d="M111 89h21M102 90h31M23 91h24M97 91h36M22 92h33M89 92h45M21 93h42M83 93h51M20 94h115M20 95h115M19 96h116M19 97h106M128 97h7M18 98h108M131 98h5M18 99h110M133 99h3M18 100h111M134 100h2M18 101h114M135 101h1M18 102h107M132 102h1M18 103h106M18 104h109M19 105h113M19 106h114M19 107h115M19 108h113M19 109h111M20 110h109M20 111h108M20 112h107M131 112h1M21 113h105M130 113h2M22 114h72M118 114h8M127 114h5M23 115h59M23 116h55M23 117h49M24 118h42M25 119h35M25 120h32"></path><path stroke="#6e6860" d="M0 145h7M64 145h34M144 145h6M0 146h14M56 146h49M134 146h16M0 147h16M46 147h62M125 147h25M0 148h150M0 149h150M0 150h150M0 151h150M0 152h150M0 153h150M0 154h150M0 155h150M0 156h150M0 157h150M0 158h150M0 159h150M0 160h150M0 161h150M0 162h150M0 163h150M0 164h150M0 165h150M0 166h150M0 167h150M0 168h150M21 169h9M53 169h8M84 169h9M113 169h8M142 169h8M21 170h9M53 170h8M84 170h9M113 170h8M142 170h8M0 171h150M0 172h150M0 173h150M0 174h150M0 175h150M0 176h150M0 177h150M0 178h150M0 179h150M0 180h150M0 181h150M0 182h150M0 183h150M0 184h150M0 185h150M0 186h150M0 187h150M0 188h150M0 189h150M0 190h150M0 191h150M0 192h150M0 193h150M0 194h150M0 195h150M0 196h150M0 197h150M0 198h150M0 199h150M0 200h150M0 201h150M0 202h13M41 202h70M143 202h7M0 203h4M63 203h33M149 203h1"></path><path stroke="#c2c2c2" d="M0 169h21M30 169h23M61 169h23M93 169h20M121 169h21M0 170h21M30 170h23M61 170h23M93 170h20M121 170h21"></path><path stroke="#918e8b" d="M96 208h5M84 209h4M95 209h2M101 209h1M1 210h5M49 210h4M54 210h4M72 210h8M81 210h3M87 210h2M94 210h2M102 210h1M122 210h3M145 210h4M0 211h1M5 211h3M31 211h4M37 211h5M49 211h1M52 211h2M57 211h1M70 211h3M79 211h3M88 211h7M102 211h3M115 211h7M124 211h5M130 211h4M143 211h3M149 211h1M7 212h1M11 212h4M23 212h6M30 212h2M34 212h4M41 212h2M48 212h2M53 212h1M56 212h2M66 212h5M79 212h2M89 212h1M94 212h2M102 212h1M104 212h1M114 212h2M120 212h2M125 212h1M128 212h3M134 212h2M143 212h1M149 212h1M7 213h1M14 213h3M22 213h2M28 213h3M34 213h2M42 213h1M48 213h1M52 213h5M70 213h1M79 213h2M88 213h2M96 213h1M101 213h2M104 213h1M112 213h2M121 213h2M124 213h2M129 213h1M135 213h2M142 213h2M148 213h1M7 214h2M15 214h1M30 214h1M34 214h1M46 214h3M52 214h1M56 214h3M70 214h1M79 214h4M88 214h1M96 214h5M104 214h1M112 214h1M122 214h4M128 214h2M136 214h1M143 214h3M7 215h1M15 215h1M30 215h2M34 215h1M47 215h6M58 215h6M71 215h11M83 215h3M88 215h1M96 215h1M99 215h6M112 215h1M121 215h2M125 215h5M136 215h1M138 215h1M145 215h2M7 216h1M14 216h2M30 216h5M48 216h1M51 216h2M59 216h2M64 216h1M70 216h2M76 216h2M81 216h1M88 216h2M95 216h2M100 216h1M103 216h1M105 216h2M112 216h2M119 216h4M126 216h1M129 216h10M145 216h5M0 217h1M7 217h8M29 217h3M33 217h6M41 217h1M44 217h1M46 217h3M51 217h2M59 217h1M64 217h2M69 217h2M77 217h5M89 217h7M97 217h4M103 217h3M113 217h7M122 217h5M130 217h2M138 217h8M149 217h1M0 218h8M12 218h3M17 218h1M28 218h2M31 218h3M38 218h4M44 218h2M47 218h2M52 218h3M58 218h2M64 218h6M80 218h2M99 218h1M110 218h3M130 218h1M145 218h1M0 219h2M8 219h2M14 219h4M24 219h4M34 219h3M47 219h1M54 219h5M60 219h5M81 219h1M99 219h1M112 219h2M129 219h1M146 219h1M0 220h1M9 220h2M22 220h3M36 220h1M47 220h1M65 220h2M81 220h1M98 220h2M113 220h3M129 220h1M146 220h1M1 221h1M10 221h2M21 221h1M37 221h1M46 221h2M66 221h1M82 221h1M98 221h1M115 221h1M129 221h1M146 221h1M149 221h1M11 222h2M20 222h2M37 222h1M45 222h4M66 222h1M82 222h1M98 222h1M115 222h2M129 222h1M146 222h1"></path><path stroke="#bdbab6" d="M97 209h3M86 210h1M99 210h2M1 211h4M50 211h2M73 211h6M87 211h1M123 211h1M146 211h3M6 212h1M38 212h2M72 212h2M116 212h4M127 212h1M131 212h2M145 212h2M6 213h1M11 213h2M25 213h3M36 213h3M67 213h3M114 213h1M127 213h2M142 214h1M46 215h1M61 216h3M84 216h4M87 217h2M106 217h2M121 217h1M135 217h3M30 218h1M43 218h1M46 218h1M88 218h5M104 218h5M121 218h4M139 218h3M5 219h3M28 219h5M44 219h3M59 219h1M55 220h4"></path><path stroke="#a6a09c" d="M100 209h1M96 210h3M101 210h1M54 211h3M82 211h2M95 211h7M122 211h1M0 212h6M32 212h2M40 212h1M50 212h3M54 212h2M71 212h1M74 212h5M81 212h3M87 212h2M90 212h4M96 212h6M103 212h1M105 212h1M122 212h3M126 212h1M133 212h1M144 212h1M147 212h2M0 213h6M13 213h1M24 213h1M31 213h3M39 213h3M49 213h3M66 213h1M71 213h8M84 213h1M90 213h6M97 213h2M103 213h1M105 213h2M115 213h6M123 213h1M126 213h1M130 213h5M144 213h4M149 213h1M0 214h7M9 214h6M16 214h1M22 214h8M31 214h3M35 214h8M49 214h3M53 214h3M66 214h4M71 214h8M89 214h7M101 214h3M105 214h2M111 214h1M113 214h9M126 214h2M130 214h5M141 214h1M148 214h2M0 215h7M8 215h7M16 215h1M26 215h4M32 215h2M35 215h8M53 215h5M64 215h7M82 215h1M89 215h5M97 215h2M105 215h2M110 215h2M113 215h5M123 215h2M130 215h1M137 215h1M139 215h6M149 215h1M0 216h6M13 216h1M16 216h2M26 216h4M35 216h1M40 216h2M46 216h2M49 216h2M53 216h6M65 216h4M72 216h4M78 216h3M82 216h2M90 216h2M97 216h3M101 216h2M104 216h1M110 216h2M114 216h1M123 216h3M127 216h2M139 216h3M144 216h1M1 217h1M15 217h3M25 217h3M32 217h1M45 217h1M49 217h2M56 217h3M60 217h4M71 217h6M82 217h5M96 217h1M101 217h2M110 217h3M120 217h1M127 217h3M132 217h3M146 217h3M8 218h4M15 218h2M24 218h1M34 218h4M42 218h1M49 218h3M57 218h1M60 218h3M70 218h10M82 218h6M93 218h6M100 218h4M109 218h1M113 218h8M125 218h5M131 218h8M142 218h3M146 218h4M2 219h3M10 219h4M18 219h1M33 219h1M37 219h7M49 219h5M65 219h16M83 219h14M100 219h12M114 219h15M130 219h16M147 219h3M1 220h8M11 220h11M25 220h11M37 220h10M49 220h6M59 220h6M67 220h14M83 220h14M100 220h13M117 220h12M131 220h15M147 220h3M2 221h8M12 221h9M22 221h14M38 221h8M50 221h16M68 221h14M83 221h14M99 221h15M118 221h11M131 221h14M147 221h2M13 222h7M22 222h1M38 222h7M56 222h10M83 222h2M99 222h8M128 222h1"></path><path stroke="#756b64" d="M9 213h2"></path><path stroke="#858482" d="M81 213h3M99 213h2M83 214h2M135 214h1M146 214h2M94 215h2M118 215h3M131 215h5M147 215h2M6 216h1M8 216h5M36 216h4M69 216h1M92 216h3M115 216h4M142 216h2M2 217h5M28 217h1M39 217h2M53 217h3M66 217h3M25 218h3M55 218h2M63 218h1M48 219h1M82 219h1M97 219h2M48 220h1M82 220h1M97 220h1M116 220h1M130 220h1M0 221h1M36 221h1M48 221h2M67 221h1M97 221h1M114 221h1M116 221h2M130 221h1M145 221h1M0 222h11M23 222h14M49 222h7M67 222h15M85 222h13M107 222h8M117 222h11M130 222h16M147 222h3"></path><path stroke="#615c58" d="M23 219h1"></path><text class="eventInfo svelte-1fikqxh" y="8" x="67%"> </text><!><text class="eventInfo svelte-1fikqxh" y="39" x="67%"> </text><text class="eventInfo svelte-1fikqxh" y="52" x="67%"> </text><svg y="-62" x="75%" width="8px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path d="M224 256c70.7 0 128-57.31 128-128S294.7 0 224 0C153.3 0 96 57.31 96 128S153.3 256 224 256zM274.7 304H173.3c-95.73 0-173.3 77.6-173.3 173.3C0 496.5 15.52 512 34.66 512H413.3C432.5 512 448 496.5 448 477.3C448 381.6 370.4 304 274.7 304zM479.1 320h-73.85C451.2 357.7 480 414.1 480 477.3C480 490.1 476.2 501.9 470 512h138C625.7 512 640 497.6 640 479.1C640 391.6 568.4 320 479.1 320zM432 256C493.9 256 544 205.9 544 144S493.9 32 432 32c-25.11 0-48.04 8.555-66.72 22.51C376.8 76.63 384 101.4 384 128c0 35.52-11.93 68.14-31.59 94.71C372.7 243.2 400.8 256 432 256z"></path></svg><text class="eventInfo svelte-1fikqxh" y="64" x="67%"> </text><text y="78" x="52%"> </text><image height="68" y="0.5" x="10%"></image></svg>`
    );
function zn(e, t) {
    M(t, !0);
    var r = Rn(),
        i = h(o(r), 20),
        a = o(i, !0);
    I(i);
    var s = h(i),
        c = (e) => {
            var n = Pn(),
                r = h(g(n)),
                i = o(r);
            (I(r),
                m(
                    (e, t) => l(i, `${e ?? ``}:${t ?? ``}`),
                    [
                        () =>
                            (new Date(t.theater.startTime).getHours() < 10 ? `0` : ``) +
                            new Date(t.theater.startTime).getHours(),
                        () =>
                            (new Date(t.theater.startTime).getMinutes() < 10 ? `0` : ``) +
                            new Date(t.theater.startTime).getMinutes(),
                    ]
                ),
                A(e, n));
        },
        u = ae(() => t.currentTime.getTime() < new Date(t.theater.startTime).getTime()),
        f = (e) => {
            var t = Fn();
            A(e, t);
        },
        p = ae(
            () =>
                t.currentTime.getTime() > new Date(t.theater.startTime).getTime() &&
                t.currentTime.getTime() < new Date(t.theater.timeToClose).getTime() - 9e5
        ),
        _ = (e) => {
            var t = In();
            A(e, t);
        },
        v = ae(
            () =>
                t.currentTime.getTime() > new Date(t.theater.timeToClose).getTime() - 9e5 &&
                t.currentTime.getTime() < new Date(t.theater.timeToClose).getTime()
        ),
        y = (e) => {
            var t = Ln();
            A(e, t);
        };
    n(s, (e) => {
        d(u) ? e(c) : d(p) ? e(f, 1) : d(v) ? e(_, 2) : e(y, -1);
    });
    var b = h(s),
        S = o(b);
    I(b);
    var C = h(b),
        w = o(C);
    I(C);
    var T = h(C, 2),
        D = o(T, !0);
    I(T);
    var O = h(T);
    E(O, 0, `movieTitle ${`neoncolor` + Math.floor(Math.random() * 5)}`, `svelte-1fikqxh`);
    var k = o(O, !0);
    I(O);
    var j = h(O);
    (I(r),
        m(() => {
            (l(a, t.theater.eventName),
                l(S, `Runtime: ${t.theater.movieRuntime ?? ``} min`),
                l(
                    w,
                    `${t.theater.usersInsideTheater.length ?? ``}/${t.theater.amountOfSpaces ?? ``}`
                ),
                l(D, t.theater.passwordBool ? `Private Event` : `Public Event`),
                l(k, t.theater.movieNameCutToFit || t.theater.movieName),
                F(j, `href`, t.theater.hrefPoster));
        }),
        A(e, r),
        x());
}
var Bn = k(`<!> <div class="container blackedout svelte-1ueb838"></div>`, 1),
    Vn = k(`<div class="remoteCar svelte-1ueb838"><!></div>`),
    Hn = k(`<div class="lotSlot svelte-1ueb838"><!></div>`),
    Un = k(
        `<!> <div class="container svelte-1ueb838"><div class="containerInteractiveSpace svelte-1ueb838"><!> <div class="waterExtension svelte-1ueb838" aria-hidden="true"></div> <div class="container2 svelte-1ueb838"><div class="world svelte-1ueb838"><!> <!> <!> <!></div> <div class="playerLayer svelte-1ueb838"><div class="playerCar svelte-1ueb838"><!></div></div></div></div> <div class="containerListView svelte-1ueb838"><label id="colorInputLabel" for="colorInput" class="svelte-1ueb838">Change Color</label> <input name="colorInput" id="colorInput" type="color" class="svelte-1ueb838"/> <button class="menuButton svelte-1ueb838" id="logoutButton"><!></button> <!> <!> <!> <!> <button class="menuButton svelte-1ueb838" id="addTheaterButton">Create Event</button> <button class="menuButton svelte-1ueb838" id="addSomethingElseButton">About</button></div></div>`,
        1
    ),
    Wn = k(
        `<div class="loadingScreen svelte-1ueb838" role="status" aria-label="Loading"><div class="loadingBars svelte-1ueb838"><!></div></div>`
    );
function Gn(s, c) {
    M(c, !0);
    let l = () => re(Z, `$user`, v),
        u = () => re($, `$playerMovement`, v),
        [v, y] = te(),
        S = Kt();
    function E({ id: t, coords: n, direction: r, screen: i }) {
        if (!l().insideTheater) {
            let a = d(z).findIndex((e) => e.id === t);
            a !== -1 &&
                ((d(z)[a] = { ...d(z)[a], coords: { x: n.x + i, y: n.y, direction: r } }),
                e(z, d(z), !0));
        }
    }
    function k({ id: t, coords: n, color: r, name: i, screen: a }) {
        l().insideTheater ||
            (d(z).findIndex((e) => e.id === t) === -1 &&
                (d(z).push({
                    id: t,
                    color: r,
                    name: i,
                    coords: {
                        x: Number.isFinite(n?.x + a) ? n.x + a : 60,
                        y: Number.isFinite(n?.y) ? n.y : 600,
                    },
                }),
                ce(),
                e(z, d(z), !0)));
    }
    function N({ id: t }) {
        if (!l().insideTheater) {
            let n = d(z).findIndex((e) => e.id === t);
            n !== -1 && (d(z).splice(n, 1), e(z, d(z), !0));
        }
    }
    function P({ id: t, color: n }) {
        if (!l().insideTheater) {
            let r = d(z).findIndex((e) => e.id === t);
            r !== -1 && ((d(z)[r].color = n), e(z, d(z), !0));
        }
    }
    function F({ id: t, name: n, color: r }) {
        if (!l().insideTheater) {
            let i = d(z).findIndex((e) => e.id === t);
            i !== -1 && ((d(z)[i].name = n), (d(z)[i].color = r), e(z, d(z), !0));
        }
    }
    function ie() {
        l().insideTheater || De();
    }
    function oe({ id: e }) {
        l().insideTheater || (N({ id: e }), De());
    }
    function se() {
        ce();
    }
    function ce() {
        S.emit(`carJoined`, { color: l().playerColor, coords: H, name: d(he), screen: d(W) });
    }
    function R(e = !1) {
        let t = Date.now();
        (!e && t - fe < de) ||
            ((fe = t), S.emit(`carPosition`, { coords: H, direction: d(me), screen: d(W) }));
    }
    let z = C(_([])),
        B = C(_([])),
        V = { w: !1, s: !1, a: !1, d: !1 },
        ue = !1,
        H = _({ x: 60, y: 600 }),
        de = 1e3 / 15,
        fe = 0,
        pe = C(!1),
        U = C(null),
        me = C(!1),
        he = ae(() => l().username || ``),
        W = C(0),
        G = C(1e3),
        ge = C(!1),
        _e = C(!1),
        ve = C(0),
        ye = C(!1),
        be = ae(() => Math.max(3, Math.ceil(d(G) / 400), d(ve))),
        xe = C(_(new Date()));
    ne(() => {
        let t = [
            [`newCarPosition`, E],
            [`newCarJoined`, k],
            [`carLeft`, N],
            [`newColorChanged`, P],
            [`newCarUpdate`, F],
            [`newTheaterAdded`, ie],
            [`newJoinedTheater`, oe],
            [`connect`, se],
        ];
        (t.forEach(([e, t]) => S.on(e, t)), S.connected && se());
        let n = !0;
        async function r() {
            if (
                (await De(),
                !(!n || !l().loggedIn) &&
                    (b($, !0),
                    O(Z, (p(l).insideTheater = !1), p(l)),
                    le.url.searchParams.has(`position`)))
            ) {
                let e = Number(le.url.searchParams.get(`position`));
                Ee(e >= d(be) ? d(be) - 1 : e);
            }
        }
        r().catch((e) => console.error(`Failed to initialize theaters`, e));
        let i = performance.now(),
            a;
        function o(t) {
            let n = Math.min((t - i) / 1e3, 0.05);
            if (((i = t), ue && u())) {
                let t = 250 * n;
                if (
                    (V.w && H.y > 410 && (H.y = Math.max(410, H.y - t)),
                    V.s && H.y < 725 && (H.y = Math.min(725, H.y + t)),
                    V.a &&
                        H.x > 0 &&
                        ((H.x = Math.max(0, H.x - t)), e(me, !0), H.x < 150 && d(W) > 0))
                ) {
                    let n = Math.min(t, d(W));
                    (e(W, d(W) - n), (H.x += n));
                }
                if (V.d && H.x < d(G) - 50) {
                    ((H.x = Math.min(d(G) - 50, H.x + t)), e(me, !1));
                    let n = Math.max(0, d(be) * 400 - d(G));
                    if (H.x > d(G) - 200 && d(W) < n) {
                        let r = Math.min(t, n - d(W));
                        (e(W, d(W) + r), (H.x -= r));
                    }
                }
                (R(), Te());
            }
            a = requestAnimationFrame(o);
        }
        a = requestAnimationFrame(o);
        let s = setInterval(() => {
            e(xe, new Date(), !0);
        }, 6e4);
        return () => {
            ((n = !1),
                cancelAnimationFrame(a),
                clearInterval(s),
                t.forEach(([e, t]) => S.off(e, t)),
                (V = { w: !1, s: !1, a: !1, d: !1 }),
                (ue = !1));
        };
    });
    function Se(e) {
        (O(Z, (p(l).playerColor = e.target.value), p(l)),
            S.emit(`colorChanged`, { color: l().playerColor }));
    }
    function Ce(e) {
        if (!u() || typeof e.key != `string`) return;
        let t = e.key.toLowerCase();
        t in V && ((V[t] = !0), (ue = !0));
    }
    function we(e) {
        if (typeof e.key != `string`) return;
        let t = e.key.toLowerCase();
        t in V && ((V[t] = !1), Object.values(V).every((e) => e === !1) && (ue = !1));
    }
    function Te() {
        let t = H.x + d(W),
            n =
                H.y < 550 && H.y > 400
                    ? d(B).find((e) => e.position * 400 + 325 > t && e.position * 400 + 75 < t + 50)
                    : null;
        n?._id !== d(U)?._id && (e(U, n || null, !0), e(pe, !!n, !0));
    }
    function Ee(t) {
        H.y = 470;
        let n = t * 400 + 185,
            r = Math.max(0, d(be) * 400 - d(G));
        (e(W, Math.min(Math.max(0, n - (d(G) - 215)), r), !0), (H.x = n - d(W)), R(!0), Te());
    }
    async function De() {
        let { data: t } = await (await X(`/theaters`)).json();
        (e(B, t, !0),
            e(
                ve,
                d(B).length ? [...d(B)].sort((e, t) => t.position - e.position)[0].position + 1 : 0,
                !0
            ),
            e(ye, !0));
        let n = Math.max(0, d(be) * 400 - d(G));
        d(W) > n && (e(W, n, !0), R(!0));
    }
    async function Oe() {
        (await X(`/logout`)).status === 200 && (localStorage.clear(), window.location.reload());
    }
    function K() {
        e(ge, !0);
    }
    function ke() {
        e(_e, !0);
    }
    var Ae = t();
    (a(`keydown`, L, Ce), a(`keyup`, L, we));
    var q = g(Ae),
        je = (a) => {
            var s = Un(),
                c = g(s),
                u = (e) => {
                    var t = Bn();
                    (an(g(t), {
                        get socket() {
                            return S;
                        },
                    }),
                        T(2),
                        A(e, t));
                };
            n(c, (e) => {
                l().loggedIn === !1 && e(u);
            });
            var p = h(c, 2),
                _ = o(p),
                v = o(_);
            Tn(v, {});
            var y = h(v, 4),
                b = o(y),
                x = o(b);
            f(
                x,
                17,
                () => d(z),
                (e) => e.id,
                (e, t) => {
                    var n = Vn();
                    (Nn(o(n), {
                        get name() {
                            return d(t).name;
                        },
                        get color() {
                            return d(t).color;
                        },
                        get facingLeft() {
                            return d(t).coords.direction;
                        },
                    }),
                        I(n),
                        m(() =>
                            D(
                                n,
                                `transform: translate3d(${d(t).coords.x ?? ``}px, ${d(t).coords.y ?? ``}px, 0);`
                            )
                        ),
                        A(e, n));
                }
            );
            var C = h(x, 2);
            f(
                C,
                17,
                () => d(B),
                (e) => e._id,
                (e, t) => {
                    var n = Hn();
                    (zn(o(n), {
                        get theater() {
                            return d(t);
                        },
                        get currentTime() {
                            return d(xe);
                        },
                    }),
                        I(n),
                        m(() => D(n, `left: ${d(t).position * 400}px;`)),
                        A(e, n));
                }
            );
            var E = h(C, 2);
            (f(
                E,
                17,
                () => Array(d(be)),
                r,
                (e, r, i) => {
                    var a = t(),
                        s = g(a),
                        c = (e) => {
                            var t = Hn();
                            (D(t, `left: ${i * 400}px;`), jn(o(t), {}), I(t), A(e, t));
                        },
                        l = ae(() => !d(B).some((e) => e.position === i));
                    (n(s, (e) => {
                        d(l) && e(c);
                    }),
                        A(e, a));
                }
            ),
                Dn(h(E, 2), {}),
                I(b));
            var O = h(b, 2),
                k = o(O);
            (Nn(o(k), {
                get name() {
                    return d(he);
                },
                get color() {
                    return l().playerColor;
                },
                get facingLeft() {
                    return d(me);
                },
            }),
                I(k),
                I(O),
                I(y),
                I(_));
            var M = h(_, 2),
                N = h(o(M), 2);
            w(N);
            var te = h(N, 2);
            (kn(o(te), {}), I(te));
            var P = h(te, 2);
            un(P, {
                get theaters() {
                    return d(B);
                },
                teleportToTheater: Ee,
            });
            var F = h(P, 2),
                L = (e) => {
                    Zt(e, {
                        get theater() {
                            return d(U);
                        },
                    });
                };
            n(F, (e) => {
                d(pe) === !0 && e(L);
            });
            var ne = h(F, 2),
                re = (t) => {
                    xn(t, {
                        get createEventBool() {
                            return d(ge);
                        },
                        set createEventBool(t) {
                            e(ge, t, !0);
                        },
                    });
                };
            n(ne, (e) => {
                d(ge) === !0 && e(re);
            });
            var ie = h(ne, 2),
                oe = (t) => {
                    Cn(t, {
                        get aboutPageBool() {
                            return d(_e);
                        },
                        set aboutPageBool(t) {
                            e(_e, t, !0);
                        },
                    });
                };
            n(ie, (e) => {
                d(_e) === !0 && e(oe);
            });
            var se = h(ie, 2),
                ce = h(se, 2);
            (I(M),
                I(p),
                m(() => {
                    (D(b, `width: ${d(be) * 400}px; transform: translate3d(${-d(W)}px, 0, 0);`),
                        D(k, `transform: translate3d(${H.x ?? ``}px, ${H.y ?? ``}px, 0);`),
                        ee(N, l().playerColor));
                }),
                j(y, `clientWidth`, (t) => e(G, t)),
                i(`change`, N, Se),
                i(`click`, te, Oe),
                i(`click`, se, K),
                i(`click`, ce, ke),
                A(a, s));
        },
        Me = (e) => {
            var t = Wn(),
                n = o(t);
            (hn(o(n), { size: `200`, color: `aqua`, unit: `px`, duration: `1s` }),
                I(n),
                I(t),
                A(e, t));
        };
    (n(q, (e) => {
        d(ye) ? e(je) : e(Me, -1);
    }),
        A(s, Ae),
        x(),
        y());
}
u([`change`, `click`]);
export { Z as a, Jt as i, hn as n, X as o, Q as r, Kt as s, Gn as t };

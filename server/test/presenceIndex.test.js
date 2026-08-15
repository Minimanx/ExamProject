import { describe, it, expect, beforeEach } from "vitest";
import {
    registerSocketServer,
    isOnline,
    whereIs,
    onlineUserIds,
    occupantsByTheater,
} from "../socketios/presence.js";

// Presence answers "is this user online" by walking every connected socket, and
// a friend list asked it once per friend — so loading one was O(friends x
// connections). At a full hub of 60 with 50 friends that is three thousand
// comparisons for a page nobody thinks of as expensive, and it gets worse
// exactly when the product starts working.
//
// The fix is not an index to keep in step with the socket lifecycle — that is a
// second source of truth and a new way to be wrong. It is to stop asking the
// same question once per friend: one pass produces the set, and the list reads
// from it.
function fakeIo(sockets) {
    return { sockets: { sockets: new Map(sockets.map((s) => [s.id, s])) } };
}

function fakeSocket(id, userID, data = {}) {
    return { id, request: { session: userID ? { userID } : {} }, data };
}

describe("presence", () => {
    beforeEach(() => {
        registerSocketServer(null);
    });

    it("says nobody is online when there is no socket server", () => {
        expect(isOnline("someone")).toBe(false);
        expect(onlineUserIds()).toEqual(new Set());
        expect(whereIs("someone")).toEqual({ online: false, position: null, theaterId: null });
    });

    it("finds a connected user", () => {
        registerSocketServer(fakeIo([fakeSocket("s1", "user-a")]));

        expect(isOnline("user-a")).toBe(true);
        expect(isOnline("user-b")).toBe(false);
    });

    it("reports where a user is", () => {
        registerSocketServer(
            fakeIo([fakeSocket("s1", "user-a", { worldPosition: { x: 40, y: 600 } })])
        );

        expect(whereIs("user-a")).toEqual({
            online: true,
            position: { x: 40, y: 600 },
            theaterId: null,
        });
    });

    it("ignores a socket with no session", () => {
        registerSocketServer(fakeIo([fakeSocket("s1", null)]));

        expect(isOnline("user-a")).toBe(false);
        expect(onlineUserIds()).toEqual(new Set());
    });

    // The whole set in one pass, which is what a friend list needs.
    it("names everyone online at once", () => {
        registerSocketServer(fakeIo([fakeSocket("s1", "user-a"), fakeSocket("s2", "user-b")]));

        expect(onlineUserIds()).toEqual(new Set(["user-a", "user-b"]));
    });

    // Someone with two tabs open is one person, listed once.
    it("counts a user with two connections once", () => {
        registerSocketServer(fakeIo([fakeSocket("s1", "user-a"), fakeSocket("s2", "user-a")]));

        expect(onlineUserIds()).toEqual(new Set(["user-a"]));
    });
});

// The theater listing needs "who is really inside" for every theater at once.
// Asking room by room is one adapter round-trip per theater, on a page that
// loads on every visit and again on every debounced search keystroke.
//
// A socket inside a theater carries both fields, set together when it joins —
// see chatSocket — so the fake sets them the same way.
function fakeOccupant(id, userID, theaterId) {
    return fakeSocket(id, userID, { userID, theaterId });
}

describe("occupantsByTheater", () => {
    beforeEach(() => {
        registerSocketServer(null);
    });

    // Null, not an empty map: "nobody is in any theater" and "there is nothing
    // to ask" must not look alike, or a listing during startup would sweep every
    // occupant out of every theater. Same contract as liveOccupants.
    it("cannot tell when there is no socket server", () => {
        expect(occupantsByTheater()).toBe(null);
    });

    it("groups everyone inside a theater by which one", () => {
        registerSocketServer(
            fakeIo([
                fakeOccupant("s1", "user-a", "t1"),
                fakeOccupant("s2", "user-b", "t1"),
                fakeOccupant("s3", "user-c", "t2"),
            ])
        );

        expect(occupantsByTheater()).toEqual(
            new Map([
                ["t1", new Set(["user-a", "user-b"])],
                ["t2", new Set(["user-c"])],
            ])
        );
    });

    it("leaves out anyone driving around outside", () => {
        registerSocketServer(
            fakeIo([fakeSocket("s1", "user-a"), fakeOccupant("s2", "user-b", "t1")])
        );

        expect(occupantsByTheater()).toEqual(new Map([["t1", new Set(["user-b"])]]));
    });

    it("ignores a socket that has a room but no user", () => {
        registerSocketServer(fakeIo([fakeSocket("s1", null, { theaterId: "t1" })]));

        expect(occupantsByTheater()).toEqual(new Map());
    });
});

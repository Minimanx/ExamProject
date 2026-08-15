import { Router } from "express";
import db from "../database/createConnection.js";
import { sendError } from "../errors.js";
import { requireSession } from "./requireSession.js";
import { validateBody } from "../validate.js";
import { friendRequestSchema, friendAnswerSchema } from "../schemas.js";
import { onlineUserIds, whereIs } from "../socketios/presence.js";
import * as friends from "../services/friendService.js";

const router = Router();

/** Load the friendship named in the path, or answer for its absence. */
async function loadFriendship(req, res) {
    const friendship = await friends.find(req.params.id);
    if (friendship === null) {
        sendError(res, "NOT_FOUND", "No such friend request");
        return null;
    }
    if (!friends.involves(friendship, req.session.userID.toString())) {
        // 403 rather than 404: they are asking about a real thing, they simply
        // have no part in it.
        sendError(res, "FORBIDDEN", "That is not yours to answer");
        return null;
    }
    return friendship;
}

router.post(
    "/friends",
    requireSession("Must be logged in to add a friend"),
    validateBody(friendRequestSchema),
    async (req, res) => {
        const target = await db.users.findOne(
            { username: req.body.username },
            { projection: { _id: 1 }, collation: friends.USERNAME_COLLATION }
        );
        if (target === null) {
            return sendError(res, "NOT_FOUND", "No such user");
        }

        try {
            await friends.request(req.session.userID.toString(), target._id.toString());
        } catch (error) {
            if (error instanceof friends.AlreadyExistsError) {
                return sendError(res, "CONFLICT", error.message);
            }
            throw error;
        }

        res.status(200).send({ message: "Friend request sent" });
    }
);

router.patch(
    "/friends/:id",
    requireSession("Must be logged in"),
    validateBody(friendAnswerSchema),
    async (req, res) => {
        const friendship = await loadFriendship(req, res);
        if (friendship === null) return;

        if (friendship.state !== "pending") {
            return sendError(res, "CONFLICT", "That request has already been answered");
        }
        // Otherwise anyone could befriend anyone by asking and then agreeing on
        // their own behalf.
        if (friends.addresseeOf(friendship) !== req.session.userID.toString()) {
            return sendError(res, "FORBIDDEN", "Only the person asked may answer");
        }

        if (req.body.accept) {
            await friends.accept(friendship);
            return res.status(200).send({ message: "Friend added" });
        }

        // A declined request is deleted rather than kept as a tombstone: keeping
        // it would silently block the pair from ever asking again.
        await friends.remove(friendship);
        res.status(200).send({ message: "Friend request declined" });
    }
);

router.delete("/friends/:id", requireSession("Must be logged in"), async (req, res) => {
    const friendship = await loadFriendship(req, res);
    if (friendship === null) return;

    await friends.remove(friendship);
    res.status(200).send({ message: "Friend removed" });
});

router.get("/friends/:id/whereabouts", requireSession("Must be logged in"), async (req, res) => {
    const friendship = await loadFriendship(req, res);
    if (friendship === null) return;

    // Only an accepted friendship. Asking to be someone's friend must not be
    // enough to learn where they are, or the request itself becomes a way to
    // find people.
    if (friendship.state !== "accepted") {
        return sendError(res, "FORBIDDEN", "You are not friends yet");
    }

    const me = req.session.userID.toString();
    const otherID = friendship.pairLow === me ? friendship.pairHigh : friendship.pairLow;
    res.status(200).send({ data: whereIs(otherID) });
});

router.get("/friends", requireSession("Must be logged in"), async (req, res) => {
    const buckets = await friends.listFor(req.session.userID.toString());

    // One pass over the sockets, not one per friend: asking individually made
    // loading this page cost friends x connections.
    //
    // Answered for accepted friends only — whether someone you have asked is
    // online is not yours to know until they say yes.
    const online = onlineUserIds();
    buckets.friends = buckets.friends.map((friend) => ({
        ...friend,
        online: online.has(friend.userID),
    }));

    res.status(200).send({ data: buckets });
});

export default router;

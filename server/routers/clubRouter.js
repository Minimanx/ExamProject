import { Router } from "express";
import { sendError } from "../errors.js";
import { validateBody } from "../validate.js";
import { createClubSchema, clubRoleSchema } from "../schemas.js";
import * as clubs from "../services/clubService.js";

const router = Router();

const requireSession = (message) => (req, res, next) => {
    if (!req.session.loggedIn) {
        sendError(res, "UNAUTHENTICATED", message);
        return;
    }
    next();
};

/** Load the club named in the path along with the caller's standing in it. */
function loadClub({ atLeast } = {}) {
    return async (req, res, next) => {
        const club = await clubs.findById(req.params.id);
        if (club === null) {
            sendError(res, "NOT_FOUND", "No such club");
            return;
        }

        req.club = club;
        req.membership = await clubs.membershipOf(
            club._id.toString(),
            req.session.userID.toString()
        );

        if (atLeast && !clubs.outranksOrEquals(req.membership?.role, atLeast)) {
            sendError(res, "FORBIDDEN", "You are not allowed to do that");
            return;
        }
        next();
    };
}

router.post(
    "/clubs",
    requireSession("Must be logged in to start a club"),
    validateBody(createClubSchema),
    async (req, res) => {
        const created = await clubs.create({
            ...req.body,
            ownerID: req.session.userID.toString(),
        });

        res.status(200).send({ message: "Club created", data: created });
    }
);

router.get("/clubs", async (req, res) => {
    res.status(200).send({ data: await clubs.listPublic() });
});

router.get("/clubs/:slug", async (req, res) => {
    const club = await clubs.findBySlug(req.params.slug);
    if (club === null) {
        return sendError(res, "NOT_FOUND", "No such club");
    }

    if (!club.isPublic) {
        const membership = req.session.loggedIn
            ? await clubs.membershipOf(club._id.toString(), req.session.userID.toString())
            : null;

        // 404 rather than 403: answering "forbidden" confirms the club exists,
        // which is exactly what somebody guessing slugs wants to learn.
        if (membership === null) {
            return sendError(res, "NOT_FOUND", "No such club");
        }
    }

    res.status(200).send({ data: await clubs.present(club) });
});

router.post(
    "/clubs/:id/members",
    requireSession("Must be logged in to join a club"),
    loadClub(),
    async (req, res) => {
        if (!req.club.isPublic && req.membership === null) {
            return sendError(res, "FORBIDDEN", "That club is invitation only");
        }

        try {
            await clubs.join(req.club._id.toString(), req.session.userID.toString());
        } catch (error) {
            if (error instanceof clubs.ConflictError) {
                return sendError(res, "CONFLICT", error.message);
            }
            throw error;
        }

        res.status(200).send({ message: "Joined the club" });
    }
);

router.delete(
    "/clubs/:id/members/:userID",
    requireSession("Must be logged in"),
    loadClub(),
    async (req, res) => {
        const me = req.session.userID.toString();
        const target = req.params.userID;

        // Leaving is always yours to do; removing somebody else is a moderator's
        // job.
        if (target !== me && !clubs.outranksOrEquals(req.membership?.role, "moderator")) {
            return sendError(res, "FORBIDDEN", "You are not allowed to do that");
        }

        const clubID = req.club._id.toString();
        const theirs = await clubs.membershipOf(clubID, target);
        if (theirs === null) {
            return sendError(res, "NOT_FOUND", "They are not in that club");
        }

        // A club with no owner has nobody who can delete it or promote anyone,
        // so it would sit there forever with no way to act on it.
        if (theirs.role === "owner" && (await clubs.ownerCount(clubID)) === 1) {
            return sendError(res, "CONFLICT", "A club must keep an owner");
        }

        await clubs.leave(clubID, target);
        res.status(200).send({ message: "Left the club" });
    }
);

router.patch(
    "/clubs/:id/members/:userID",
    requireSession("Must be logged in"),
    // Owner only: a moderator who could change roles could promote themselves
    // and take the club.
    loadClub({ atLeast: "owner" }),
    validateBody(clubRoleSchema),
    async (req, res) => {
        const clubID = req.club._id.toString();
        if ((await clubs.membershipOf(clubID, req.params.userID)) === null) {
            return sendError(res, "NOT_FOUND", "They are not in that club");
        }

        await clubs.setRole(clubID, req.params.userID, req.body.role);
        res.status(200).send({ message: "Role changed" });
    }
);

router.delete(
    "/clubs/:id",
    requireSession("Must be logged in"),
    loadClub({ atLeast: "owner" }),
    async (req, res) => {
        await clubs.remove(req.club);
        res.status(200).send({ message: "Club deleted" });
    }
);

export default router;

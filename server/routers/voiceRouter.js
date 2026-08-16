import { Router } from "express";
import { requireSession } from "./requireSession.js";
import { iceServers } from "../world/ice.js";
import { limits } from "../limits.js";

const router = Router();

/**
 * What a client needs before it can open a peer connection.
 *
 * Behind a session because TURN credentials are credentials — a relay carries
 * media for whoever presents them. Building them into the client bundle would
 * publish them to every visitor, including the ones who never join a call.
 *
 * The capacity comes back with them so the UI can say "this call is full (5)"
 * without the number being written down in two places and drifting.
 */
router.get("/ice", requireSession("Must be logged in"), (req, res) => {
    res.status(200).send({
        data: { iceServers: iceServers(), capacity: limits.voiceCapacity },
    });
});

export default router;

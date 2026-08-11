/**
 * Request schemas, applied at the edge.
 *
 * Three of the defects in this codebase were the same defect: a handler read a
 * field without first establishing what it was. `username: {"$ne": null}` was
 * sanitized to `{}`, sailed past a falsiness check and got stored (N2). An
 * absent reset token serialized to BSON null and matched every document where
 * the field was null or missing (S10). A length rule compared a string to a
 * number and never fired (C1). Scrubbing inputs is a weaker control than typing
 * them.
 *
 * A schema also strips keys it does not declare, which is what stops a client
 * inventing fields that get persisted — the other half of C3.
 *
 * Every message here is written out rather than left to zod, because the UI
 * shows them verbatim and zod's defaults are written for developers. Where
 * several rules on one field can fail at once, the order they are declared in
 * is the order they are reported in.
 */

import { z } from "zod";
import { limits } from "./limits.js";

const ALL_FIELDS = "All fields must be filled";

/** A field that must be present and non-empty, whatever else is true of it. */
const required = (message = ALL_FIELDS) => z.string({ error: message }).min(1, message);

/**
 * An object whose own type error reads like its field errors do.
 *
 * A body that arrives as an array or a string fails at the object node, not at
 * any field, and zod's default for that — "Invalid input: expected object,
 * received array" — would go straight into a toast.
 */
const body = (shape, message = ALL_FIELDS) => z.object(shape, { error: message });

const email = required().regex(/\S+@\S+\.\S+/, "Email must be valid");

const PASSWORD_LENGTH = "Password must be between 8 and 24 characters";
const password = required().min(8, PASSWORD_LENGTH).max(24, PASSWORD_LENGTH);

const USERNAME_LENGTH = "Username must be between 3 and 16 characters";
const EVENT_NAME_LENGTH = "Event name must be between 3 and 18 characters";
// Built from the limit rather than written out: raising the cap and leaving the
// message behind would produce an error that lies about the rule.
const SPACES_RANGE = `Amount of spaces must be between 1 and ${limits.maxSeats}`;

const passwordsMatch = {
    error: "Passwords must match",
    path: ["passwordRepeat"],
};

export const signupSchema = body({
    email,
    username: required().min(3, USERNAME_LENGTH).max(16, USERNAME_LENGTH),
    password,
    passwordRepeat: required(),
    // Only meaningful while INVITE_ONLY is set. Declared here regardless,
    // because the schema strips what it does not declare and the route would
    // never see it. Its absence is answered by the route, not by the schema:
    // "Registration is invite only" reads better than a missing-field error.
    inviteCode: z.string({ error: ALL_FIELDS }).optional(),
}).refine((value) => value.password === value.passwordRepeat, passwordsMatch);

export const loginSchema = body({
    email: required(),
    password: required(),
});

export const forgotPasswordSchema = body({ email });

// The token is the load-bearing control on these two routes, not mongo-sanitize:
// null is not an operator, so no sanitizer can stop `{ passwordToken: null }`
// matching every document where the field is null or absent. See defect S10.
const CODE_REQUIRED = "Code must be filled";

export const checkResetTokenSchema = body(
    {
        email: required(CODE_REQUIRED),
        token: required(CODE_REQUIRED),
    },
    CODE_REQUIRED
);

export const resetPasswordSchema = body(
    {
        email: required(CODE_REQUIRED),
        token: required(CODE_REQUIRED),
        password: required().min(8, "Password is too short"),
        passwordRepeat: required(),
    },
    CODE_REQUIRED
).refine((value) => value.password === value.passwordRepeat, passwordsMatch);

// The query parser is pinned to "simple", so a repeated ?s= yields an array
// rather than a string. z.string() rejects it with the same message instead of
// the handler calling .trim() on an array. See defect S9.
const TITLE_REQUIRED = "A movie title is required";

export const movieSearchSchema = body(
    { s: z.string({ error: TITLE_REQUIRED }).trim().min(1, TITLE_REQUIRED) },
    TITLE_REQUIRED
);

/**
 * Optional search and filters on the public listing.
 *
 * A blank string means "no search" rather than "match nothing", because that is
 * what an emptied search box sends. `startingWithin` is minutes.
 */
export const theaterListingSchema = z.object({
    q: z.string().trim().max(80).optional(),
    hasSpace: z.enum(["true", "false"], { error: "hasSpace must be true or false" }).optional(),
    startingWithin: z
        .string()
        .regex(/^[1-9][0-9]*$/, "startingWithin must be a positive number of minutes")
        .optional(),
});

export const createTheaterSchema = body({
    data: body({
        eventName: required().min(3, EVENT_NAME_LENGTH).max(18, EVENT_NAME_LENGTH),
        // "Must choose a time" was unreachable in the original: the combined
        // presence check ran first and answered "All fields must be filled" for
        // a missing startTime, so the later branch could never fire.
        startTime: required(),
        amountOfSpaces: z
            .number({ error: ALL_FIELDS })
            .int(SPACES_RANGE)
            .min(1, SPACES_RANGE)
            .max(limits.maxSeats, SPACES_RANGE),
        imdbID: required("Must choose a movie"),
        // A private theater's key is generated server-side, so the host supplies
        // only the choice. `password` and `passwordBool` are gone: they made the
        // host invent a secret and pass it on out of band, and stored it
        // bcrypt-hashed so nobody could read it back to share it.
        private: z.boolean({ error: ALL_FIELDS }).default(false),
    }),
});

// `joining` carries the old "Unsupported theater update" message because this
// route answers that for any PATCH that is not a join. The other two get the
// ordinary validation message: a missing userID is a malformed request, not an
// authentication failure, and the route's own check produces the 401 when the
// id is present but belongs to someone else.
export const joinTheaterSchema = body({
    joining: z.literal(true, { error: "Unsupported theater update" }),
    userID: required(),
    lobbyKey: z.string({ error: ALL_FIELDS }).optional(),
    // Only for theaters created before lobby keys existed. Remove once none can
    // still be live — they expire within hours of their showing.
    password: z.string({ error: ALL_FIELDS }).optional(),
});

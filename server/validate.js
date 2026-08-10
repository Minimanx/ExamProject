/**
 * Apply a schema to a request before its handler runs.
 *
 * On success `req.body` is replaced by the parsed value, so a handler cannot
 * accidentally read a key the schema did not declare — that is what stops a
 * client inventing fields that reach the database. On failure the response
 * carries the first message, which is what the UI shows, and every issue under
 * `fields` for anything that wants the detail.
 */

import { sendError } from "./errors.js";

export function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const fields = result.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            }));
            sendError(res, "VALIDATION_FAILED", fields[0].message, { fields });
            return;
        }

        req.body = result.data;
        next();
    };
}

export function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);

        if (!result.success) {
            const fields = result.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            }));
            sendError(res, "VALIDATION_FAILED", fields[0].message, { fields });
            return;
        }

        // req.query is a getter returning a fresh object per access, so the
        // parsed value goes somewhere the handler can actually read it back.
        req.validatedQuery = result.data;
        next();
    };
}

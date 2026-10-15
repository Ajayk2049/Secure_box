import { FastifyRequest, FastifyReply } from "fastify";
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../errors/AppError.js";

/**
 * Validates request.body against a given Zod schema in a Fastify preHandler hook.
 */
export function validateBody(schema: ZodSchema<any>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body || {});
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") || "body";
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      }
      const firstMessage = result.error.issues[0]?.message || "Validation failed";
      return reply.status(400).send({
        error: firstMessage,
        fieldErrors,
      });
    }
    request.body = result.data;
  };
}

/**
 * Validates request.query against a given Zod schema in a Fastify preHandler hook.
 */
export function validateQuery(schema: ZodSchema<any>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.query || {});
    if (!result.success) {
      const firstMessage = result.error.issues[0]?.message || "Validation failed";
      return reply.status(400).send({
        error: firstMessage,
      });
    }
    request.query = result.data as any;
  };
}

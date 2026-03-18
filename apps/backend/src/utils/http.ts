import { FastifyReply } from "fastify";

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function fail(reply: FastifyReply, statusCode: number, message: string) {
  return reply.status(statusCode).send({
    ok: false,
    error: { message },
  });
}

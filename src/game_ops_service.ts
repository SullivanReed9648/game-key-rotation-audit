import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z, ZodError } from "zod";

const assetSchema = z.object({
  kind: z.literal("player_asset"),
  playerId: z.string().min(1),
  assetId: z.string().min(1),
  mediaType: z.enum(["emblem", "map", "skin"]),
  moderationState: z.enum(["pending", "approved", "rejected"])
});

const liveEventSchema = z.object({
  kind: z.literal("live_event"),
  eventId: z.string().min(1),
  title: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime()
}).refine((value) => value.endsAt > value.startsAt, {
  message: "endsAt must follow startsAt",
  path: ["endsAt"]
});

const moderationSchema = z.object({
  kind: z.literal("moderation_queue"),
  queueId: z.string().min(1),
  assetId: z.string().min(1),
  priority: z.enum(["normal", "urgent"])
});

const gameOperationSchema = z.union([
  assetSchema,
  liveEventSchema,
  moderationSchema
]);

const operations: z.infer<typeof gameOperationSchema>[] = [];

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/operations") {
    try {
      const operation = gameOperationSchema.parse(await readJson(request));
      operations.push(operation);
      send(response, 201, { accepted: true, operation });
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        send(response, 400, { accepted: false, reason: "Invalid operation body" });
        return;
      }
      send(response, 500, { accepted: false, reason: "Request could not be processed" });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/operations") {
    send(response, 200, { operations });
    return;
  }

  send(response, 404, { reason: "Route not found" });
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Game operations service listening on ${port}`));
}

import { type MessagePart } from "@/server/gmail/schemas";
import { parse } from "@/lib/try-catch/std";
import { z } from "zod";

const mimeTypeSchema = z.enum([
  // text
  "text/plain",
  "text/html",
  // multipart
  "multipart/alternative",
  "multipart/related",
  "multipart/mixed",
  // image
  "image/png",
  "image/jpeg",
  // application
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export type MimeType = z.infer<typeof mimeTypeSchema>;

export function getMimeType(part: MessagePart) {
  return parse(mimeTypeSchema, part.mimeType);
}

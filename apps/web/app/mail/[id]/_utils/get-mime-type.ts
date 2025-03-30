import { MessagePart } from "@/lib/gmail/schemas";
import { z } from "zod";

const mimeTypeSchema = z.enum([
  // text
  "text/plain",
  "text/html",
  // multipart
  "multipart/alternative",
  "multipart/related",
  // image
  "image/png",
]);

export type MimeType = z.infer<typeof mimeTypeSchema>;

export function getMimeType(part: MessagePart) {
  const mimeType = mimeTypeSchema.parse(part.mimeType);
  return mimeType;
}

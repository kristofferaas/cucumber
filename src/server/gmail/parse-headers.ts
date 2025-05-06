import { err } from "@/lib/try-catch";
import { parse } from "@/lib/try-catch/std";
import { z } from "zod";

const charsetSchema = z.enum([
  "utf-8",
  "iso-8859-1",
  "windows-1252",
  "us-ascii",
]);
export type Charset = z.infer<typeof charsetSchema>;

const contentTypeSchema = z.enum([
  // text
  "text/plain",
  "text/html",
  // multipart
  "multipart/alternative",
  "multipart/related",
  // image
  "image/png",
]);
export type ContentType = z.infer<typeof contentTypeSchema>;

const encodingSchema = z.enum(["base64", "quoted-printable", "8bit", "7bit"]);
export type Encoding = z.infer<typeof encodingSchema>;

const contentDetailsSchema = z.object({
  charset: charsetSchema,
  mimeType: contentTypeSchema,
  encoding: encodingSchema,
});

/**
 * Extract content details from message headers
 */
export function getContentDetails(headers?: { name: string; value: string }[]) {
  if (!headers) {
    return err(new Error("No headers found"));
  }

  let charset = "utf-8";
  let mimeType = "";
  let encoding = "base64";

  for (const header of headers) {
    if (header.name.toLowerCase() === "content-type") {
      mimeType = header.value.split(";")[0]?.trim() ?? "";

      // Extract charset if present
      const charsetMatch = /charset=([^;]+)/i.exec(header.value);
      if (charsetMatch?.[1]) {
        charset = charsetMatch[1].trim().replace(/["']/g, "").toLowerCase();
      }
    } else if (header.name.toLowerCase() === "content-transfer-encoding") {
      encoding = header.value.trim().toLowerCase();
    }
  }

  return parse(contentDetailsSchema, { charset, mimeType, encoding });
}

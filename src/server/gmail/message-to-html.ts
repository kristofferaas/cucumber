import type { Message } from "@/server/gmail/schemas";
import { err } from "@/lib/try-catch";
import { processMessagePart } from "./process-message";

export function messageToHtml(message: Message) {
  const payload = message.payload;

  if (!payload) {
    return err(new Error("No payload found"));
  }

  const data = processMessagePart(payload);

  return data;
}

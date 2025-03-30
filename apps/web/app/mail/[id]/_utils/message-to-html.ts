import type { Message } from "@/lib/gmail/schemas";
import { processMessagePart } from "./process-message";

export function messageToHtml(message: Message) {
  const payload = message.payload;

  if (!payload) {
    throw new Error("No payload found");
  }

  console.log("messageToHtml", message);
  const data = processMessagePart(payload);

  return data;
}

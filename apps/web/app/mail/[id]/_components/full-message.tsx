import type { Message } from "@/lib/gmail/schemas";
import { messageToHtml } from "../_utils/message-to-html";
import { createGmailApiClient } from "@/lib/gmail";
import { EmailIframe } from "./email-iframe";

export async function FullMessage({
  message,
  id,
  token,
}: {
  message: Message;
  id: string;
  token: string;
}) {
  const gmail = createGmailApiClient({ accessToken: token });

  const parts = messageToHtml(message);

  const attachmentRequests = parts
    .filter((part) => part.contentType === "image/png")
    .map((part) => ({
      messageId: id,
      attachmentId: part.data,
      id: part.id,
    }));

  const attachments = await gmail.batchGetAttachments(attachmentRequests);

  let html = parts.find((part) => part.contentType === "text/html")?.data || "";

  // Replace CID image references with data URIs
  if (html && attachments) {
    // Process each attachment response and build the map
    attachments.forEach((attachment) => {
      if (attachment.body.data && attachment.id) {
        // attachmentMap.set(attachment.id, attachment.body);
        const cidRegex = new RegExp(
          `<img([^>]*)src=["']cid:${attachment.id}["']([^>]*)>`,
          "gi"
        );

        const base64Data = Buffer.from(attachment.body.data, "base64").toString(
          "base64"
        );

        // Replace with data URI while preserving other attributes
        html = html.replace(
          cidRegex,
          `<img$1src="data:image/png;base64,${base64Data}"$2>`
        );
      }
    });
  }

  const plainText =
    parts.find((part) => part.contentType === "text/plain")?.data || "";

  return (
    <div>
      {html ? (
        <EmailIframe html={html} />
      ) : (
        <div className="mt-4">
          <pre className="text-sm text-muted-foreground">{plainText}</pre>
        </div>
      )}
    </div>
  );
}

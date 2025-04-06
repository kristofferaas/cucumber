import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { createGmailApiClient } from "@/server/gmail/api";
import { TRPCError } from "@trpc/server";
import { messageToHtml } from "@/server/gmail/message-to-html";

export const gmailRouter = createTRPCRouter({
  getMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const gmail = createGmailApiClient({ accessToken: ctx.googleToken });
      const { messageId } = input;

      const [message, messageError] = await gmail.getMessage(messageId, "full");
      if (messageError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: messageError.message,
        });
      }

      const [parts, partsError] = messageToHtml(message);
      if (partsError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: partsError.message,
        });
      }

      const attachmentRequests = parts
        .filter((part) => part.contentType === "image/png")
        .map((part) => ({
          messageId,
          attachmentId: part.data,
          id: part.id,
        }));

      const [attachments, attachmentsError] =
        await gmail.batchGetAttachments(attachmentRequests);

      if (attachmentsError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: attachmentsError.message,
        });
      }

      let html = parts.find((part) => part.contentType === "text/html")?.data;

      // Replace CID image references with data URIs
      if (html) {
        // Process each attachment response and build the map
        attachments.forEach((attachment) => {
          if (attachment.body.data && attachment.id) {
            // attachmentMap.set(attachment.id, attachment.body);
            const cidRegex = new RegExp(
              `<img([^>]*)src=["']cid:${attachment.id}["']([^>]*)>`,
              "gi",
            );

            const base64Data = Buffer.from(
              attachment.body.data,
              "base64",
            ).toString("base64");

            // Replace with data URI while preserving other attributes
            html = html?.replace(
              cidRegex,
              `<img$1src="data:image/png;base64,${base64Data}"$2>`,
            );
          }
        });
      }
      return {
        html,
      };
    }),
});

import { z } from "zod";

// Message schemas
export const MessagePartHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export type MessagePartHeader = z.infer<typeof MessagePartHeaderSchema>;

export const MessagePartBodySchema = z.object({
  attachmentId: z.string().optional(),
  size: z.number(),
  data: z.string().optional(), // Base64 encoded data
});

export type MessagePartBody = z.infer<typeof MessagePartBodySchema>;

// Attachment schemas
export const MessageAttachmentSchema = z.object({
  data: z.string().optional(), // Base64 encoded attachment data
  size: z.number(),
  attachmentId: z.string().optional(),
});

export type MessageAttachment = z.infer<typeof MessageAttachmentSchema>;

// Define base MessagePart schema without recursive parts field
export const baseMessagePartSchema = z.object({
  partId: z.string().optional(),
  mimeType: z.string(),
  filename: z.string().optional(),
  headers: z.array(MessagePartHeaderSchema).optional(),
  body: MessagePartBodySchema,
});

// Define the complete MessagePart type with recursion
export type MessagePart = z.infer<typeof baseMessagePartSchema> & {
  parts?: MessagePart[];
};

// Create the final schema with proper type hint
export const MessagePartSchema: z.ZodType<MessagePart> =
  baseMessagePartSchema.extend({
    parts: z.lazy(() => z.array(MessagePartSchema).optional()),
  });

export const MessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  payload: MessagePartSchema.optional(),
  sizeEstimate: z.number().optional(),
  raw: z.string().optional(), // Base64 encoded full message data
});

export type Message = z.infer<typeof MessageSchema>;

export const MessageListSchema = z.object({
  messages: z.array(MessageSchema).optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

export type MessageList = z.infer<typeof MessageListSchema>;

// Thread schemas
export const ThreadSchema = z.object({
  id: z.string(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  messages: z.array(MessageSchema).optional(),
});

export type Thread = z.infer<typeof ThreadSchema>;

export const ThreadListSchema = z.object({
  threads: z.array(ThreadSchema).optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

export type ThreadList = z.infer<typeof ThreadListSchema>;

// Label schemas
export const LabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  messageListVisibility: z.enum(["hide", "show"]).optional(),
  labelListVisibility: z
    .enum(["labelHide", "labelShow", "labelShowIfUnread"])
    .optional(),
  type: z.enum(["system", "user"]).optional(),
  messagesTotal: z.number().optional(),
  messagesUnread: z.number().optional(),
  threadsTotal: z.number().optional(),
  threadsUnread: z.number().optional(),
  color: z
    .object({
      textColor: z.string().optional(),
      backgroundColor: z.string().optional(),
    })
    .optional(),
});

export type Label = z.infer<typeof LabelSchema>;

export const LabelListSchema = z.object({
  labels: z.array(LabelSchema).optional(),
});

export type LabelList = z.infer<typeof LabelListSchema>;

// Draft schemas
export const DraftSchema = z.object({
  id: z.string(),
  message: MessageSchema,
});

export type Draft = z.infer<typeof DraftSchema>;

export const DraftListSchema = z.object({
  drafts: z.array(DraftSchema).optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

export type DraftList = z.infer<typeof DraftListSchema>;

// History schemas
export const HistorySchema = z.object({
  id: z.string(),
  messages: z.array(MessageSchema).optional(),
  messagesAdded: z
    .array(
      z.object({
        message: MessageSchema,
      })
    )
    .optional(),
  messagesDeleted: z
    .array(
      z.object({
        message: MessageSchema,
      })
    )
    .optional(),
  labelsAdded: z
    .array(
      z.object({
        message: MessageSchema,
        labelIds: z.array(z.string()),
      })
    )
    .optional(),
  labelsRemoved: z
    .array(
      z.object({
        message: MessageSchema,
        labelIds: z.array(z.string()),
      })
    )
    .optional(),
});

export type History = z.infer<typeof HistorySchema>;

export const HistoryListSchema = z.object({
  history: z.array(HistorySchema).optional(),
  nextPageToken: z.string().optional(),
  historyId: z.string().optional(),
});

export type HistoryList = z.infer<typeof HistoryListSchema>;

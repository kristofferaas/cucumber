import { z } from "zod";

const fullMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()),
  snippet: z.string(),
  payload: z.object({
    partId: z.string(),
    mimeType: z.string(),
    filename: z.string(),
    headers: z.array(
      z.object({
        name: z.string(),
        value: z.string(),
      })
    ),
    body: z.object({
      size: z.number(),
      data: z.string().optional(),
      attachmentId: z.string().optional(),
    }),
    parts: z.array(
      z.object({
        partId: z.string(),
        mimeType: z.string(),
        filename: z.string(),
        headers: z.array(
          z.object({
            name: z.string(),
            value: z.string(),
          })
        ),
        body: z.object({
          size: z.number(),
          data: z.string().optional(),
          attachmentId: z.string().optional(),
        }),
        parts: z
          .array(
            z.object({
              partId: z.string(),
              mimeType: z.string(),
              filename: z.string(),
              headers: z.array(
                z.object({
                  name: z.string(),
                  value: z.string(),
                })
              ),
              body: z.object({
                size: z.number(),
                data: z.string().optional(),
                attachmentId: z.string().optional(),
              }),
            })
          )
          .optional(),
      })
    ),
  }),
  sizeEstimate: z.number(),
  historyId: z.string(),
  internalDate: z.string(),
});

export async function fetchFullMessage(id: string, token: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const data = await response.json();
  console.log(data);
  return fullMessageSchema.parse(data);
}

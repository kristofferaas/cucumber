import { z } from "zod";
import type { User } from "@clerk/nextjs/server";
import { ClerkUser } from "./MailList";

const SCOPE = "https://mail.google.com/";

const messageListSchema = z.object({
  messages: z
    .object({
      id: z.string(),
      threadId: z.string(),
    })
    .array()
    .optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});
type MessageList = z.infer<typeof messageListSchema>;

const messageSchema = z
  .object({
    historyId: z.string(),
    id: z.string(),
    threadId: z.string(),
    snippet: z.string(),
    labelIds: z.array(z.string()).optional(),
    payload: z
      .object({
        headers: z.array(
          z.object({
            name: z.string(),
            value: z.string(),
          })
        ),
      })
      .passthrough(),
    internalDate: z.string(),
    sizeEstimate: z.number(),
  })
  .passthrough();
export type Message = z.infer<typeof messageSchema>;

/**
 * Helper to implement exponential backoff for API calls
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches messages in batch from Gmail API with rate limiting protection
 * @see https://developers.google.com/gmail/api/guides/batch
 */
export async function fetchMessages(
  token: string,
  user: ClerkUser,
  pageToken?: string
) {
  // Check if user has necessary permissions
  if (!user) {
    throw new Error("No user found");
  }

  const googleAccount = user.externalAccounts.find(
    (ea) => ea.provider === "google"
  );

  if (!googleAccount?.approvedScopes?.includes(SCOPE)) {
    await requestGmailScopes(user);
    throw new Error("Reauthorization required");
  }

  // Gmail API has tight rate limits - keep batch size very small
  // Even though Google recommends max 50, we're using a much smaller number to avoid rate limits
  const BATCH_SIZE = 20;

  // Build request URL with pagination support
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${BATCH_SIZE}`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }

  // First fetch the message list
  const listResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Check for rate limiting on the list request
  if (listResponse.status === 429) {
    const retryAfter = listResponse.headers.get("Retry-After");
    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;

    console.warn(
      `Rate limited on list request. Waiting ${waitTime}ms before trying again.`
    );
    await sleep(waitTime);

    // Return empty result to avoid breaking the UI
    return {
      messages: [] as Message[],
      nextPageToken: undefined,
      totalMessages: 0,
      fetchedCount: 0,
      rateLimited: true,
    };
  }

  const listData = await listResponse.json();
  const parsedListData = messageListSchema.parse(listData);

  if (!parsedListData.messages || parsedListData.messages.length === 0) {
    return {
      messages: [] as Message[],
      nextPageToken: parsedListData.nextPageToken,
      totalMessages: parsedListData.resultSizeEstimate,
      fetchedCount: 0,
    };
  }

  const messagesToFetch = parsedListData.messages.slice(0, BATCH_SIZE);

  // Create a unique boundary string
  const boundary = `batch_boundary_${Math.random().toString(36).substring(2, 15)}`;

  // Prepare for batch request
  const batchRequests = messagesToFetch.map((message, index) => {
    const messageId = message.id;
    return [
      `--${boundary}`,
      `Content-Type: application/http`,
      `Content-ID: <item${index}>`,
      "",
      `GET /gmail/v1/users/me/messages/${messageId}`,
      "",
      "",
    ].join("\r\n");
  });

  // Create the complete multipart batch request
  const batchBody = [batchRequests.join(""), `--${boundary}--`, ""].join(
    "\r\n"
  );

  // Send the batch request with retry logic
  let batchResponse;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (retryCount <= MAX_RETRIES) {
    try {
      batchResponse = await fetch(`https://www.googleapis.com/batch/gmail/v1`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/mixed; boundary=${boundary}`,
        },
        body: batchBody,
      });

      // If we get a 429 (rate limit) status, implement exponential backoff
      if (batchResponse.status === 429) {
        const retryAfter = batchResponse.headers.get("Retry-After");
        const waitTime = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, retryCount + 1) * 1000;

        console.warn(
          `Rate limited. Retrying in ${waitTime}ms (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`
        );

        // Wait before retrying
        await sleep(waitTime);
        retryCount++;

        // If we've retried too many times, return what we have
        if (retryCount > MAX_RETRIES) {
          return {
            messages: [] as Message[],
            nextPageToken: parsedListData.nextPageToken,
            totalMessages: parsedListData.resultSizeEstimate,
            fetchedCount: 0,
            rateLimited: true,
          };
        }
      } else {
        // We got a non-rate limiting response, break the loop
        break;
      }
    } catch (error) {
      console.error("Error fetching batch response:", error);
      retryCount++;

      if (retryCount > MAX_RETRIES) {
        throw new Error("Max retries exceeded for batch request");
      }

      // Wait with exponential backoff before retrying
      const waitTime = Math.pow(2, retryCount) * 1000;
      await sleep(waitTime);
    }
  }

  if (!batchResponse) {
    throw new Error("Failed to fetch batch response after retries");
  }

  // Process the multipart response
  const responseText = await batchResponse.text();

  // Extract the response boundary from the Content-Type header (Gmail API uses a different boundary)
  let responseBoundary = boundary;
  const contentTypeHeader = batchResponse.headers.get("Content-Type");
  if (contentTypeHeader) {
    const boundaryMatch = contentTypeHeader.match(/boundary=([^;]+)/i);
    if (boundaryMatch && boundaryMatch[1]) {
      responseBoundary = boundaryMatch[1].trim();
      // Remove quotes if present
      if (responseBoundary.startsWith('"') && responseBoundary.endsWith('"')) {
        responseBoundary = responseBoundary.slice(1, -1);
      }
    }
  }

  // Parse multipart response
  const parts = parseMultipartMixed(responseText, responseBoundary);

  // Map the parts to message data
  const messages = parts
    .filter((part) => part.trim() !== "")
    .map((part: string) => {
      try {
        // Find the JSON object in the response
        let jsonText = part.trim();

        // Handle case where there might be other text before the JSON
        const jsonStartIndex = jsonText.indexOf("{");
        if (jsonStartIndex > 0) {
          jsonText = jsonText.substring(jsonStartIndex);
        }

        // Parse the JSON and validate with zod
        const jsonData = JSON.parse(jsonText);
        return messageSchema.parse(jsonData);
      } catch (error) {
        console.error("Failed to parse message data", error);
        return null;
      }
    })
    .filter((message): message is Message => message !== null);

  // Return the messages with the next page token
  return {
    messages,
    nextPageToken: parsedListData.nextPageToken,
    totalMessages: parsedListData.resultSizeEstimate,
    fetchedCount: messages.length,
  };
}

/**
 * Helper function to request Gmail scopes
 * Uses window.location for client-side redirect
 */
async function requestGmailScopes(user: ClerkUser) {
  if (!user) return;

  try {
    const googleAccount = user.externalAccounts.find(
      (ea) => ea.provider === "google"
    );

    if (!googleAccount) return;

    // Use type assertion since the Clerk types might not include this method
    const accountWithReauth = googleAccount as unknown as {
      reauthorize: (options: {
        redirectUrl: string;
        additionalScopes: string[];
      }) => Promise<{
        verification?: {
          externalVerificationRedirectURL?: { href: string };
        };
      }>;
    };

    const reauth = await accountWithReauth.reauthorize({
      redirectUrl: window.location.href,
      additionalScopes: [SCOPE],
    });

    if (reauth?.verification?.externalVerificationRedirectURL) {
      window.location.href =
        reauth.verification.externalVerificationRedirectURL.href;
    }
  } catch (error) {
    console.error("Failed to reauthorize Gmail scopes", error);
  }
}

/**
 * Helper function to parse multipart/mixed response
 * @see https://developers.google.com/gmail/api/guides/batch
 */
function parseMultipartMixed(text: string, boundary: string): string[] {
  // Split by boundary
  const boundaryParts = text.split(`--${boundary}`);

  // Ignore the first (empty) and last (closing) parts
  const responseParts = boundaryParts.slice(1, -1);

  return responseParts.map((part) => {
    try {
      // Find where headers end and body begins
      const headerBodySeparator = part.indexOf("\r\n\r\n");
      if (headerBodySeparator === -1) return "";

      const body = part.substring(headerBodySeparator + 4);

      // Find the HTTP response status line and headers
      const httpHeadersEnd = body.indexOf("\r\n\r\n");
      if (httpHeadersEnd === -1) return "";

      // Get the actual JSON response body
      const responseBody = body.substring(httpHeadersEnd + 4);

      // Check HTTP status code
      const statusLine = body.substring(0, body.indexOf("\r\n"));
      const statusMatch = statusLine.match(/HTTP\/[\d.]+\s+(\d{3})/);
      const statusCode =
        statusMatch && statusMatch[1] ? parseInt(statusMatch[1], 10) : 0;

      // If not a successful status code, log error and return empty
      if (statusCode < 200 || statusCode >= 300) {
        console.error(`Error in batch response: ${statusLine}`);
        console.error(responseBody);
        return "";
      }

      return responseBody;
    } catch (error) {
      console.error("Error parsing multipart response part", error);
      return "";
    }
  });
}

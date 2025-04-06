import { type Err, err, type Ok, ok, wrap } from "@/lib/try-catch";
import type {
  Draft,
  DraftList,
  HistoryList,
  Label,
  LabelList,
  Message,
  MessageAttachment,
  MessageList,
  Thread,
  ThreadList,
} from "./schemas";
import {
  MessageSchema,
  MessageAttachmentSchema,
  ThreadSchema,
} from "./schemas";

// Constants
export const GMAIL_API_BASE_URL =
  "https://www.googleapis.com/gmail/v1/users/me";
export const GMAIL_BATCH_URL = "https://www.googleapis.com/batch/gmail/v1";

// Types for Gmail API client
export type GmailApiClientOptions = {
  accessToken: string;
};

// Type for batch request body to ensure type safety
export type BatchRequestBody =
  | Record<string, unknown>
  | string
  | null
  | undefined;

// Attachment request type
export type AttachmentRequest = {
  messageId: string;
  attachmentId: string;
  id?: string;
};

// Batch request types
export type BatchRequest = {
  method: string;
  path: string;
  body?: BatchRequestBody;
  headers?: Record<string, string>;
  id?: string;
};

export type BatchResponse<T = unknown> = {
  id: string;
  status: number;
  headers: Record<string, string>;
  body: T;
  error?: {
    code: number;
    message: string;
    errors?: Array<{
      message: string;
      domain: string;
      reason: string;
    }>;
    status?: string;
  };
};

/**
 * Creates a Gmail API client for making authenticated requests to the Gmail API
 *
 * @param options Client configuration options
 * @returns Object with methods for interacting with the Gmail API
 *
 * @example
 * const gmail = createGmailApiClient({ accessToken: 'your-token' });
 * const messages = await gmail.getMessages({ maxResults: 10 });
 */
export const createGmailApiClient = (options: GmailApiClientOptions) => {
  const { accessToken } = options;

  /**
   * Internal helper to fetch data from the Gmail API
   */
  const fetchGmailApi = async <T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Ok<T> | Err<Error>> => {
    const url = `${GMAIL_API_BASE_URL}${endpoint}`;

    const [response, error] = await wrap(
      fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }),
    );

    if (error) {
      return err(error);
    }

    if (!response.ok) {
      const [json, jsonError] = await wrap(response.json());
      if (jsonError) {
        return err(jsonError);
      }

      return err(
        new Error(
          `Gmail API Error (${response.status}): ${JSON.stringify(json)}`,
        ),
      );
    }

    const [json, jsonError] = await wrap(response.json());
    if (jsonError) {
      return err(jsonError);
    }

    return ok(json);
  };

  /**
   * Creates and executes a batch request to the Gmail API
   *
   * @param requests Array of batch requests to execute
   * @returns Array of batch responses in the same order as the requests
   *
   * @example
   * // Fetch multiple messages in a single request
   * const responses = await gmail.executeBatch([
   *   { method: 'GET', path: '/messages/msg1', id: '1' },
   *   { method: 'GET', path: '/messages/msg2', id: '2' }
   * ]);
   */
  const executeBatch = async <T = unknown>(
    requests: BatchRequest[],
  ): Promise<Ok<BatchResponse<T>[]> | Err<Error>> => {
    if (requests.length === 0) {
      return ok([]);
    }

    if (requests.length > 100) {
      return err(
        new Error("Batch requests are limited to 100 requests per batch"),
      );
    }

    // Generate a unique boundary string
    const boundary = `batch_${Math.random().toString(36).substring(2)}`;

    // Construct the multipart request body
    let requestBody = "";

    requests.forEach((request, index) => {
      // Generate an ID if not provided
      const id = request.id ?? `batch-${index}`;

      requestBody += `--${boundary}\r\n`;
      requestBody += `Content-Type: application/http\r\n`;
      requestBody += `Content-ID: <${id}>\r\n\r\n`;

      // Add the HTTP method and path
      requestBody += `${request.method} /gmail/v1/users/me${request.path}\r\n`;

      // Add request-specific headers if any
      if (request.headers) {
        Object.entries(request.headers).forEach(([key, value]) => {
          requestBody += `${key}: ${value}\r\n`;
        });
      }

      // Add body if it exists
      if (request.body !== undefined && request.body !== null) {
        requestBody += `Content-Type: application/json\r\n\r\n`;
        requestBody +=
          typeof request.body === "string"
            ? request.body
            : JSON.stringify(request.body);
        requestBody += "\r\n";
      } else {
        requestBody += "\r\n";
      }
    });

    // Add the final boundary
    requestBody += `--${boundary}--`;

    // Send the batch request
    const [response, error] = await wrap(
      fetch(GMAIL_BATCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/mixed; boundary=${boundary}`,
        },
        body: requestBody,
      }),
    );

    if (error) {
      return err(error);
    }

    if (!response.ok) {
      return err(
        new Error(`Batch request failed with status ${response.status}`),
      );
    }

    // Parse the multipart response
    const responseText = await response.text();
    const responses: BatchResponse<T>[] = [];

    // Extract the actual boundary from the response
    // Look for the first boundary line pattern in the response
    const responseBoundaryMatch = /--([a-zA-Z0-9_]+)/.exec(responseText);
    const responseBoundary = responseBoundaryMatch
      ? responseBoundaryMatch[1]
      : boundary;

    // Split the response by boundary
    const parts = responseText.split(`--${responseBoundary}`);

    // Process each part (excluding the first and last elements which are empty or closing markers)
    for (let i = 1; i < parts.length - 1; i++) {
      const part = parts[i];

      // Skip empty parts or undefined
      if (!part?.trim()) continue;

      // Parse response ID from Content-ID header
      const contentIdMatch = /Content-ID: <response-(.*?)>/i.exec(part);
      const id = contentIdMatch?.[1] ?? `batch-${i - 1}`;

      // Find the beginning of the HTTP response status line
      const httpResponseStart = part.indexOf("HTTP/");
      if (httpResponseStart === -1) continue;

      // Extract status code
      const statusLineMatch = /HTTP\/[\d.]+ (\d+)/.exec(
        part.substring(httpResponseStart),
      );
      const status = statusLineMatch?.[1]
        ? parseInt(statusLineMatch[1], 10)
        : 500;

      // Extract headers and body
      const headerBodySplit = part.indexOf("\r\n\r\n", httpResponseStart);
      if (headerBodySplit === -1) continue;

      const headerSection = part.substring(httpResponseStart, headerBodySplit);
      const bodySection = part.substring(headerBodySplit + 4);

      // Parse headers
      const headers: Record<string, string> = {};
      const headerLines = headerSection.split("\r\n").slice(1); // Skip the status line

      headerLines.forEach((line) => {
        const colonIdx = line.indexOf(":");
        if (colonIdx !== -1) {
          const key = line.substring(0, colonIdx).trim();
          const value = line.substring(colonIdx + 1).trim();
          headers[key] = value;
        }
      });

      // Parse body based on content type
      let body: unknown = bodySection.trim();
      if (headers["Content-Type"]?.includes("application/json")) {
        try {
          body = JSON.parse(bodySection.trim());
        } catch {
          // If parsing fails, keep as text
        }
      }

      const batchResponse: BatchResponse<T> = {
        id,
        status,
        headers,
        body: body as T,
      };

      // Extract error information if status code indicates an error
      if (status >= 400 && typeof body === "object" && body !== null) {
        const errorBody = body as Record<string, unknown>;
        if (
          "error" in errorBody &&
          typeof errorBody.error === "object" &&
          errorBody.error !== null
        ) {
          const error = errorBody.error as Record<string, unknown>;
          batchResponse.error = {
            code: typeof error.code === "number" ? error.code : status,
            message:
              typeof error.message === "string"
                ? error.message
                : "Unknown error",
            errors: Array.isArray(error.errors) ? error.errors : undefined,
            status: typeof error.status === "string" ? error.status : undefined,
          };
        }
      }

      responses.push(batchResponse);
    }

    return ok(responses);
  };

  /**
   * Get an attachment from a message
   *
   * @param messageId ID of the message containing the attachment
   * @param attachmentId ID of the attachment to fetch
   * @returns The attachment data
   *
   * @example
   * // Fetch an attachment from a message
   * const attachment = await gmail.getAttachment('msg1', 'attachment1');
   * // Use the base64 encoded data
   * const decodedData = atob(attachment.data);
   */
  const getAttachment = async (messageId: string, attachmentId: string) => {
    const [response, error] = await fetchGmailApi<unknown>(
      `/messages/${messageId}/attachments/${attachmentId}`,
    );

    if (error) {
      return err(error);
    }

    const result = MessageAttachmentSchema.safeParse(response);
    if (result.success) {
      return ok(result.data);
    }

    return err(new Error("Failed to validate attachment response"));
  };

  /**
   * Get multiple attachments in a single batch request
   *
   * @param requests Array of attachment requests containing messageId and attachmentId
   * @returns Array of batch responses containing the attachments
   *
   * @example
   * // Fetch multiple attachments in a single request
   * const responses = await gmail.batchGetAttachments([
   *   { messageId: 'msg1', attachmentId: 'att1', id: 'attachment-1' },
   *   { messageId: 'msg2', attachmentId: 'att2', id: 'attachment-2' }
   * ]);
   * // Access attachment data
   * const attachmentData = responses[0].body.data;
   */
  const batchGetAttachments = async (requests: AttachmentRequest[]) => {
    const batchRequests: BatchRequest[] = requests.map((request, index) => ({
      method: "GET",
      path: `/messages/${request.messageId}/attachments/${request.attachmentId}`,
      id: request.id ?? `attachment-${index}`,
    }));

    const [responses, error] = await executeBatch<unknown>(batchRequests);

    if (error) {
      return err(error);
    }

    // Validate each response body with Zod schema
    return ok(
      responses.map((response) => {
        if (response.status === 200) {
          const result = MessageAttachmentSchema.safeParse(response.body);
          if (result.success) {
            response.body = result.data;
          } else {
            console.error(
              `Failed to validate attachment response:`,
              result.error,
            );
          }
        }
        return response as BatchResponse<MessageAttachment>;
      }),
    );
  };

  /**
   * Get multiple messages in a single batch request
   *
   * @param ids Array of message IDs to fetch
   * @param format Format of the messages to fetch
   * @returns Array of batch responses containing the messages
   *
   * @example
   * // Fetch multiple messages in a single request
   * const responses = await gmail.batchGetMessages(['msg1', 'msg2']);
   * const messages = responses.map(response => response.body);
   */
  const batchGetMessages = async (
    ids: string[],
    format: "full" | "minimal" | "raw" = "full",
  ) => {
    const requests: BatchRequest[] = ids.map((id, index) => ({
      method: "GET",
      path: `/messages/${id}?format=${format}`,
      id: `msg-${index}`,
    }));

    const [responses, error] = await executeBatch<Message>(requests);

    if (error) {
      return err(error);
    }

    // Validate each response body with Zod schema
    return ok(
      responses.map((response) => {
        if (response.status === 200) {
          const result = MessageSchema.safeParse(response.body);
          if (result.success) {
            response.body = result.data;
          } else {
            console.error(`Failed to validate message response:`, result.error);
          }
        }
        return response;
      }),
    );
  };

  /**
   * Get multiple threads in a single batch request
   *
   * @param ids Array of thread IDs to fetch
   * @param format Format of the threads to fetch
   * @returns Array of batch responses containing the threads
   *
   * @example
   * // Fetch multiple threads in a single request
   * const responses = await gmail.batchGetThreads(['thread1', 'thread2']);
   * const threads = responses.map(response => response.body);
   */
  const batchGetThreads = async (
    ids: string[],
    format: "full" | "minimal" | "raw" = "full",
  ) => {
    const requests: BatchRequest[] = ids.map((id, index) => ({
      method: "GET",
      path: `/threads/${id}?format=${format}`,
      id: `thread-${index}`,
    }));

    const [responses, error] = await executeBatch<Thread>(requests);

    if (error) {
      return err(error);
    }

    // Validate each response body with Zod schema
    return ok(
      responses.map((response) => {
        if (response.status === 200) {
          const result = ThreadSchema.safeParse(response.body);
          if (result.success) {
            response.body = result.data;
          } else {
            console.error(`Failed to validate thread response:`, result.error);
          }
        }
        return response;
      }),
    );
  };

  /**
   * Modify multiple messages in a single batch request
   *
   * @param requests Array of message modifications to perform
   * @returns Array of batch responses containing the modified messages
   *
   * @example
   * // Add and remove labels from multiple messages in a single request
   * const responses = await gmail.batchModifyMessages([
   *   { id: 'msg1', addLabelIds: ['INBOX'], removeLabelIds: ['TRASH'] },
   *   { id: 'msg2', addLabelIds: ['IMPORTANT'] }
   * ]);
   */
  const batchModifyMessages = async (
    requests: Array<{
      id: string;
      addLabelIds?: string[];
      removeLabelIds?: string[];
    }>,
  ) => {
    const batchRequests: BatchRequest[] = requests.map((request, index) => ({
      method: "POST",
      path: `/messages/${request.id}/modify`,
      id: `modify-${index}`,
      body: {
        addLabelIds: request.addLabelIds ?? [],
        removeLabelIds: request.removeLabelIds ?? [],
      },
    }));

    const [responses, error] = await executeBatch<Message>(batchRequests);

    if (error) {
      return err(error);
    }

    // Validate each response body with Zod schema
    return ok(
      responses.map((response) => {
        if (response.status === 200) {
          const result = MessageSchema.safeParse(response.body);
          if (result.success) {
            response.body = result.data;
          } else {
            console.error(`Failed to validate message response:`, result.error);
          }
        }
        return response;
      }),
    );
  };

  /**
   * Trash multiple messages in a single batch request
   *
   * @param ids Array of message IDs to trash
   * @returns Array of batch responses containing the trashed messages
   *
   * @example
   * // Trash multiple messages in a single request
   * const responses = await gmail.batchTrashMessages(['msg1', 'msg2']);
   */
  const batchTrashMessages = async (ids: string[]) => {
    const requests: BatchRequest[] = ids.map((id, index) => ({
      method: "POST",
      path: `/messages/${id}/trash`,
      id: `trash-${index}`,
    }));

    const [responses, error] = await executeBatch<Message>(requests);

    if (error) {
      return err(error);
    }

    // Validate each response body with Zod schema
    return ok(
      responses.map((response) => {
        if (response.status === 200) {
          const result = MessageSchema.safeParse(response.body);
          if (result.success) {
            response.body = result.data;
          } else {
            console.error(`Failed to validate message response:`, result.error);
          }
        }
        return response;
      }),
    );
  };

  /**
   * Untrash multiple messages in a single batch request
   *
   * @param ids Array of message IDs to untrash
   * @returns Array of batch responses containing the untrashed messages
   *
   * @example
   * // Untrash multiple messages in a single request
   * const responses = await gmail.batchUntrashMessages(['msg1', 'msg2']);
   */
  const batchUntrashMessages = async (ids: string[]) => {
    const requests: BatchRequest[] = ids.map((id, index) => ({
      method: "POST",
      path: `/messages/${id}/untrash`,
      id: `untrash-${index}`,
    }));

    const [responses, error] = await executeBatch<Message>(requests);

    if (error) {
      return err(error);
    }

    // Validate each response body with Zod schema
    return ok(
      responses.map((response) => {
        if (response.status === 200) {
          const result = MessageSchema.safeParse(response.body);
          if (result.success) {
            response.body = result.data;
          } else {
            console.error(`Failed to validate message response:`, result.error);
          }
        }
        return response;
      }),
    );
  };

  /**
   * Get messages with pagination and filtering options
   */
  const getMessages = async (
    params: {
      maxResults?: number;
      labelIds?: string[];
      q?: string;
      pageToken?: string;
    } = {},
  ) => {
    const searchParams = new URLSearchParams();

    if (params.maxResults)
      searchParams.append("maxResults", params.maxResults.toString());
    if (params.pageToken) searchParams.append("pageToken", params.pageToken);
    if (params.q) searchParams.append("q", params.q);
    if (params.labelIds?.length) {
      params.labelIds.forEach((id) => searchParams.append("labelIds", id));
    }

    const queryString = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    return fetchGmailApi<MessageList>(`/messages${queryString}`);
  };

  /**
   * Get a single message by ID
   */
  const getMessage = async (
    id: string,
    format: "full" | "minimal" | "raw" = "full",
  ) => {
    return fetchGmailApi<Message>(`/messages/${id}?format=${format}`);
  };

  /**
   * Get threads with pagination and filtering options
   */
  const getThreads = async (
    params: {
      maxResults?: number;
      labelIds?: string[];
      q?: string;
      pageToken?: string;
    } = {},
  ) => {
    const searchParams = new URLSearchParams();

    if (params.maxResults)
      searchParams.append("maxResults", params.maxResults.toString());
    if (params.pageToken) searchParams.append("pageToken", params.pageToken);
    if (params.q) searchParams.append("q", params.q);
    if (params.labelIds?.length) {
      params.labelIds.forEach((id) => searchParams.append("labelIds", id));
    }

    const queryString = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    return fetchGmailApi<ThreadList>(`/threads${queryString}`);
  };

  /**
   * Get a single thread by ID
   */
  const getThread = async (
    id: string,
    format: "full" | "minimal" | "raw" = "full",
  ) => {
    return fetchGmailApi<Thread>(`/threads/${id}?format=${format}`);
  };

  /**
   * Get all labels
   */
  const getLabels = async () => {
    return fetchGmailApi<LabelList>(`/labels`);
  };

  /**
   * Get a label by ID
   */
  const getLabel = async (id: string) => {
    return fetchGmailApi<Label>(`/labels/${id}`);
  };

  /**
   * Get drafts with pagination
   */
  const getDrafts = async (
    params: { maxResults?: number; pageToken?: string } = {},
  ) => {
    const searchParams = new URLSearchParams();

    if (params.maxResults)
      searchParams.append("maxResults", params.maxResults.toString());
    if (params.pageToken) searchParams.append("pageToken", params.pageToken);

    const queryString = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    return fetchGmailApi<DraftList>(`/drafts${queryString}`);
  };

  /**
   * Get a single draft by ID
   */
  const getDraft = async (
    id: string,
    format: "full" | "minimal" | "raw" = "full",
  ) => {
    return fetchGmailApi<Draft>(`/drafts/${id}?format=${format}`);
  };

  /**
   * Get history changes since a specific point
   */
  const getHistory = async (params: {
    startHistoryId: string;
    labelId?: string;
    historyTypes?: string[];
    maxResults?: number;
    pageToken?: string;
  }) => {
    const searchParams = new URLSearchParams();

    searchParams.append("startHistoryId", params.startHistoryId);
    if (params.labelId) searchParams.append("labelId", params.labelId);
    if (params.maxResults)
      searchParams.append("maxResults", params.maxResults.toString());
    if (params.pageToken) searchParams.append("pageToken", params.pageToken);
    if (params.historyTypes?.length) {
      params.historyTypes.forEach((type) =>
        searchParams.append("historyTypes", type),
      );
    }

    const queryString = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    return fetchGmailApi<HistoryList>(`/history${queryString}`);
  };

  return {
    getMessages,
    getMessage,
    getAttachment,
    getThreads,
    getThread,
    getLabels,
    getLabel,
    getDrafts,
    getDraft,
    getHistory,
    executeBatch,
    batchGetMessages,
    batchGetThreads,
    batchGetAttachments,
    batchModifyMessages,
    batchTrashMessages,
    batchUntrashMessages,
  };
};

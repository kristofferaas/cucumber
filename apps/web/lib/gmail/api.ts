import type {
  Draft,
  DraftList,
  HistoryList,
  Label,
  LabelList,
  Message,
  MessageList,
  Thread,
  ThreadList,
} from "./schemas";
import { MessageSchema, ThreadSchema } from "./schemas";

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
};

// Gmail API client return type
export type GmailApiClient = {
  getMessages: (params?: {
    maxResults?: number;
    labelIds?: string[];
    q?: string;
    pageToken?: string;
  }) => Promise<MessageList>;
  getMessage: (
    id: string,
    format?: "full" | "minimal" | "raw"
  ) => Promise<Message>;
  getThreads: (params?: {
    maxResults?: number;
    labelIds?: string[];
    q?: string;
    pageToken?: string;
  }) => Promise<ThreadList>;
  getThread: (
    id: string,
    format?: "full" | "minimal" | "raw"
  ) => Promise<Thread>;
  getLabels: () => Promise<LabelList>;
  getLabel: (id: string) => Promise<Label>;
  getDrafts: (params?: {
    maxResults?: number;
    pageToken?: string;
  }) => Promise<DraftList>;
  getDraft: (id: string, format?: "full" | "minimal" | "raw") => Promise<Draft>;
  getHistory: (params: {
    startHistoryId: string;
    labelId?: string;
    historyTypes?: string[];
    maxResults?: number;
    pageToken?: string;
  }) => Promise<HistoryList>;
  executeBatch: <T = unknown>(
    requests: BatchRequest[]
  ) => Promise<BatchResponse<T>[]>;
  batchGetMessages: (
    ids: string[],
    format?: "full" | "minimal" | "raw"
  ) => Promise<BatchResponse<Message>[]>;
  batchGetThreads: (
    ids: string[],
    format?: "full" | "minimal" | "raw"
  ) => Promise<BatchResponse<Thread>[]>;
  batchModifyMessages: (
    requests: Array<{
      id: string;
      addLabelIds?: string[];
      removeLabelIds?: string[];
    }>
  ) => Promise<BatchResponse<Message>[]>;
  batchTrashMessages: (ids: string[]) => Promise<BatchResponse<Message>[]>;
  batchUntrashMessages: (ids: string[]) => Promise<BatchResponse<Message>[]>;
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
export const createGmailApiClient = (
  options: GmailApiClientOptions
): GmailApiClient => {
  const { accessToken } = options;

  /**
   * Internal helper to fetch data from the Gmail API
   */
  const fetchGmailApi = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const url = `${GMAIL_API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Gmail API Error (${response.status}): ${JSON.stringify(errorData)}`
      );
    }

    return response.json();
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
    requests: BatchRequest[]
  ): Promise<BatchResponse<T>[]> => {
    if (requests.length === 0) {
      return [];
    }

    if (requests.length > 100) {
      throw new Error("Batch requests are limited to 100 requests per batch");
    }

    // Generate a unique boundary string
    const boundary = `batch_${Math.random().toString(36).substring(2)}`;

    // Construct the multipart request body
    let requestBody = "";

    requests.forEach((request, index) => {
      // Generate an ID if not provided
      const id = request.id || `batch-${index}`;

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
    const response = await fetch(GMAIL_BATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error(`Batch request failed with status ${response.status}`);
    }

    // Parse the multipart response
    const responseText = await response.text();
    const responses: BatchResponse<T>[] = [];

    // Split the response by boundary
    const parts = responseText.split(`--${boundary}`);

    // Process each part (excluding the first and last elements which are empty or closing markers)
    for (let i = 1; i < parts.length - 1; i++) {
      const part = parts[i];

      // Skip empty parts or undefined
      if (!part || !part.trim()) continue;

      // Parse response ID from Content-ID header
      const contentIdMatch = part.match(/Content-ID: <response-(.*?)>/i);
      const id =
        contentIdMatch && contentIdMatch[1]
          ? contentIdMatch[1]
          : `batch-${i - 1}`;

      // Find the beginning of the HTTP response status line
      const httpResponseStart = part.indexOf("HTTP/");
      if (httpResponseStart === -1) continue;

      // Extract status code
      const statusLineMatch = part
        .substring(httpResponseStart)
        .match(/HTTP\/[\d.]+ (\d+)/);
      const status =
        statusLineMatch && statusLineMatch[1]
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
        } catch (e) {
          // If parsing fails, keep as text
        }
      }

      responses.push({
        id,
        status,
        headers,
        body: body as T,
      });
    }

    return responses;
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
    format: "full" | "minimal" | "raw" = "full"
  ): Promise<BatchResponse<Message>[]> => {
    const requests: BatchRequest[] = ids.map((id, index) => ({
      method: "GET",
      path: `/messages/${id}?format=${format}`,
      id: `msg-${index}`,
    }));

    const responses = await executeBatch<Message>(requests);

    // Validate each response body with Zod schema
    return responses.map((response) => {
      if (response.status === 200) {
        const result = MessageSchema.safeParse(response.body);
        if (result.success) {
          response.body = result.data;
        } else {
          console.error(`Failed to validate message response:`, result.error);
        }
      }
      return response;
    });
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
    format: "full" | "minimal" | "raw" = "full"
  ): Promise<BatchResponse<Thread>[]> => {
    const requests: BatchRequest[] = ids.map((id, index) => ({
      method: "GET",
      path: `/threads/${id}?format=${format}`,
      id: `thread-${index}`,
    }));

    const responses = await executeBatch<Thread>(requests);

    // Validate each response body with Zod schema
    return responses.map((response) => {
      if (response.status === 200) {
        const result = ThreadSchema.safeParse(response.body);
        if (result.success) {
          response.body = result.data;
        } else {
          console.error(`Failed to validate thread response:`, result.error);
        }
      }
      return response;
    });
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
    }>
  ): Promise<BatchResponse<Message>[]> => {
    const batchRequests: BatchRequest[] = requests.map((request, index) => ({
      method: "POST",
      path: `/messages/${request.id}/modify`,
      id: `modify-${index}`,
      body: {
        addLabelIds: request.addLabelIds || [],
        removeLabelIds: request.removeLabelIds || [],
      },
    }));

    const responses = await executeBatch<Message>(batchRequests);

    // Validate each response body with Zod schema
    return responses.map((response) => {
      if (response.status === 200) {
        const result = MessageSchema.safeParse(response.body);
        if (result.success) {
          response.body = result.data;
        } else {
          console.error(`Failed to validate message response:`, result.error);
        }
      }
      return response;
    });
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
  const batchTrashMessages = async (
    ids: string[]
  ): Promise<BatchResponse<Message>[]> => {
    const requests: BatchRequest[] = ids.map((id, index) => ({
      method: "POST",
      path: `/messages/${id}/trash`,
      id: `trash-${index}`,
    }));

    const responses = await executeBatch<Message>(requests);

    // Validate each response body with Zod schema
    return responses.map((response) => {
      if (response.status === 200) {
        const result = MessageSchema.safeParse(response.body);
        if (result.success) {
          response.body = result.data;
        } else {
          console.error(`Failed to validate message response:`, result.error);
        }
      }
      return response;
    });
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
  const batchUntrashMessages = async (
    ids: string[]
  ): Promise<BatchResponse<Message>[]> => {
    const requests: BatchRequest[] = ids.map((id, index) => ({
      method: "POST",
      path: `/messages/${id}/untrash`,
      id: `untrash-${index}`,
    }));

    const responses = await executeBatch<Message>(requests);

    // Validate each response body with Zod schema
    return responses.map((response) => {
      if (response.status === 200) {
        const result = MessageSchema.safeParse(response.body);
        if (result.success) {
          response.body = result.data;
        } else {
          console.error(`Failed to validate message response:`, result.error);
        }
      }
      return response;
    });
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
    } = {}
  ): Promise<MessageList> => {
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
    format: "full" | "minimal" | "raw" = "full"
  ): Promise<Message> => {
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
    } = {}
  ): Promise<ThreadList> => {
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
    format: "full" | "minimal" | "raw" = "full"
  ): Promise<Thread> => {
    return fetchGmailApi<Thread>(`/threads/${id}?format=${format}`);
  };

  /**
   * Get all labels
   */
  const getLabels = async (): Promise<LabelList> => {
    return fetchGmailApi<LabelList>(`/labels`);
  };

  /**
   * Get a label by ID
   */
  const getLabel = async (id: string): Promise<Label> => {
    return fetchGmailApi<Label>(`/labels/${id}`);
  };

  /**
   * Get drafts with pagination
   */
  const getDrafts = async (
    params: { maxResults?: number; pageToken?: string } = {}
  ): Promise<DraftList> => {
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
    format: "full" | "minimal" | "raw" = "full"
  ): Promise<Draft> => {
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
  }): Promise<HistoryList> => {
    const searchParams = new URLSearchParams();

    searchParams.append("startHistoryId", params.startHistoryId);
    if (params.labelId) searchParams.append("labelId", params.labelId);
    if (params.maxResults)
      searchParams.append("maxResults", params.maxResults.toString());
    if (params.pageToken) searchParams.append("pageToken", params.pageToken);
    if (params.historyTypes?.length) {
      params.historyTypes.forEach((type) =>
        searchParams.append("historyTypes", type)
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
    batchModifyMessages,
    batchTrashMessages,
    batchUntrashMessages,
  };
};

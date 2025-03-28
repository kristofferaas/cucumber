"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { Message, MessagePart } from "@/lib/gmail/schemas";

const EmailIframe = dynamic(
  () => import("./email-iframe").then((mod) => mod.EmailIframe),
  {
    ssr: false,
  }
);

// Function to decode base64url to text with proper UTF-8 handling
function decodeBase64Url(base64url: string): string {
  try {
    if (!base64url) return "";

    // Convert base64url to standard base64
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if needed
    const padding = base64.length % 4;
    const paddedBase64 = padding ? base64 + "=".repeat(4 - padding) : base64;

    // Decode base64 to binary
    const binaryString = atob(paddedBase64);

    // Convert binary to UTF-8
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Use TextDecoder for proper UTF-8 handling
    return new TextDecoder("utf-8").decode(bytes);
  } catch (error) {
    console.error("Failed to decode base64url:", error);
    return "";
  }
}

// Get header value from message part headers
function getPartHeader(part: MessagePart, name: string): string {
  const header = part.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || "";
}

// Parse Content-Type parameters (like boundary, charset, etc.)
function parseContentTypeParams(contentType: string): Record<string, string> {
  const params: Record<string, string> = {};

  if (!contentType) return params;

  // Split by semicolons and process each part
  const parts = contentType
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);

  // Process each parameter (skip the first part which is the mime type itself)
  for (let i = 1; i < parts.length; i++) {
    const param = parts[i];
    if (!param) continue;

    const equalsPos = param.indexOf("=");

    if (equalsPos > 0) {
      const name = param.substring(0, equalsPos).trim().toLowerCase();
      let value = param.substring(equalsPos + 1).trim();

      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      params[name] = value;
    }
  }

  return params;
}

// Extract Content-ID from headers, removing angle brackets if present
function extractContentId(part: MessagePart): string {
  const contentId =
    getPartHeader(part, "Content-ID") ||
    getPartHeader(part, "Content-Id") ||
    getPartHeader(part, "X-Attachment-Id");

  // Strip angle brackets if present (cid often has them)
  return contentId.replace(/^<|>$/g, "");
}

// Get MIME type of a part
function getPartMimeType(part: MessagePart): string {
  // Ensure we return a string even if mimeType is undefined
  return (
    part.mimeType ||
    getPartHeader(part, "Content-Type").split(";")[0] ||
    "application/octet-stream"
  );
}

// Gets the disposition of a part (inline or attachment)
function getContentDisposition(part: MessagePart): string {
  const disposition = getPartHeader(part, "Content-Disposition");
  if (!disposition) return "inline";

  // Split by semicolon and get first part, safely handle undefined
  const dispositionParts = disposition.split(";");
  const mainDisposition = dispositionParts[0]?.toLowerCase() || "inline";
  return mainDisposition;
}

// Extract filename from content disposition
function getFilename(part: MessagePart): string {
  // Try from Content-Disposition first
  const contentDisposition = getPartHeader(part, "Content-Disposition");
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (filenameMatch && filenameMatch[1]) {
    return filenameMatch[1];
  }

  // Fall back to Content-Type name parameter
  const contentType = getPartHeader(part, "Content-Type");
  const nameMatch = contentType.match(/name="?([^"]+)"?/i);
  if (nameMatch && nameMatch[1]) {
    return nameMatch[1];
  }

  // Use the part's filename property if available
  if (part.filename) {
    return part.filename;
  }

  return "";
}

export function FullMessage({ message }: { message: Message }) {
  const [activeView, setActiveView] = useState<"html" | "plain" | "raw">(
    "html"
  );

  // Add state to track processed HTML that can be updated when attachments load
  const [processedHtmlState, setProcessedHtmlState] = useState<string>("");
  const inlineAttachmentsRef = useRef<Map<string, string>>(new Map());

  // Log message structure to help debug
  console.log("Message payload:", message.payload);

  // Get headers
  const getHeader = (name: string): string => {
    const header = message.payload?.headers?.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    );
    return header?.value || "";
  };

  const subject = getHeader("subject");
  const from = getHeader("from");
  const to = getHeader("to");
  const date = new Date(parseInt(message.internalDate || "0")).toLocaleString();

  // Function to fetch an attachment by ID
  const fetchAttachment = async (
    attachmentId: string,
    messageId: string
  ): Promise<string> => {
    try {
      console.log(`Fetching attachment with ID: ${attachmentId}`);

      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("google_token") || ""}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch attachment: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.data || ""; // This is the base64 data
    } catch (error) {
      console.error("Error fetching attachment:", error);
      return "";
    }
  };

  // Find content and attachments according to MIME specifications
  const findContentAndAttachments = (): {
    html: string;
    plain: string;
    inlineAttachments: Map<string, string>;
    attachments: Array<{ filename: string; contentType: string; data: string }>;
  } => {
    let html = "";
    let plain = "";
    const inlineAttachments = new Map<string, string>();
    const attachments: Array<{
      filename: string;
      contentType: string;
      data: string;
    }> = [];

    // First pass: Find the structure of the email
    // This helps us understand if we need to handle multipart/related, multipart/alternative, etc.
    const determineStructure = (
      root?: MessagePart
    ): {
      hasRelated: boolean;
      hasAlternative: boolean;
      hasMixed: boolean;
    } => {
      let hasRelated = false;
      let hasAlternative = false;
      let hasMixed = false;

      if (!root) return { hasRelated, hasAlternative, hasMixed };

      if (root.mimeType === "multipart/related") {
        hasRelated = true;
      } else if (root.mimeType === "multipart/alternative") {
        hasAlternative = true;
      } else if (root.mimeType === "multipart/mixed") {
        hasMixed = true;
      }

      if (root.parts) {
        root.parts.forEach((part) => {
          const childStructure = determineStructure(part);
          hasRelated = hasRelated || childStructure.hasRelated;
          hasAlternative = hasAlternative || childStructure.hasAlternative;
          hasMixed = hasMixed || childStructure.hasMixed;
        });
      }

      return { hasRelated, hasAlternative, hasMixed };
    };

    const structure = determineStructure(message.payload);
    console.log("Email structure:", structure);

    // Process a multipart/related part according to RFC 2387
    const processRelatedPart = (part: MessagePart): void => {
      if (!part.parts || part.parts.length === 0) return;

      console.log("Processing multipart/related part");

      // Get the type parameter from Content-Type which indicates the root
      const contentTypeParams = parseContentTypeParams(
        getPartHeader(part, "Content-Type")
      );
      const rootType = contentTypeParams.type || "text/html";

      // First part is typically the HTML content to which other parts are related
      let rootPart = part.parts[0];

      // If specified by type parameter, find the correct root part
      if (rootType !== "text/html" && part.parts.length > 1) {
        const matchingPart = part.parts.find(
          (p) => getPartMimeType(p) === rootType
        );
        if (matchingPart) {
          rootPart = matchingPart;
        }
      }

      // Process the root part (usually HTML)
      if (rootPart?.mimeType === "text/html" && rootPart.body?.data) {
        html = decodeBase64Url(rootPart.body.data);
        console.log(`Found HTML in multipart/related (${html.length} chars)`);
      }

      // Process all other parts as inline attachments
      part.parts.forEach((subPart) => {
        if (subPart === rootPart) return; // Skip the root part

        const contentId = extractContentId(subPart);
        if (contentId && subPart.body?.data) {
          const contentType = getPartMimeType(subPart);
          // Don't modify the base64 data - keep it exactly as provided by Gmail API
          const data = subPart.body.data;
          inlineAttachments.set(
            contentId,
            `data:${contentType};base64,${data}`
          );
          console.log(
            `Found inline attachment in multipart/related: ${contentId} (${subPart.mimeType})`
          );
        }
      });
    };

    // Process a multipart/alternative part
    const processAlternativePart = (part: MessagePart): void => {
      if (!part.parts || part.parts.length === 0) return;

      console.log("Processing multipart/alternative part");

      // Try to find HTML and plain text parts
      // Process parts in reverse order because the preferred format typically comes last
      // (Plain text first, then HTML)
      for (let i = part.parts.length - 1; i >= 0; i--) {
        const subPart = part.parts[i];
        if (!subPart) continue;

        if (subPart.mimeType === "text/html" && subPart.body?.data && !html) {
          html = decodeBase64Url(subPart.body.data);
          console.log(`Found HTML in alternative (${html.length} chars)`);
        } else if (
          subPart.mimeType === "text/plain" &&
          subPart.body?.data &&
          !plain
        ) {
          plain = decodeBase64Url(subPart.body.data);
          console.log(
            `Found plain text in alternative (${plain.length} chars)`
          );
        } else if (subPart.mimeType.startsWith("multipart/")) {
          // Handle nested multipart structures
          processEmailPart(subPart);
        }
      }
    };

    // Process any part of the email recursively
    const processEmailPart = (part?: MessagePart): void => {
      if (!part) return;

      console.log(
        `Processing part: ${part.mimeType} (ID: ${part.partId || "none"})`
      );

      // Handle different multipart types according to their RFC specifications
      if (part.mimeType === "multipart/related") {
        processRelatedPart(part);
      } else if (part.mimeType === "multipart/alternative") {
        processAlternativePart(part);
      } else if (part.mimeType === "multipart/mixed" && part.parts) {
        // For mixed parts, process all sub-parts
        part.parts.forEach((subPart) => processEmailPart(subPart));
      } else if (part.mimeType === "text/html" && part.body?.data && !html) {
        // Handle standalone HTML part
        html = decodeBase64Url(part.body.data);
        console.log(`Found standalone HTML content (${html.length} chars)`);
      } else if (part.mimeType === "text/plain" && part.body?.data && !plain) {
        // Handle standalone plain text part
        plain = decodeBase64Url(part.body.data);
        console.log(
          `Found standalone plain text content (${plain.length} chars)`
        );
      } else if (part.body?.data) {
        // Handle attachments and inline content with direct data
        const contentId = extractContentId(part);
        const disposition = getContentDisposition(part);
        const contentType = getPartMimeType(part);
        // Don't modify the base64 data for inline images - leave as is from Gmail API
        const data =
          disposition === "inline" && contentId
            ? part.body.data
            : part.body.data.replace(/-/g, "+").replace(/_/g, "/");

        if (contentId && (disposition === "inline" || !disposition)) {
          // This is an inline attachment with Content-ID reference
          inlineAttachments.set(
            contentId,
            `data:${contentType};base64,${data}`
          );
          console.log(`Found inline attachment with data: ${contentId}`);
        } else if (disposition === "attachment" || part.filename) {
          // This is a regular attachment
          const filename = getFilename(part);
          if (filename) {
            attachments.push({
              filename,
              contentType,
              data: `data:${contentType};base64,${data}`,
            });
            console.log(`Found attachment with data: ${filename}`);
          }
        }
      } else if (part.body?.attachmentId) {
        // Handle attachments referenced by ID
        const contentId = extractContentId(part);
        const disposition = getContentDisposition(part);
        const contentType = getPartMimeType(part);
        const attachmentId = part.body.attachmentId;

        // For attachments with IDs, we need to track them for later fetching
        if (contentId && (disposition === "inline" || !disposition)) {
          // This is an inline attachment with Content-ID
          console.log(
            `Found inline attachment with ID: ${contentId} (${attachmentId})`
          );

          // We'll populate this with a placeholder first, then fetch the real data
          inlineAttachments.set(
            contentId,
            `data:${contentType};base64,placeholder_for_${attachmentId}`
          );

          // Immediately start fetching the attachment (will update the Map later)
          fetchAttachment(attachmentId, message.id).then((base64Data) => {
            if (base64Data) {
              // Update the map with the real data
              inlineAttachments.set(
                contentId,
                `data:${contentType};base64,${base64Data}`
              );
              console.log(`Updated inline attachment data for: ${contentId}`);

              // If we've already processed the HTML, we need to re-process it
              if (html) {
                const newProcessedHtml = replaceInlineAttachments(
                  html,
                  inlineAttachments
                );
                // We need a way to update the view - this requires state management
                window.dispatchEvent(
                  new CustomEvent("email-attachment-loaded", {
                    detail: { html: newProcessedHtml },
                  })
                );
              }
            }
          });
        } else if (disposition === "attachment" || part.filename) {
          // Regular attachment with ID
          const filename = getFilename(part);
          if (filename) {
            console.log(
              `Found attachment with ID: ${filename} (${attachmentId})`
            );

            // Add a placeholder attachment that will be updated
            attachments.push({
              filename,
              contentType,
              data: `data:${contentType};base64,placeholder_for_${attachmentId}`,
            });

            // Fetch the real data
            fetchAttachment(attachmentId, message.id).then((base64Data) => {
              if (base64Data) {
                // Find the attachment and update its data
                const attachment = attachments.find(
                  (a) =>
                    a.filename === filename &&
                    a.data.includes(`placeholder_for_${attachmentId}`)
                );

                if (attachment) {
                  attachment.data = `data:${contentType};base64,${base64Data}`;
                  console.log(`Updated attachment data for: ${filename}`);

                  // Notify about the update
                  window.dispatchEvent(
                    new CustomEvent("email-attachment-loaded")
                  );
                }
              }
            });
          }
        }
      }

      // Process nested parts in case they weren't handled above
      if (
        part.parts &&
        part.parts.length > 0 &&
        !part.mimeType.startsWith("multipart/")
      ) {
        part.parts.forEach((subPart) => processEmailPart(subPart));
      }
    };

    // Start processing from the root
    processEmailPart(message.payload);

    // Log findings
    console.log(`Found HTML content: ${html ? "yes" : "no"}`);
    console.log(`Found plain text content: ${plain ? "yes" : "no"}`);
    console.log(`Found ${inlineAttachments.size} inline attachments`);
    console.log(`Found ${attachments.length} regular attachments`);

    return { html, plain, inlineAttachments, attachments };
  };

  const { html, plain, inlineAttachments, attachments } =
    findContentAndAttachments();

  // Store the inlineAttachments in a ref for access in effects
  inlineAttachmentsRef.current = inlineAttachments;

  // Process HTML to replace cid: references with actual data URIs
  const processedHtml = html
    ? replaceInlineAttachments(html, inlineAttachments)
    : "";

  // Set the initial processed HTML state
  useEffect(() => {
    setProcessedHtmlState(processedHtml);
  }, [processedHtml]);

  // Function to replace cid: references with actual data URIs
  function replaceInlineAttachments(
    htmlContent: string,
    attachments: Map<string, string>
  ): string {
    if (attachments.size === 0) return htmlContent;

    let processedContent = htmlContent;

    console.log(
      "Available Content-IDs for replacement:",
      Array.from(attachments.keys())
    );

    // Check if there are any cid: references in the HTML
    const cidRefsInHtml = Array.from(
      processedContent.matchAll(/cid:([^"\s'<>]+)/gi)
    );
    if (cidRefsInHtml.length > 0) {
      console.log(
        "CID references found in HTML:",
        cidRefsInHtml.map((match) => match[1])
      );
    } else {
      console.log("No cid: references found in HTML");
    }

    // First, directly replace all cid:something references with data URIs
    // Loop through all attachments and perform replacements
    attachments.forEach((dataUri, cid) => {
      console.log(`Processing replacement for Content-ID: ${cid}`);

      try {
        // Try to normalize domain part if present
        const atIndex = cid.indexOf("@");
        const cidWithoutDomain = atIndex > 0 ? cid.substring(0, atIndex) : cid;

        // First, try direct replacement with a global regex for all possible formats
        // This more aggressively matches any cid: references
        let anyReplaced = false;

        // First pattern handles the most common case: src="cid:something"
        processedContent = processedContent.replace(
          new RegExp(
            `(src|background)=(["']?)cid:${escapeRegExp(cid)}\\2`,
            "gi"
          ),
          (match, attr, quote) => {
            anyReplaced = true;
            return `${attr}=${quote}${dataUri}${quote}`;
          }
        );

        // Check for partial CID (without domain) if the full one wasn't found
        if (!anyReplaced && atIndex > 0) {
          processedContent = processedContent.replace(
            new RegExp(
              `(src|background)=(["']?)cid:${escapeRegExp(cidWithoutDomain)}\\2`,
              "gi"
            ),
            (match, attr, quote) => {
              anyReplaced = true;
              return `${attr}=${quote}${dataUri}${quote}`;
            }
          );
        }

        // URL-encoded versions
        const encodedCid = encodeURIComponent(`cid:${cid}`);
        processedContent = processedContent.replace(
          new RegExp(escapeRegExp(encodedCid), "gi"),
          dataUri
        );

        // Style-based image references
        processedContent = processedContent.replace(
          new RegExp(`url\\((['"]?)cid:${escapeRegExp(cid)}\\1\\)`, "gi"),
          `url(${dataUri})`
        );

        // Without domain part for style-based references
        if (atIndex > 0) {
          processedContent = processedContent.replace(
            new RegExp(
              `url\\((['"]?)cid:${escapeRegExp(cidWithoutDomain)}\\1\\)`,
              "gi"
            ),
            `url(${dataUri})`
          );
        }

        if (anyReplaced) {
          console.log(`Successfully replaced references for CID: ${cid}`);
        } else {
          console.log(`No references found for CID: ${cid}`);
        }
      } catch (error) {
        console.error(`Error replacing CID references for ${cid}:`, error);
      }
    });

    return processedContent;
  }

  // Helper function to escape special regex characters
  function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Add debugging for image sources
  function debugImageSources(html: string) {
    const imgRegex = /<img[^>]+src=(['"]?)([^'">\s]+)\1[^>]*>/gi;
    let match;
    const sources: string[] = [];

    while ((match = imgRegex.exec(html)) !== null) {
      if (match[2]) {
        sources.push(match[2]);
      }
    }

    if (sources.length > 0) {
      console.log("Image sources found in HTML:", sources);

      // Check if any sources still have cid: in them
      const unreplacedCids = sources.filter(
        (src) => src && src.startsWith("cid:")
      );
      if (unreplacedCids.length > 0) {
        console.warn("Unreplaced CID references:", unreplacedCids);
      }
    } else {
      console.log("No image sources found in HTML");
    }
  }

  // Log any updates to processedHtmlState for debugging
  useEffect(() => {
    if (processedHtmlState) {
      debugImageSources(processedHtmlState);
    }
  }, [processedHtmlState]);

  // Auto-select plain text view if HTML is not available
  useEffect(() => {
    if (!processedHtmlState && plain) {
      setActiveView("plain");
    }
  }, [processedHtmlState, plain]);

  // Add an effect to listen for attachment load events
  useEffect(() => {
    const handleAttachmentLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.html) {
        // Update the processed HTML with the new version that includes fetched attachments
        setProcessedHtmlState(customEvent.detail.html);
        console.log("Updated HTML with loaded attachments");
      } else {
        // If no HTML is provided, we still need to re-process it with the updated attachments
        if (html) {
          const updatedHtml = replaceInlineAttachments(
            html,
            inlineAttachmentsRef.current
          );
          setProcessedHtmlState(updatedHtml);
          console.log("Re-processed HTML with updated attachments");
        }
      }
    };

    window.addEventListener("email-attachment-loaded", handleAttachmentLoaded);

    return () => {
      window.removeEventListener(
        "email-attachment-loaded",
        handleAttachmentLoaded
      );
    };
  }, [html]);

  return (
    <div className="space-y-4">
      {/* Email header section */}
      <div className="space-y-2 pb-4 border-b">
        <h1 className="text-2xl font-semibold">{subject}</h1>
        <div className="grid gap-1 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">From:</span> {from}
          </div>
          <div>
            <span className="font-medium text-foreground">To:</span> {to}
          </div>
          <div>
            <span className="font-medium text-foreground">Date:</span> {date}
          </div>
        </div>
      </div>

      {/* Debug info */}
      <div className="text-xs text-muted-foreground">
        <div>
          Content found: {html ? "HTML" : ""} {plain ? "Plain" : ""}
        </div>
        <div>
          Inline attachments: {inlineAttachments.size}, Regular attachments:{" "}
          {attachments.length}
        </div>
      </div>

      {/* View selector */}
      <div className="flex space-x-2 pt-2">
        <button
          className={`px-3 py-1 text-sm rounded-md ${
            activeView === "html"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary hover:bg-secondary/80"
          }`}
          onClick={() => setActiveView("html")}
          disabled={!processedHtmlState}
        >
          HTML
        </button>
        <button
          className={`px-3 py-1 text-sm rounded-md ${
            activeView === "plain"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary hover:bg-secondary/80"
          }`}
          onClick={() => setActiveView("plain")}
          disabled={!plain}
        >
          Plain Text
        </button>
        <button
          className={`px-3 py-1 text-sm rounded-md ${
            activeView === "raw"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary hover:bg-secondary/80"
          }`}
          onClick={() => setActiveView("raw")}
        >
          Raw Data
        </button>
      </div>

      {/* Email content */}
      <div className="pt-4">
        {activeView === "html" && processedHtmlState ? (
          <EmailIframe html={processedHtmlState} />
        ) : activeView === "plain" && plain ? (
          <div className="p-4 bg-muted rounded-md whitespace-pre-wrap font-mono text-sm">
            {plain}
          </div>
        ) : (
          <div className="p-4 bg-muted rounded-md overflow-auto max-h-[600px]">
            <code>
              <pre className="text-xs">{JSON.stringify(message, null, 2)}</pre>
            </code>
          </div>
        )}
      </div>

      {/* Attachments section */}
      {attachments.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium mb-2">
            Attachments ({attachments.length})
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {attachments.map((attachment, index) => (
              <div key={index} className="border rounded p-2 text-center">
                <a
                  href={attachment.data}
                  download={attachment.filename}
                  className="text-sm hover:underline"
                >
                  {attachment.filename}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-render check for the HTML content */}
      {activeView === "html" && processedHtmlState && (
        <div className="text-xs text-muted-foreground mb-2">
          HTML content length: {processedHtmlState.length} chars
          {processedHtmlState.includes("data:image")
            ? " (contains embedded images)"
            : " (no embedded images found)"}
          {processedHtmlState.includes("placeholder_for_")
            ? " (still loading some attachments...)"
            : ""}
        </div>
      )}
    </div>
  );
}

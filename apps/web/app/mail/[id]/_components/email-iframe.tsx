"use client";

import DOMPurify from "dompurify";
import { useEffect, useRef, useState } from "react";

// Email HTML iframe renderer component
export function EmailIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(400);

  useEffect(() => {
    if (!iframeRef.current || !html) return;

    // Create a safe HTML document with styles
    const sanitizedHtml = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ALLOWED_TAGS: [
        // Basic structure
        "html",
        "head",
        "body",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "div",
        "span",
        "br",
        "hr",
        "strong",
        "em",
        "i",
        "b",
        "u",
        "sub",
        "sup",
        // Lists
        "ul",
        "ol",
        "li",
        "dl",
        "dt",
        "dd",
        // Tables
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        // Links and images
        "a",
        "img",
        // Text formatting
        "blockquote",
        "pre",
        "code",
        // Style related
        "style",
      ],
      ALLOWED_ATTR: [
        "href",
        "src",
        "alt",
        "title",
        "style",
        "class",
        "width",
        "height",
        "align",
        "valign",
        "border",
        "cellpadding",
        "cellspacing",
        "bgcolor",
        "color",
        "colspan",
        "rowspan",
      ],
      FORBID_TAGS: ["script", "iframe", "object", "embed"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
      ADD_ATTR: ["target"],
      FORCE_BODY: true,
      SANITIZE_DOM: true,
      WHOLE_DOCUMENT: true,
    });

    // Convert any remaining cid: URLs directly in the HTML
    const processedHtml = sanitizedHtml.replace(
      /src=(['"]?)cid:([^'">\s]+)(['"]?)/gi,
      (match, prefix, cid, suffix) => {
        console.log(`Found unprocessed CID URL in iframe HTML: ${cid}`);
        // Since this CID wasn't replaced earlier, we can't do anything with it here
        // Block it by using a transparent 1x1 pixel instead
        return `src=${prefix}data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7${suffix} data-original-cid="${cid}"`;
      }
    );

    // Full document with CSS and sanitized content
    const documentContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <base target="_blank">
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 16px;
              color: #333;
              line-height: 1.5;
              max-width: 100%;
              overflow-wrap: break-word;
              word-wrap: break-word;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            img[data-original-cid] {
              border: 1px dashed #ccc;
              background-color: #f5f5f5;
              padding: 8px;
              display: inline-block;
              position: relative;
            }
            img[data-original-cid]:after {
              content: "Missing image: " attr(data-original-cid);
              display: block;
              font-size: 10px;
              color: #999;
            }
            a {
              color: #0070f3;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            table {
              border-collapse: collapse;
              max-width: 100%;
            }
            table, th, td {
              border: inherit;
            }
          </style>
        </head>
        <body>${processedHtml}</body>
      </html>
    `;

    // Write content to iframe
    const iframeDocument = iframeRef.current.contentWindow?.document;
    if (iframeDocument) {
      iframeDocument.open();
      iframeDocument.write(documentContent);
      iframeDocument.close();

      // Fix any remaining CID references that might be in style attributes
      const elementsWithStyle =
        iframeDocument.querySelectorAll("[style*='cid:']");
      elementsWithStyle.forEach((el) => {
        if (el.getAttribute("style")?.includes("cid:")) {
          console.log(
            "Found element with cid: in style attribute:",
            el.getAttribute("style")
          );
          const newStyle = el
            .getAttribute("style")
            ?.replace(
              /url\(['"]?cid:([^'"]+)['"]?\)/gi,
              "url('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')"
            );
          el.setAttribute("style", newStyle || "");
        }
      });

      // Adjust iframe height to content after a slight delay
      const adjustHeight = () => {
        const body = iframeDocument.body;
        const html = iframeDocument.documentElement;

        if (body && html) {
          const height =
            Math.max(
              body.scrollHeight,
              body.offsetHeight,
              html.clientHeight,
              html.scrollHeight,
              html.offsetHeight
            ) + 32; // Add some padding
          setIframeHeight(height);
        }
      };

      // Add a resize observer to handle dynamic content
      if ("ResizeObserver" in window) {
        const resizeObserver = new ResizeObserver(adjustHeight);
        resizeObserver.observe(iframeDocument.body);

        return () => {
          resizeObserver.disconnect();
        };
      } else {
        // Fallback for browsers without ResizeObserver
        setTimeout(adjustHeight, 100);
        // Add event listeners for images loading
        const images = iframeDocument.querySelectorAll("img");
        images.forEach((img) => {
          img.addEventListener("load", adjustHeight);
          img.addEventListener("error", (e) => {
            console.log("Image failed to load:", img.src);
            adjustHeight();
          });
        });
      }
    }
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="Email content"
      sandbox="allow-same-origin allow-scripts"
      className="w-full border-0 bg-card rounded-md"
      style={{ height: `${iframeHeight}px` }}
    />
  );
}

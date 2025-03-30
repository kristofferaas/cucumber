import type { MessagePart } from "@/lib/gmail/schemas";
import { getMimeType } from "./get-mime-type";
import { getContentDetails } from "./parse-headers";
import { decodeData } from "./decode-data";

type ProcessedPart = {
  id: string;
  contentType: "text/plain" | "text/html" | "image/png";
  data: string;
};

export function processMessagePart(payload: MessagePart): ProcessedPart[] {
  const mimeType = getMimeType(payload);

  switch (mimeType) {
    case "multipart/alternative": {
      return processMultipartAlternative(payload);
    }
    case "multipart/related": {
      return processMultipartRelated(payload);
    }
    case "text/plain": {
      return [processTextPlain(payload)];
    }
    case "text/html": {
      return [processTextHtml(payload)];
    }
    case "image/png": {
      return [processImagePng(payload)];
    }
    default: {
      throw new Error(`Unsupported mime type: ${mimeType}`);
    }
  }
}

function processMultipartAlternative(payload: MessagePart): ProcessedPart[] {
  const { parts } = payload;

  if (!parts) {
    throw new Error("No parts found in multipart/alternative");
  }

  const processedParts: ProcessedPart[] = [];

  for (const part of parts) {
    const partId = part.partId;
    if (!partId) {
      throw new Error("No partId found in multipart/alternative");
    }
    const data = processMessagePart(part);
    processedParts.push(...data);
  }

  return processedParts;
}

function processTextPlain(payload: MessagePart): ProcessedPart {
  const { mimeType, body, headers, partId } = payload;

  if (typeof partId !== "string") {
    throw new Error("No partId found in text/plain");
  }

  if (mimeType !== "text/plain") {
    throw new Error("Mime type is not text/plain");
  }

  const { charset, encoding } = getContentDetails(headers);
  const data = body?.data;

  if (!data) {
    throw new Error("No body found in text/plain");
  }

  const decodedData = decodeData(data, encoding);

  return {
    id: partId,
    contentType: "text/plain",
    data: decodedData,
  };
}

function processMultipartRelated(payload: MessagePart) {
  const { parts, mimeType } = payload;

  if (mimeType !== "multipart/related") {
    throw new Error("Mime type is not multipart/related");
  }

  const contentType =
    payload.headers?.find((header) => header.name === "Content-Type")?.value ||
    "";

  const contentParts = contentType.split(";").map((part) => part.trim());
  const mime = contentParts[0];

  if (mime !== "multipart/related") {
    throw new Error(
      "Mime type is not multipart/related in Content-Type header"
    );
  }

  // let boundary = "";
  // let type = "";

  // // Parse boundary and type from remaining parts
  // contentParts.slice(1).forEach((part) => {
  //   if (part.startsWith("boundary=")) {
  //     boundary = part.replace(/^boundary=["']?([^"']*)["']?$/, "$1");
  //   } else if (part.startsWith("type=")) {
  //     type = part.replace(/^type=["']?([^"']*)["']?$/, "$1");
  //   }
  // });

  // if (!boundary) {
  //   throw new Error("No boundary found in Content-Type header");
  // }

  // if (!type) {
  //   throw new Error("No type found in Content-Type header");
  // }

  if (!parts) {
    throw new Error("No parts found in multipart/related");
  }

  const processedParts: ProcessedPart[] = [];

  for (const part of parts) {
    processedParts.push(...processMessagePart(part));
  }

  return processedParts;
}

function processTextHtml(payload: MessagePart): ProcessedPart {
  const { mimeType, body, headers, partId } = payload;

  if (typeof partId !== "string") {
    throw new Error("No partId found in text/html");
  }

  if (mimeType !== "text/html") {
    throw new Error("Mime type is not text/html");
  }

  const { charset, encoding } = getContentDetails(headers);
  const data = body?.data;

  if (!data) {
    throw new Error("No body found in text/html");
  }

  const decodedData = decodeData(data, encoding);

  return {
    id: partId,
    contentType: "text/html",
    data: decodedData,
  };
}

function processImagePng(payload: MessagePart): ProcessedPart {
  const { mimeType, body, headers, partId } = payload;

  if (!partId) {
    throw new Error("No partId found in image/png");
  }

  if (mimeType !== "image/png") {
    throw new Error("Mime type is not image/png");
  }

  const attachmentId = body?.attachmentId;

  if (!attachmentId) {
    throw new Error("No attachmentId found in image/png");
  }

  const cid =
    headers?.find((header) => header.name === "Content-ID")?.value ?? "";
  // remove < and >
  const cidWithoutTags = cid.replace(/[<>]/g, "");

  return {
    id: cidWithoutTags,
    contentType: "image/png",
    data: attachmentId,
  };
}

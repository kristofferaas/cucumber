import type { MessagePart } from "@/lib/gmail/schemas";
import { getMimeType } from "./get-mime-type";
import { getContentDetails } from "./parse-headers";
import { decodeData } from "./decode-data";
import { Err, err, Ok, ok } from "@/lib/try-catch";

type ProcessedPart = {
  id: string;
  contentType: "text/plain" | "text/html" | "image/png";
  data: string;
};

export function processMessagePart(
  payload: MessagePart
): Ok<ProcessedPart[]> | Err<Error> {
  const [mimeType, mimeTypeError] = getMimeType(payload);
  if (mimeTypeError) {
    return err(mimeTypeError);
  }

  switch (mimeType) {
    case "multipart/alternative": {
      return processMultipartAlternative(payload);
    }
    case "multipart/related": {
      return processMultipartRelated(payload);
    }
    case "text/plain": {
      const [data, error] = processTextPlain(payload);
      if (error) {
        return err(error);
      }
      return ok([data]);
    }
    case "text/html": {
      const [data, error] = processTextHtml(payload);
      if (error) {
        return err(error);
      }
      return ok([data]);
    }
    case "image/png": {
      const [data, error] = processImagePng(payload);
      if (error) {
        return err(error);
      }
      return ok([data]);
    }
    default: {
      return err(new Error(`Unsupported mime type: ${mimeType}`));
    }
  }
}

function processMultipartAlternative(
  payload: MessagePart
): Ok<ProcessedPart[]> | Err<Error> {
  const { parts } = payload;

  if (!parts) {
    return err(new Error("No parts found in multipart/alternative"));
  }

  const processedParts: ProcessedPart[] = [];

  for (const part of parts) {
    const partId = part.partId;
    if (!partId) {
      return err(new Error("No partId found in multipart/alternative"));
    }
    const [data, error] = processMessagePart(part);
    if (error) {
      return err(error);
    }
    processedParts.push(...data);
  }

  return ok(processedParts);
}

function processTextPlain(
  payload: MessagePart
): Ok<ProcessedPart> | Err<Error> {
  const { mimeType, body, headers, partId } = payload;

  if (typeof partId !== "string") {
    return err(new Error("No partId found in text/plain"));
  }

  if (mimeType !== "text/plain") {
    return err(new Error("Mime type is not text/plain"));
  }

  const [contentDetails, contentDetailsError] = getContentDetails(headers);
  if (contentDetailsError) {
    return err(contentDetailsError);
  }

  const data = body?.data;

  if (!data) {
    return err(new Error("No body found in text/plain"));
  }

  const [decodedData, decodeError] = decodeData(data, contentDetails.encoding);

  if (decodeError) {
    return err(decodeError);
  }

  return ok({
    id: partId,
    contentType: "text/plain",
    data: decodedData,
  });
}

function processMultipartRelated(
  payload: MessagePart
): Ok<ProcessedPart[]> | Err<Error> {
  const { parts, mimeType } = payload;

  if (mimeType !== "multipart/related") {
    return err(new Error("Mime type is not multipart/related"));
  }

  const contentType =
    payload.headers?.find((header) => header.name === "Content-Type")?.value ||
    "";

  const contentParts = contentType.split(";").map((part) => part.trim());
  const mime = contentParts[0];

  if (mime !== "multipart/related") {
    return err(
      new Error("Mime type is not multipart/related in Content-Type header")
    );
  }

  if (!parts) {
    return err(new Error("No parts found in multipart/related"));
  }

  const processedParts: ProcessedPart[] = [];

  for (const part of parts) {
    const [data, error] = processMessagePart(part);
    if (error) {
      return err(error);
    }
    processedParts.push(...data);
  }

  return ok(processedParts);
}

function processTextHtml(payload: MessagePart): Ok<ProcessedPart> | Err<Error> {
  const { mimeType, body, headers, partId } = payload;

  if (typeof partId !== "string") {
    return err(new Error("No partId found in text/html"));
  }

  if (mimeType !== "text/html") {
    return err(new Error("Mime type is not text/html"));
  }

  const [contentDetails, contentDetailsError] = getContentDetails(headers);
  if (contentDetailsError) {
    return err(contentDetailsError);
  }

  const data = body?.data;
  if (!data) {
    return err(new Error("No body found in text/html"));
  }

  const [decodedData, decodeError] = decodeData(data, contentDetails.encoding);

  if (decodeError) {
    return err(decodeError);
  }

  return ok({
    id: partId,
    contentType: "text/html",
    data: decodedData,
  });
}

function processImagePng(payload: MessagePart): Ok<ProcessedPart> | Err<Error> {
  const { mimeType, body, headers, partId } = payload;

  if (!partId) {
    return err(new Error("No partId found in image/png"));
  }

  if (mimeType !== "image/png") {
    return err(new Error("Mime type is not image/png"));
  }

  const attachmentId = body?.attachmentId;

  if (!attachmentId) {
    return err(new Error("No attachmentId found in image/png"));
  }

  const cid =
    headers?.find((header) => header.name === "Content-ID")?.value ?? "";
  // remove < and >
  const cidWithoutTags = cid.replace(/[<>]/g, "");

  return ok({
    id: cidWithoutTags,
    contentType: "image/png",
    data: attachmentId,
  });
}

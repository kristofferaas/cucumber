import { Encoding } from "./parse-headers";

// Decodes data based on the specified encoding
export function decodeData(data: string, encoding: Encoding): string {
  switch (encoding) {
    case "base64": {
      return decodeBase64(data);
    }
    case "quoted-printable": {
      return decodeBase64Url(data);
    }
    case "8bit": {
      return decodeBase64Url(data);
    }
    default: {
      throw new Error(`Unsupported encoding: ${encoding}`);
    }
  }
}

// Decode a base64 encoded string
function decodeBase64(data: string): string {
  return Buffer.from(data, "base64").toString();
}

// Decode a base64 encoded URL
function decodeBase64Url(base64Url: string): string {
  // Convert URL-safe base64 to standard base64
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  const padding = base64.length % 4;
  const paddedBase64 = padding ? base64 + "=".repeat(4 - padding) : base64;

  // Decode the base64 string
  return Buffer.from(paddedBase64, "base64").toString();
}

import { err, ok } from "@/lib/try-catch";
import { type Encoding } from "./parse-headers";

// Decodes data based on the specified encoding
export function decodeData(data: string, encoding: Encoding) {
  switch (encoding) {
    case "base64": {
      const [result, error] = decodeBase64(data);
      if (error) {
        return err(error);
      }
      return ok(result);
    }
    case "quoted-printable": {
      const [result, error] = decodeBase64Url(data);
      if (error) {
        return err(error);
      }
      return ok(result);
    }
    case "8bit": {
      const [result, error] = decodeBase64Url(data);
      if (error) {
        return err(error);
      }
      return ok(result);
    }
    case "7bit": {
      const [result, error] = decodeBase64Url(data);
      if (error) {
        return err(error);
      }
      return ok(result);
    }
    default: {
      return err(new Error(`Unsupported encoding`));
    }
  }
}

// Decode a base64 encoded string
function decodeBase64(data: string) {
  try {
    return ok(Buffer.from(data, "base64").toString());
  } catch (error) {
    if (error instanceof Error) {
      return err(error);
    }
    return err(new Error("Failed to decode base64"));
  }
}

// Decode a base64 encoded URL
function decodeBase64Url(base64Url: string) {
  try {
    // Convert URL-safe base64 to standard base64
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if needed
    const padding = base64.length % 4;
    const paddedBase64 = padding ? base64 + "=".repeat(4 - padding) : base64;

    // Decode the base64 string
    return ok(Buffer.from(paddedBase64, "base64").toString());
  } catch (error) {
    if (error instanceof Error) {
      return err(error);
    }
    return err(new Error("Failed to decode base64"));
  }
}

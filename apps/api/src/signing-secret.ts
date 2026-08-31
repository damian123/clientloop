interface SigningSecretOptions {
  environmentVariable: string;
  configured: string | undefined;
  localFallback: string;
}

export function resolveSigningSecret(options: SigningSecretOptions): string {
  const { configured, environmentVariable, localFallback } = options;
  const isPlaceholder = configured?.toLowerCase().startsWith("replace-") ?? false;

  if (configured && !isPlaceholder) {
    if (process.env.NODE_ENV === "production" && Buffer.byteLength(configured, "utf8") < 32) {
      throw new Error(`${environmentVariable} must contain at least 32 bytes in production`);
    }
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${environmentVariable} must be configured with a non-placeholder value in production`
    );
  }

  return localFallback;
}

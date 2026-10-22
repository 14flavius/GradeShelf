// Enforce limits on bytes actually received, including requests without Content-Length.
// null means too large; stream failures propagate to the route's error handler.
export async function readRequestBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) {
    return Buffer.alloc(0);
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

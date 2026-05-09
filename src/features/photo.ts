// Capture the WebGL canvas (camera feed + AR pokemon) to a PNG and
// trigger a browser download. Requires the canvas's WebGL context to
// have been created with { preserveDrawingBuffer: true } (see xr.ts).

const FORMAT = "image/png";
const EXTENSION = "png";

export async function capturePhoto(
  canvas: HTMLCanvasElement,
  spawn: Spawn,
): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, FORMAT),
  );
  if (!blob) throw new Error("capture-failed");

  const filename = buildFilename(spawn);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so Safari doesn't bail mid-download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildFilename(spawn: Spawn): string {
  const dex = String(spawn.dex).padStart(3, "0");
  const safeName = spawn.name.replace(/[^A-Za-z0-9-]+/g, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeName}-${dex}-${stamp}.${EXTENSION}`;
}

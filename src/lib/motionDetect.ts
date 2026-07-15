// Pose-tracking heatmap Phase 2: auto-detect where play is happening instead
// of requiring a manual tap every time. Deliberately NOT full ML pose
// estimation (no TensorFlow.js/MoveNet) — that's a multi-MB dependency with
// unproven real-time performance on the low-end Android hardware this needs
// to run on, which is exactly the open question Phase 2 had to answer. This
// uses frame-differencing (cheap Canvas 2D pixel diff, no ML) to find the
// biggest blob of motion each tick and treats its centroid as the play
// position — good enough for a heatmap, not a skeleton. Runtime self-throttles
// (see ClipRecorder's SLOW_MS check) instead of needing to know the device's
// specs ahead of time, and if it's ever too slow, tracking just falls back to
// Phase 1's manual tap. Video/full ML pose estimation is a possible Phase 3
// if this centroid approach proves too imprecise — not built speculatively.

// Mirrors CSS `object-fit: cover`: returns the source rectangle (in the
// video's native pixel space) that ends up visible in the rendered box, so a
// canvas frame draw lines up with manual-tap coordinates (which are captured
// relative to the rendered, cropped box).
export function computeCoverCrop(videoW: number, videoH: number, containerW: number, containerH: number) {
  if (!videoW || !videoH || !containerW || !containerH) {
    return { sx: 0, sy: 0, sw: videoW, sh: videoH };
  }
  const sourceAspect = videoW / videoH;
  const containerAspect = containerW / containerH;
  if (sourceAspect > containerAspect) {
    const sw = videoH * containerAspect;
    return { sx: (videoW - sw) / 2, sy: 0, sw, sh: videoH };
  }
  const sh = videoW / containerAspect;
  return { sx: 0, sy: (videoH - sh) / 2, sw: videoW, sh };
}

export function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return gray;
}

// Compares two same-size grayscale frames and returns the normalized [0,1]
// centroid of pixels that changed enough to count as motion, or null if
// there wasn't enough motion to be meaningful (still court, or two identical
// frames sampled too close together).
export function motionCentroid(
  prevGray: Uint8ClampedArray, currGray: Uint8ClampedArray, width: number, height: number,
  pixelThreshold = 30, minDiffPixels = 40,
): { x: number; y: number } | null {
  let sumX = 0, sumY = 0, count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (Math.abs(currGray[idx] - prevGray[idx]) > pixelThreshold) {
        sumX += x; sumY += y; count++;
      }
    }
  }
  if (count < minDiffPixels) return null;
  return { x: (sumX / count + 0.5) / width, y: (sumY / count + 0.5) / height };
}

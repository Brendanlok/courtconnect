// Pose-tracking heatmap Phase 1: turns a camera's perspective view of the
// court into accurate normalized court positions, via a one-time 4-corner
// calibration. Pure math only — no UI.

import type { CourtPosition } from '@/types';

export type PixelPoint = [number, number];

// CourtHeatmap.tsx renders pos.x scaled against the court's LONG axis
// (baseline-to-baseline, 13.4m) and pos.y against the SHORT axis
// (sideline-to-sideline, 6.1m) — confirmed from its W=320/H=146 SVG and how
// NET_X (a single x value) draws the net as a line spanning full y. A camera
// naturally sees near/far along its own view axis, so here: x:0 = the
// baseline nearest the camera, x:1 = the far baseline; y:0 = camera-left,
// y:1 = camera-right (looking down the court away from the lens).
export const CALIBRATION_CORNER_ORDER = ['nearLeft', 'nearRight', 'farRight', 'farLeft'] as const;

const CALIBRATION_COURT_CORNERS: CourtPosition[] = [
  { x: 0, y: 0 }, // nearLeft
  { x: 0, y: 1 }, // nearRight
  { x: 1, y: 1 }, // farRight
  { x: 1, y: 0 }, // farLeft
];

export type Homography = [number, number, number, number, number, number, number, number, number];

// Solve an 8x8 linear system via Gaussian elimination with partial pivoting.
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    if (Math.abs(M[col][col]) < 1e-12) {
      throw new Error('Singular matrix — corner points are degenerate (collinear or duplicated).');
    }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// srcPoints: 4 camera-pixel corners, in CALIBRATION_CORNER_ORDER.
// dstPoints: the 4 corresponding normalized court corners (defaults to the
// standard court rectangle if omitted).
// Returns a flattened 3x3 homography (h33 = 1) mapping camera-pixel -> court.
export function computeHomography(srcPoints: PixelPoint[], dstPoints: CourtPosition[] = CALIBRATION_COURT_CORNERS): Homography {
  if (srcPoints.length !== 4 || dstPoints.length !== 4) {
    throw new Error('computeHomography needs exactly 4 point correspondences.');
  }
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = srcPoints[i];
    const { x: X, y: Y } = dstPoints[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const [h11, h12, h13, h21, h22, h23, h31, h32] = solveLinearSystem(A, b);
  return [h11, h12, h13, h21, h22, h23, h31, h32, 1];
}

// Maps a single camera-pixel point to a normalized court position. Not
// clamped to [0,1] — a tap just outside the court is still meaningful data;
// clamp at the call site if the consumer needs it (e.g. before rendering).
export function applyHomography(H: Homography, [x, y]: PixelPoint): CourtPosition {
  const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = H;
  const w = h31 * x + h32 * y + h33;
  return { x: (h11 * x + h12 * y + h13) / w, y: (h21 * x + h22 * y + h23) / w };
}

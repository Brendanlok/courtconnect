// Offline proof the Phase 1 homography math is correct.
// Run with: npx tsx src/lib/courtCalibration.selfcheck.ts
import assert from 'node:assert';
import { computeHomography, applyHomography, type PixelPoint } from './courtCalibration';
import type { CourtPosition } from '@/types';

// 0. The DEFAULT court corners (what the real calibration UI will use — no
// dstPoints passed) must match how CourtHeatmap.tsx actually renders
// CourtPosition: x scales against the court's LONG axis (W=320, net drawn as
// a single x spanning full y) and y against the SHORT axis (H=146, singles
// sidelines drawn as horizontal lines at fixed y). A near/far camera corner
// order must land x near 0 (near) and 1 (far) — not on the y axis.
{
  const nearLeft: PixelPoint = [40, 300];
  const nearRight: PixelPoint = [560, 300];
  const farRight: PixelPoint = [380, 60];
  const farLeft: PixelPoint = [220, 60];
  const H = computeHomography([nearLeft, nearRight, farRight, farLeft]); // dstPoints defaults
  const near = applyHomography(H, [(nearLeft[0] + nearRight[0]) / 2, nearLeft[1]]);
  const far = applyHomography(H, [(farLeft[0] + farRight[0]) / 2, farLeft[1]]);
  assert(near.x < 0.1, `near-baseline midpoint should land at x≈0, got x=${near.x.toFixed(3)}`);
  assert(far.x > 0.9, `far-baseline midpoint should land at x≈1, got x=${far.x.toFixed(3)}`);
}
console.log('PASS default corner order matches CourtHeatmap\'s x=length / y=width convention');

function close(a: CourtPosition, b: CourtPosition, tol: number) {
  assert(Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol,
    `expected [${a.x.toFixed(4)}, ${a.y.toFixed(4)}] within ${tol} of [${b.x}, ${b.y}]`);
}

// 1. Identity — source corners already equal the destination square, so
// every point should map to itself.
{
  const corners: PixelPoint[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const dst: CourtPosition[] = corners.map(([x, y]) => ({ x, y }));
  const H = computeHomography(corners, dst);
  close(applyHomography(H, [0.5, 0.5]), { x: 0.5, y: 0.5 }, 0.001);
  close(applyHomography(H, [0.3, 0.8]), { x: 0.3, y: 0.8 }, 0.001);
}
console.log('PASS identity mapping');

// 2. Recover a known synthetic homography from only its 4 corners, then
// check INTERIOR points never given to the solver — proves the fit
// generalizes rather than just memorizing the calibration points.
{
  const trueH: [number, number, number, number, number, number, number, number, number] =
    [1.2, 0.15, 0.05, -0.1, 1.3, 0.02, 0.0006, 0.0004, 1];
  const courtCorners: CourtPosition[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const cameraCorners: PixelPoint[] = courtCorners.map(p => {
    const r = applyHomography(trueH, [p.x, p.y]);
    return [r.x, r.y];
  });
  const H = computeHomography(cameraCorners, courtCorners);

  const interior: CourtPosition[] = [{ x: 0.5, y: 0.5 }, { x: 0.25, y: 0.75 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.9 }];
  for (const p of interior) {
    const cameraPixel = applyHomography(trueH, [p.x, p.y]);
    const recovered = applyHomography(H, [cameraPixel.x, cameraPixel.y]);
    close(recovered, p, 1e-6);
  }
}
console.log('PASS recovers interior points from a known ground-truth homography');

// 3. Realistic case — a genuine pinhole-camera view of a real 13.4m x 6.1m
// badminton court, shot from 3.5m behind the near baseline at 1.2m height
// (matches ClipRecorder's own setup instructions). Physically self-consistent,
// unlike a hand-drawn illustration, so recovering the net's center — a point
// never given to the solver — is a meaningful check.
{
  const COURT_W = 6.1, COURT_L = 13.4;
  const camHeight = 1.2, camBack = 3.5, focal = 900;

  function project(Xm: number, Zm: number): PixelPoint {
    const camZ = -camBack;
    const dz = Zm - camZ;
    const u = focal * ((Xm - COURT_W / 2) / dz) + 320;
    const v = focal * (camHeight / dz) + 240 - focal * 0.15;
    return [u, v];
  }

  const corners3d: [number, number][] = [[0, 0], [COURT_W, 0], [COURT_W, COURT_L], [0, COURT_L]];
  const cameraCorners = corners3d.map(([X, Z]) => project(X, Z));
  const courtCorners: CourtPosition[] = [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 }];

  const H = computeHomography(cameraCorners, courtCorners);

  const netCenterPixel = project(COURT_W / 2, COURT_L / 2);
  close(applyHomography(H, netCenterPixel), { x: 0.5, y: 0.5 }, 0.01);
}
console.log('PASS realistic pinhole-camera court view recovers net center');

// 4. Real fingers don't tap exact pixels. Re-run the same realistic camera
// view, but jitter each of the 4 tapped corners by a few pixels (fixed
// offsets, not random, so this stays reproducible) — confirms small human
// tap imprecision degrades the result gracefully instead of blowing it up.
{
  const COURT_W = 6.1, COURT_L = 13.4;
  const camHeight = 1.2, camBack = 3.5, focal = 900;

  function project(Xm: number, Zm: number): PixelPoint {
    const camZ = -camBack;
    const dz = Zm - camZ;
    const u = focal * ((Xm - COURT_W / 2) / dz) + 320;
    const v = focal * (camHeight / dz) + 240 - focal * 0.15;
    return [u, v];
  }

  const corners3d: [number, number][] = [[0, 0], [COURT_W, 0], [COURT_W, COURT_L], [0, COURT_L]];
  const jitter: PixelPoint[] = [[3, -2], [-3, 2], [2, 3], [-2, -3]]; // a few px off, per corner
  const cameraCorners: PixelPoint[] = corners3d.map(([X, Z], i) => {
    const [u, v] = project(X, Z);
    return [u + jitter[i][0], v + jitter[i][1]];
  });
  const courtCorners: CourtPosition[] = [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 }];

  const H = computeHomography(cameraCorners, courtCorners);
  const netCenterPixel = project(COURT_W / 2, COURT_L / 2);
  const result = applyHomography(H, netCenterPixel);
  // Looser tolerance than the exact-tap test — a few px of tap slop should
  // nudge the result slightly, not throw it across the court.
  close(result, { x: 0.5, y: 0.5 }, 0.05);
  console.log(`INFO  a few px of tap jitter on all 4 corners -> net center off by [${(result.x - 0.5).toFixed(4)}, ${(result.y - 0.5).toFixed(4)}]`);
}
console.log('PASS small tap imprecision degrades gracefully, does not blow up');

// 5. Degenerate input (duplicate corner) must throw, not silently return
// garbage that would poison every heatmap point.
{
  assert.throws(() => computeHomography(
    [[0, 0], [0, 0], [1, 1], [0, 1]],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
  ));
}
console.log('PASS degenerate input throws instead of returning garbage');

console.log('\nAll checks passed.');

// Auto-detect shuttle hits during Track & Record: audio-based, not video —
// cheaper and far more device-feasible than trying to spot the shuttle in
// frame (that's real ML + likely cloud, this app's first backend cost, not
// built speculatively). Runs as a post-processing pass once recording stops,
// not live — not constrained by the phone's real-time budget, and the mic
// track already exists (ClipRecorder requests audio: true for every clip).
// Detects the shuttle-impact "thwock" as a short energy transient: frame RMS
// energy + an adaptive (rolling-window) threshold + a refractory period so
// one hit isn't reported twice. Not a trained classifier — a missed or extra
// "hit" just means a slightly off review list, no correctness-critical path
// depends on it.

const FRAME_MS = 20;
const MIN_GAP_MS = 300;
const WINDOW_MS = 1000;
const MIN_ENERGY = 0.02; // floor so near-silence noise never counts as a hit
// stddevs above rolling mean to count as a transient. Was 3 — Lok reported
// hits feeling "random" in real use, i.e. too many false positives from
// crowd/voice/footstep noise on a busy court. Raised so only a much sharper
// spike (an actual impact) clears the bar; still a heuristic, not a trained
// classifier, so it can still miss soft net shots — revisit with real
// recordings if that turns out to be the bigger problem instead.
const THRESHOLD_K = 4.2;

export function computeFrameEnergies(samples: Float32Array, sampleRate: number, frameMs = FRAME_MS): Float32Array {
  const frameSize = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const frameCount = Math.floor(samples.length / frameSize);
  const energies = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    const start = i * frameSize;
    for (let j = 0; j < frameSize; j++) {
      const s = samples[start + j];
      sum += s * s;
    }
    energies[i] = Math.sqrt(sum / frameSize);
  }
  return energies;
}

// Returns hit timestamps in seconds, derived from a rolling local mean/stddev
// (rallies get louder/quieter than a single match-wide baseline would allow for).
export function detectHitsFromEnergies(energies: Float32Array, frameMs = FRAME_MS): number[] {
  const windowFrames = Math.round(WINDOW_MS / frameMs);
  const minGapFrames = Math.round(MIN_GAP_MS / frameMs);
  const hits: number[] = [];
  let lastHitFrame = -Infinity;

  for (let i = 0; i < energies.length; i++) {
    const lo = Math.max(0, i - windowFrames);
    const n = i - lo;
    if (n < windowFrames / 2) continue; // not enough history yet

    let mean = 0;
    for (let j = lo; j < i; j++) mean += energies[j];
    mean /= n;
    let variance = 0;
    for (let j = lo; j < i; j++) variance += (energies[j] - mean) ** 2;
    const stddev = Math.sqrt(variance / n);
    const threshold = mean + THRESHOLD_K * stddev;

    if (energies[i] > threshold && energies[i] > MIN_ENERGY && i - lastHitFrame > minGapFrames) {
      hits.push((i * frameMs) / 1000);
      lastHitFrame = i;
    }
  }
  return hits;
}

// Decodes a recorded clip's audio track and returns detected hit timestamps
// (seconds from clip start). Swallows decode failures (unsupported format,
// no audio track, browser quirk) — this is a review aid, not a required path.
export async function detectShuttleHits(blob: Blob): Promise<number[]> {
  try {
    const AudioCtxCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtxCtor();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const samples = audioBuffer.getChannelData(0);
    const energies = computeFrameEnergies(samples, audioBuffer.sampleRate);
    ctx.close?.();
    return detectHitsFromEnergies(energies);
  } catch {
    return [];
  }
}

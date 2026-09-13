'use client';
// Public "How Ratings Work" page — reuses the in-app MMRInfoModal wholesale
// (same formula/calibration/tiers/fair-play/doubles content players already
// see) instead of writing a second copy of the same explainer.
import { BASE_PATH } from '@/lib/utils';
import { MMRInfoModal } from '@/components/MMRInfoModal';

export default function HowItWorks() {
  return <MMRInfoModal open onClose={() => { window.location.href = `${BASE_PATH}/`; }} />;
}

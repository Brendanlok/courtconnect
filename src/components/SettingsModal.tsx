'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Save, Trash2, AlertTriangle, Globe, Users, Lock, Camera, Bell, BellOff, GraduationCap, LifeBuoy } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { DAY_IDS, DAY_LABELS, SLOT_IDS, SLOT_LABELS, postcodeToLocation, COUNTRIES, getCountryByName } from '@/lib/utils';
import type { CountryCode, MalaysiaState } from '@/types';
import type { UserProfile } from '@/types';
import { supabase, auth } from '@/lib/supabase';
import { deleteAccountData, loadMyCoachProfile, saveCoachProfile, deleteCoachProfile, type MyCoachProfile } from '@/lib/supabaseService';
import { pushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push';
import { Avatar } from '@/components/ui/Avatar';
import { AvatarCropModal } from '@/components/AvatarCropModal';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';

type PrivacyLevel = 'public' | 'friends' | 'private';
type PrivacySettings = NonNullable<UserProfile['privacy']>;

const DEFAULT_PRIVACY: PrivacySettings = {
  matchHistory:   'public',
  clubMembership: 'public',
  eventHistory:   'public',
};

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; icon: React.ReactNode }[] = [
  { value: 'public',  label: 'Public',  icon: <Globe  size={11}/> },
  { value: 'friends', label: 'Followers', icon: <Users  size={11}/> },
  { value: 'private', label: 'Only Me', icon: <Lock   size={11}/> },
];

// Only settings something on the profile actually reads belong here — a
// toggle with no enforcing surface is worse than no toggle (see Notion
// To-Do "Planned Matches/Friend List privacy toggles are inert"). Add
// plannedMatches/friendList back if a followers list or a public planned-
// matches section ever gets built.
const PRIVACY_ITEMS: { key: keyof PrivacySettings; label: string }[] = [
  { key: 'matchHistory',   label: 'Match History' },
  { key: 'clubMembership', label: 'Club Membership' },
  { key: 'eventHistory',   label: 'Event History' },
];

type DeleteStep = 'idle' | 'warn' | 'confirm';
type SettingsTab = 'profile' | 'location' | 'availability' | 'privacy' | 'coaching' | 'account';
const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'profile',      label: 'Profile' },
  { key: 'location',     label: 'Location' },
  { key: 'availability', label: 'Schedule' },
  { key: 'privacy',      label: 'Privacy' },
  { key: 'coaching',     label: 'Coaching' },
  { key: 'account',      label: 'Account' },
];

const COACH_SPECIALTIES = ['Beginners', 'Juniors', 'Doubles Strategy', 'Footwork', 'Singles Strategy', 'Fitness'];
const EMPTY_COACH_PROFILE: MyCoachProfile = { currency: 'MYR', specialties: [], areas: [], isActive: false };

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateUser } = useApp();

  const [tab, setTab] = useState<SettingsTab>('profile');
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio,         setBio]         = useState(user.bio ?? '');
  const [gender,      setGender]      = useState<'Male' | 'Female' | undefined>(user.gender);
  const [birthday,    setBirthday]    = useState(user.birthday ?? '');
  const [countryCode, setCountryCode] = useState<CountryCode>((user.countryCode ?? 'MY') as CountryCode);
  const [region,      setRegion]      = useState(user.region ?? user.state ?? '');
  const [cityText,    setCityText]    = useState(user.area ?? '');
  const [postcode,    setPostcode]    = useState(user.postcode ?? '');
  const [availability,setAvailability]= useState<string[]>(
    (user.available ?? '').split(',').map(s => s.trim()).filter(Boolean)
  );
  const countryData = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];
  const [privacy,     setPrivacy]     = useState<PrivacySettings>({ ...DEFAULT_PRIVACY, ...user.privacy });
  const [isPrivate,   setIsPrivate]   = useState(user.isPrivate ?? false);
  const [saved,       setSaved]       = useState(false);
  const [deleteStep,  setDeleteStep]  = useState<DeleteStep>('idle');
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [photoURL,    setPhotoURL]    = useState<string | null>(user.photoURL ?? null);
  const [uploadPct,   setUploadPct]   = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [cropFile,    setCropFile]    = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Coach profile — separate table (coach_profiles), not part of UserProfile,
  // so it's loaded independently rather than seeded from `user` like the
  // fields above. null = not loaded yet (or genuinely has no listing, same
  // as EMPTY_COACH_PROFILE in effect — isActive stays false either way).
  const [coach, setCoach] = useState<MyCoachProfile>(EMPTY_COACH_PROFILE);
  const [coachLoaded, setCoachLoaded] = useState(false);
  useEffect(() => {
    if (!open) return;
    const uid = auth.currentUser?.uid;
    if (!uid) { setCoachLoaded(true); return; }
    loadMyCoachProfile(uid).then(p => { setCoach(p ?? EMPTY_COACH_PROFILE); setCoachLoaded(true); });
  }, [open]);
  const toggleSpecialty = (s: string) =>
    setCoach(c => ({ ...c, specialties: c.specialties.includes(s) ? c.specialties.filter(x => x !== s) : [...c.specialties, s] }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    setCropFile(file);
  };

  const handleCropConfirm = (blob: Blob) => {
    setCropFile(null);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const path = `${uid}/${Date.now()}.jpg`;
    setUploadPct(0);
    setUploadError('');
    // ponytail: supabase-js storage upload has no progress events (unlike
    // Firebase's uploadBytesResumable) — jump straight to 100 on success.
    supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true }).then(({ error }) => {
      if (error) { setUploadPct(null); setUploadError('Upload failed. Please try again.'); return; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setPhotoURL(data.publicUrl);
      setUploadPct(null);
    });
  };

  const { ref: panelRef, dialogProps } = useModalA11y(open, onClose, 'Settings');

  if (!open) return null;

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors';
  const isMY = countryCode === 'MY';
  const location = isMY ? postcodeToLocation(postcode) : null;
  const postcodeValid = countryData.hasPostcode && postcode
    ? !!(countryData.postcodePattern?.test(postcode))
    : null; // null = not applicable or empty

  const toggleAvail = (id: string) =>
    setAvailability(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const postcodeInvalid = countryData.hasPostcode && postcode && postcodeValid === false;

  const save = () => {
    if (postcodeInvalid) return; // blocked — invalid postcode
    updateUser({
      displayName, bio, gender, birthday: birthday || undefined,
      country: countryData.name,
      countryCode,
      region: isMY ? (location?.state ?? region) : region,
      area:   isMY ? (location?.city  ?? cityText) : cityText,
      state:  isMY ? (location?.state ?? region as MalaysiaState) : user.state,
      postcode: countryData.hasPostcode ? postcode : undefined,
      available: availability.join(','),
      privacy,
      isPrivate,
      photoURL,
    });
    // Separate table, separate write — coach_profiles isn't part of
    // UserProfile/updateUser. Delete the row entirely when toggled off
    // rather than leaving an inactive row behind (is_active is also checked
    // by coach_profiles_public, but no listing beats a stale one).
    const uid = auth.currentUser?.uid;
    if (uid) {
      if (coach.isActive) saveCoachProfile(uid, coach).catch(() => {});
      else deleteCoachProfile(uid).catch(() => {});
    }
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  const handleDelete = async () => {
    const authUser = auth.currentUser;
    if (!authUser) return;
    setDeleting(true);
    setDeleteError('');
    try {
      // RLS requires an authenticated request, so data must be wiped before
      // signing out.
      // ponytail: the anon/publishable client can't delete its own
      // auth.users row — that needs the Supabase Admin API (service-role
      // key), which has no home in this static-export app (no server
      // runtime). This deletes all app data + signs out; the auth account
      // itself needs a manual admin deletion (Supabase dashboard) or a small
      // Edge Function, until that's built.
      await deleteAccountData(authUser.uid);
      await supabase.auth.signOut();
      // cc_theme is a device display preference, not account state — same
      // exclusion as the near-identical clear-on-logout in AuthContext.
      // Deleting your account shouldn't silently flip your device back to
      // light/dark default too.
      Object.keys(localStorage)
        .filter(k => k.startsWith('cc_') && k !== 'cc_theme')
        .forEach(k => localStorage.removeItem(k));
      setDeleteStep('idle');
      onClose();
    } catch {
      setDeleteError('Something went wrong deleting your account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (saved) return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-10 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-lg font-bold">Saved!</p>
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl outline-none" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold">Settings</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white transition-colors"><X size={18}/></button>
        </div>

        <div className="flex gap-1 overflow-x-auto px-5 pt-3 pb-1 border-b border-slate-800 [&::-webkit-scrollbar]:hidden">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap
                ${tab === t.key ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4 h-[60vh] overflow-y-auto">

          {/* Profile picture */}
          {tab === 'profile' && (<>
          <div className="flex flex-col items-center gap-2">
            <div className="relative cursor-pointer group" onClick={() => fileRef.current?.click()}>
              <Avatar name={displayName} size="lg" photoURL={photoURL} className="ring-4 ring-slate-700 group-hover:ring-emerald-500/50 transition-all"/>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={20} className="text-white"/>
              </div>
              {uploadPct !== null && (
                <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{uploadPct}%</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                {photoURL ? 'Change photo' : 'Add photo'}
              </button>
              {photoURL && (
                <button type="button" onClick={() => setPhotoURL(null)}
                  className="text-[11px] text-slate-500 hover:text-red-400 font-semibold transition-colors">
                  Remove photo
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange}/>
            {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}
          </div>
          {cropFile && <AvatarCropModal file={cropFile} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm}/>}

          {/* Name */}
          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold">Display Name</span>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={`mt-1 ${inp}`}/>
          </label>

          {/* Bio */}
          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold">Bio</span>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
              placeholder="Tell other players about yourself…"
              className={`mt-1 ${inp} resize-none`}/>
          </label>

          {/* Gender + Birthday */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold mb-1.5">Gender</p>
              <div className="flex gap-2">
                {(['Male','Female'] as const).map(g => (
                  <button key={g} type="button" onClick={() => setGender(g)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors
                      ${gender === g
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                    {g === 'Male' ? '♂ Male' : '♀ Female'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-semibold mb-1.5">
                Birthday {birthday && <span className="text-slate-400 font-normal">· age {Math.floor((Date.now() - new Date(birthday).getTime()) / 31557600000)}</span>}
              </p>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                max={new Date().toISOString().slice(0,10)}
                className={`${inp} text-sm`}/>
            </div>
          </div>
          </>)}

          {/* Country */}
          {tab === 'location' && (<>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold mb-1.5">Country</p>
            <select value={countryCode}
              onChange={e => { setCountryCode(e.target.value as CountryCode); setRegion(''); setCityText(''); setPostcode(''); }}
              className={inp}>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Location — country-aware */}
          <div>
            <p className="text-[11px] text-slate-500 font-semibold mb-1.5">Location</p>
            <div className="space-y-2">
              {isMY ? (
                <>
                  <input value={postcode} onChange={e => setPostcode(e.target.value.replace(/\D/g,'').slice(0,5))}
                    placeholder="5-digit postcode e.g. 47810" maxLength={5}
                    className={`${inp} font-mono`}/>
                  {location ? (
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <span className="text-slate-500">📍</span>
                      <span className="font-semibold">{location.city}</span>
                      <span className="text-slate-500">·</span>
                      <span>{location.state}</span>
                    </p>
                  ) : postcode.length === 5 ? (
                    <p className="text-xs text-red-400">Postcode not recognised — enter area manually:</p>
                  ) : postcode.length > 0 ? (
                    <p className="text-xs text-slate-600">Enter all 5 digits</p>
                  ) : null}
                  {(postcode.length === 0 || (postcode.length === 5 && !location)) && (
                    <div className="grid grid-cols-2 gap-2">
                      <select value={region} onChange={e => setRegion(e.target.value)} className={inp}>
                        <option value="">State…</option>
                        {countryData.regions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input value={cityText} onChange={e => setCityText(e.target.value)}
                        placeholder="City / Area" className={inp}/>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {countryData.regions.length > 0 ? (
                      <select value={region} onChange={e => setRegion(e.target.value)} className={inp}>
                        <option value="">{countryData.regionLabel}…</option>
                        {countryData.regions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input value={region} onChange={e => setRegion(e.target.value)}
                        placeholder={countryData.regionLabel} className={inp}/>
                    )}
                    <input value={cityText} onChange={e => setCityText(e.target.value)}
                      placeholder="City / Area" className={inp}/>
                  </div>
                  {countryData.hasPostcode && (
                    <div>
                      <input
                        value={postcode}
                        onChange={e => {
                          const raw = e.target.value.toUpperCase();
                          const maxLen = countryData.postcodeLen || 10;
                          setPostcode(raw.slice(0, maxLen || raw.length));
                        }}
                        placeholder={
                          countryCode === 'GB' ? 'e.g. SW1A 1AA'
                          : countryCode === 'US' ? 'e.g. 90210'
                          : `${countryData.postcodeLen}-digit postcode`
                        }
                        className={`${inp} font-mono ${
                          postcode && postcodeValid === false ? 'border-red-500 focus:border-red-500' :
                          postcode && postcodeValid === true  ? 'border-emerald-500' : ''
                        }`}
                      />
                      {postcode && postcodeValid === false && (
                        <p className="text-xs text-red-400 mt-1">
                          {countryCode === 'GB' ? 'Enter a valid UK postcode e.g. SW1A 1AA'
                          : countryCode === 'US' ? 'Enter a valid 5-digit ZIP code'
                          : `Enter a valid ${countryData.postcodeLen}-digit postcode`}
                        </p>
                      )}
                      {postcode && postcodeValid === true && (
                        <p className="text-xs text-emerald-400 mt-1">✓ Valid postcode</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          </>)}

          {/* Availability grid: 7 days × 6 time slots */}
          {tab === 'availability' && (
          <div>
            <p className="text-[11px] text-slate-500 font-semibold mb-2">Availability</p>
            <div className="space-y-1">
              {/* Column headers */}
              <div className="flex gap-0.5 ml-7">
                {SLOT_LABELS.map(l => (
                  <div key={l} className="flex-1 text-center text-[8px] text-slate-600 leading-tight px-0.5">{l}</div>
                ))}
              </div>
              {/* Day rows */}
              {(DAY_IDS as readonly string[]).map((day, di) => (
                <div key={day} className="flex items-center gap-0.5">
                  <span className="text-[10px] text-slate-500 w-6 shrink-0 font-medium">{DAY_LABELS[di]}</span>
                  {(SLOT_IDS as readonly string[]).map(slot => {
                    const id = `${day}_${slot}`;
                    const on = availability.includes(id);
                    return (
                      <button key={slot} type="button" onClick={() => toggleAvail(id)}
                        className={`flex-1 h-6 rounded text-[9px] font-bold transition-colors border
                          ${on
                            ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-400'
                            : 'bg-slate-800/50 border-slate-700/40 text-slate-700 hover:border-slate-600 hover:text-slate-500'}`}>
                        {on ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {availability.length > 0 && (
              <p className="text-[10px] text-slate-600 mt-1.5">{availability.length} slot{availability.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>
          )}

          {/* Privacy */}
          {tab === 'privacy' && (<>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isPrivate ? <Lock size={13} className="text-amber-400"/> : <Globe size={13} className="text-emerald-400"/>}
                <div>
                  <p className="text-xs font-semibold text-slate-200">Private Account</p>
                  <p className="text-[10px] text-slate-500">
                    {isPrivate ? 'Only approved followers can see your full profile.' : 'Anyone can see your full profile.'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setIsPrivate(v => !v)}
                className={`shrink-0 w-10 h-6 rounded-full border transition-colors relative ${
                  isPrivate ? 'bg-amber-500/30 border-amber-500/50' : 'bg-slate-800 border-slate-700'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${
                  isPrivate ? 'translate-x-[16px] bg-amber-400' : 'translate-x-0 bg-slate-500'}`}/>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-3 space-y-3">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold mb-0.5">Privacy</p>
              <p className="text-[10px] text-slate-600">Control who can see your profile information.</p>
            </div>
            {PRIVACY_ITEMS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-300 shrink-0">{label}</span>
                <div className="flex gap-1">
                  {PRIVACY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setPrivacy(p => ({ ...p, [key]: opt.value }))}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors
                        ${privacy[key] === opt.value
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </>)}

          {/* Coach listing — self-reported only, see find-a-coach/page.tsx
              copy: not certified or vetted by CourtConnect. */}
          {tab === 'coaching' && (<>
          {!coachLoaded ? (
            <p className="text-xs text-slate-500 text-center py-6">Loading…</p>
          ) : (<>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GraduationCap size={13} className={coach.isActive ? 'text-emerald-400' : 'text-slate-500'}/>
              <div>
                <p className="text-xs font-semibold text-slate-200">List yourself as a coach</p>
                <p className="text-[10px] text-slate-500">
                  {coach.isActive ? 'Visible on Find a Coach — players can message you.' : 'Not listed. Turn on to appear on Find a Coach.'}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setCoach(c => ({ ...c, isActive: !c.isActive }))}
              className={`shrink-0 w-10 h-6 rounded-full border transition-colors relative ${
                coach.isActive ? 'bg-emerald-500/30 border-emerald-500/50' : 'bg-slate-800 border-slate-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${
                coach.isActive ? 'translate-x-[16px] bg-emerald-400' : 'translate-x-0 bg-slate-500'}`}/>
            </button>
          </div>

          {coach.isActive && (
          <div className="border-t border-slate-800/80 pt-3 space-y-3">
            <div>
              <label className="text-[11px] text-slate-500 font-semibold block mb-1">Bio</label>
              <textarea value={coach.bio ?? ''} onChange={e => setCoach(c => ({ ...c, bio: e.target.value }))}
                rows={3} maxLength={300} placeholder="Your coaching background, style, who you work best with…"
                className={inp}/>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-slate-500 font-semibold block mb-1">Hourly rate (optional)</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 shrink-0">RM</span>
                  <input type="number" min="0" value={coach.hourlyRate ?? ''}
                    onChange={e => setCoach(c => ({ ...c, hourlyRate: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="Leave blank to discuss per player" className={inp}/>
                </div>
              </div>
              <div className="w-28">
                <label className="text-[11px] text-slate-500 font-semibold block mb-1">Years coaching</label>
                <input type="number" min="0" value={coach.yearsExperience ?? ''}
                  onChange={e => setCoach(c => ({ ...c, yearsExperience: e.target.value ? Number(e.target.value) : undefined }))}
                  className={inp}/>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-semibold block mb-1.5">Specialties</label>
              <div className="flex flex-wrap gap-1.5">
                {COACH_SPECIALTIES.map(s => (
                  <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                      coach.specialties.includes(s)
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-semibold block mb-1">Areas/venues (comma-separated)</label>
              <input value={coach.areas.join(', ')}
                onChange={e => setCoach(c => ({ ...c, areas: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                placeholder="e.g. Petaling Jaya, Bukit Jalil" className={inp}/>
            </div>
            <p className="text-[10px] text-slate-600">
              This listing is self-reported — CourtConnect doesn&apos;t verify or certify coaches.
            </p>
          </div>
          )}
          </>)}
          </>)}

          {/* Push notifications + username */}
          {tab === 'account' && (<>
          <NotificationPermissionRow/>

          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-500">Username</span>
            <span className="text-xs text-slate-300 font-semibold">@{user.username} · cannot be changed</span>
          </div>

          {/* Report a problem — mailto keeps this a static export, no backend needed */}
          <a href={`mailto:chanlokk97@gmail.com?subject=${encodeURIComponent('CourtConnect — problem report')}&body=${encodeURIComponent(`What happened:\n\n\n— sent from @${user.username}'s account`)}`}
            className="flex items-center gap-2 w-full px-3 py-2.5 border border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-medium transition-colors">
            <LifeBuoy size={13}/> Report a problem
          </a>

          {/* Delete account */}
          <div className="border-t border-slate-800/80 pt-3">
            {deleteStep === 'idle' && (
              <button onClick={() => setDeleteStep('warn')}
                className="flex items-center gap-2 w-full px-3 py-2.5 border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400/80 hover:text-red-400 rounded-xl text-xs font-medium transition-colors">
                <Trash2 size={13}/> Delete account
              </button>
            )}

            {deleteStep === 'warn' && (
              <div className="bg-slate-800 border border-red-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-sm font-semibold text-red-300">Permanently delete your profile?</p>
                    <p className="text-xs text-slate-400 mt-0.5">All match history, MMR, and stats will be lost. This cannot be undone.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteStep('idle')}
                    className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => { setDeleteInput(''); setDeleteStep('confirm'); }}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors">
                    Continue
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 'confirm' && (
              <div className="bg-slate-800 border border-red-500/30 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-red-300">Type <span className="font-mono bg-slate-700 px-1 rounded">DELETE</span> to confirm</p>
                <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
                  placeholder="DELETE" disabled={deleting}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-red-500 transition-colors disabled:opacity-50"/>
                {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setDeleteStep('idle'); setDeleteError(''); }} disabled={deleting}
                    className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                    Cancel
                  </button>
                  <button onClick={handleDelete} disabled={deleteInput !== 'DELETE' || deleting}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                    {deleting ? 'Deleting…' : 'Delete forever'}
                  </button>
                </div>
              </div>
            )}
          </div>
          </>)}
        </div>

        <div className="px-5 pb-5 flex gap-3 border-t border-slate-800 pt-4">
          <Button onClick={save} disabled={!!postcodeInvalid} icon={<Save size={14}/>} className="flex-1">
            Save
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotificationPermissionRow() {
  const [perm, setPerm] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return Notification.permission;
  });
  const [subscribing, setSubscribing] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const canRealPush = pushSupported();

  useEffect(() => {
    if (!canRealPush || perm !== 'granted') return;
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushOn(!!sub))
      .catch(() => {});
  }, [canRealPush, perm]);

  const request = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPerm(result);
    const uid = auth.currentUser?.uid;
    if (result === 'granted' && uid) {
      setSubscribing(true);
      const ok = await subscribeToPush(uid);
      setPushOn(ok);
      setSubscribing(false);
    }
  };

  const togglePush = async () => {
    const uid = auth.currentUser?.uid;
    setSubscribing(true);
    if (pushOn) {
      await unsubscribeFromPush();
      setPushOn(false);
    } else if (uid) {
      setPushOn(await subscribeToPush(uid));
    }
    setSubscribing(false);
  };

  if (!('Notification' in (typeof window !== 'undefined' ? window : {}))) return null;

  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-slate-800/50 border border-slate-800 rounded-xl">
      <div className="flex items-center gap-2">
        {perm === 'granted' ? <Bell size={13} className="text-emerald-400"/> : <BellOff size={13} className="text-slate-500"/>}
        <div>
          <p className="text-xs font-semibold text-slate-300">Push Notifications</p>
          <p className="text-[10px] text-slate-500">
            {perm === 'granted'
              ? (canRealPush && pushOn ? "Enabled — you'll get alerts even when the app is closed" : "Enabled — you'll get alerts when the app is in background")
              : perm === 'denied' ? 'Blocked — allow in browser settings' : 'Off'}
          </p>
        </div>
      </div>
      {perm === 'default' && (
        <button onClick={request} disabled={subscribing}
          className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg font-semibold transition-colors shrink-0">
          {subscribing ? 'Enabling…' : 'Enable'}
        </button>
      )}
      {perm === 'granted' && canRealPush && (
        <button onClick={togglePush} disabled={subscribing}
          title={pushOn ? 'Turn off background alerts' : 'Turn on background alerts'}
          className={`text-[10px] font-bold shrink-0 transition-colors disabled:opacity-50 ${pushOn ? 'text-emerald-400 hover:text-red-400' : 'text-slate-500 hover:text-emerald-400'}`}>
          {pushOn ? '✓ On' : 'Off'}
        </button>
      )}
      {perm === 'granted' && !canRealPush && (
        <span className="text-[10px] text-emerald-400 font-bold shrink-0">✓ On</span>
      )}
    </div>
  );
}

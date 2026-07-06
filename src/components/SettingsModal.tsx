'use client';
import { useState, useRef } from 'react';
import { X, Save, Trash2, AlertTriangle, Globe, Users, Lock, Camera, Bell, BellOff } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { DAY_IDS, DAY_LABELS, SLOT_IDS, SLOT_LABELS, postcodeToLocation, COUNTRIES, getCountryByName } from '@/lib/utils';
import type { CountryCode } from '@/types';
import type { UserProfile } from '@/types';
import { storage, auth } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Avatar } from '@/components/ui/Avatar';

type PrivacyLevel = 'public' | 'friends' | 'private';
type PrivacySettings = NonNullable<UserProfile['privacy']>;

const DEFAULT_PRIVACY: PrivacySettings = {
  matchHistory:   'public',
  plannedMatches: 'public',
  friendList:     'public',
  clubMembership: 'public',
  eventHistory:   'public',
};

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; icon: React.ReactNode }[] = [
  { value: 'public',  label: 'Public',  icon: <Globe  size={11}/> },
  { value: 'friends', label: 'Friends', icon: <Users  size={11}/> },
  { value: 'private', label: 'Only Me', icon: <Lock   size={11}/> },
];

const PRIVACY_ITEMS: { key: keyof PrivacySettings; label: string }[] = [
  { key: 'matchHistory',   label: 'Match History' },
  { key: 'plannedMatches', label: 'Planned Matches' },
  { key: 'friendList',     label: 'Friend List' },
  { key: 'clubMembership', label: 'Club Membership' },
  { key: 'eventHistory',   label: 'Event History' },
];

type DeleteStep = 'idle' | 'warn' | 'confirm';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateUser } = useApp();

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
  const [saved,       setSaved]       = useState(false);
  const [deleteStep,  setDeleteStep]  = useState<DeleteStep>('idle');
  const [deleteInput, setDeleteInput] = useState('');
  const [photoURL,    setPhotoURL]    = useState<string | null>(user.photoURL ?? null);
  const [uploadPct,   setUploadPct]   = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const storageRef = ref(storage, `profilePics/${uid}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    setUploadPct(0);
    task.on('state_changed',
      snap => setUploadPct(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      () => setUploadPct(null),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setPhotoURL(url);
        setUploadPct(null);
      }
    );
  };

  if (!open) return null;

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors';
  const isMY = countryCode === 'MY';
  const location = isMY ? postcodeToLocation(postcode) : null;

  const toggleAvail = (id: string) =>
    setAvailability(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = () => {
    updateUser({
      displayName, bio, gender, birthday: birthday || undefined,
      country: countryData.name,
      countryCode,
      region: isMY ? (location?.state ?? region) : region,
      area:   isMY ? (location?.city  ?? cityText) : cityText,
      state:  isMY ? (location?.state ?? user.state) : user.state,
      postcode: isMY ? postcode : undefined,
      available: availability.join(','),
      privacy,
      photoURL,
    });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  const handleDelete = () => {
    updateUser({ displayName: 'Deleted User', bio: '', mmr: 1000,
      stats: { wins: 0, losses: 0, totalMatches: 0 }, openToPlay: false });
    localStorage.removeItem('cc_openToPlay');
    setDeleteStep('idle');
    onClose();
  };

  if (saved) return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-10 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-lg font-bold">Saved!</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">

          {/* Profile picture */}
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
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
              {photoURL ? 'Change photo' : 'Add photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange}/>
          </div>

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

          {/* Country */}
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
                      <select value={region} onChange={e => setRegion(e.target.value)}
                        className={inp}>
                        <option value="">State…</option>
                        {countryData.regions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input value={cityText} onChange={e => setCityText(e.target.value)}
                        placeholder="City / Area" className={inp}/>
                    </div>
                  )}
                </>
              ) : (
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
              )}
            </div>
          </div>

          {/* Availability grid: 7 days × 6 time slots */}
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

          {/* Push notifications */}
          <NotificationPermissionRow/>

          {/* Username (read-only) */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-500">Username</span>
            <span className="text-xs text-slate-300 font-semibold">@{user.username} · cannot be changed</span>
          </div>

          {/* Privacy */}
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
                  placeholder="DELETE"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-red-500 transition-colors"/>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteStep('idle')}
                    className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleDelete} disabled={deleteInput !== 'DELETE'}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                    Delete forever
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3 border-t border-slate-800 pt-4">
          <button onClick={save}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors">
            <Save size={14}/> Save
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

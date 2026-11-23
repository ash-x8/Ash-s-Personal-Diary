import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck, BookOpen, ArrowRight } from 'lucide-react';
import { useDiary } from '../context/DiaryContext';
import { useToast } from '../context/ToastContext';
import deskAtmosphereImg from '../assets/images/diary_desk_atmosphere_1795425747914.jpg';
import leatherCoverImg from '../assets/images/diary_cover_leather_1795425747063.jpg';

export function ClosedBookAccess() {
  const {
    setupStatus,
    settings,
    unlockWithPin,
    setupVaultPins,
    signInWithGoogleAccount,
  } = useDiary();
  const { showToast } = useToast();

  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // First-run vault claim form state
  const [setupEditorPin, setSetupEditorPin] = useState('');
  const [setupReaderPin, setSetupReaderPin] = useState('');
  const [showSetupPins, setShowSetupPins] = useState(false);

  const needsSetup = Boolean(setupStatus?.needsSetup);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg('Enter your access code to unseal the diary.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await unlockWithPin(pin.trim());
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to verify access code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVaultSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupEditorPin.trim().length < 4) {
      setErrorMsg('Choose an Editor PIN with at least 4 characters.');
      return;
    }
    if (setupReaderPin.trim() && setupReaderPin.trim().length < 4) {
      setErrorMsg('Reader PIN must be at least 4 characters when provided.');
      return;
    }
    if (setupReaderPin.trim() && setupReaderPin.trim() === setupEditorPin.trim()) {
      setErrorMsg('Reader PIN must differ from the Editor PIN.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      await setupVaultPins(setupEditorPin.trim(), setupReaderPin.trim() || undefined);
      showToast('Private vault initialized. Welcome to your diary.', 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to initialize vault.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setGoogleSubmitting(true);
    try {
      const sess = await signInWithGoogleAccount();
      showToast(
        sess.role === 'EDITOR'
          ? 'Signed in with Editor cloud sync.'
          : 'Signed in as Cloud Reader.',
        'success'
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or unavailable.';
      setErrorMsg(msg);
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0b0c10] text-[#e8e6e3] flex items-center justify-center px-4 py-10 sm:px-8">
      {/* Subtle atmospheric desk photography backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <img
          src={deskAtmosphereImg}
          alt=""
          className="h-full w-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0c10]/85 via-[#0b0c10]/75 to-[#0b0c10]" />
      </div>

      <main className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Left: Tactile Closed Leather Book Cover */}
        <section className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-[310px] aspect-[3/4] rounded-r-2xl rounded-l-md overflow-hidden border border-[#c5a059]/30 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.85)] bg-[#14110f]">
            <img
              src={leatherCoverImg}
              alt={`${settings.title} leather cover`}
              className="h-full w-full object-cover opacity-85"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-black/55" />

            {/* Book Spine Shadow */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-black/80 via-[#2a2017]/50 to-transparent border-r border-[#c5a059]/20" />

            {/* Embossed Gold Cover Inscription */}
            <div className="relative z-10 flex h-full flex-col justify-between p-7 pl-9 text-center">
              <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#c5a059]/85">
                <Lock className="h-3 w-3" />
                <span>Private Edition</span>
              </div>

              <div className="my-auto py-4 border-y border-[#c5a059]/30">
                <h1 className="font-serif-title text-2xl sm:text-[26px] font-semibold leading-snug tracking-[0.12em] text-[#f3e3b8]">
                  {settings.coverText || settings.title || "ASH'S PERSONAL DIARY"}
                </h1>
                <p className="mt-2 font-serif-book text-sm italic text-[#d8ccb8]/85">
                  {settings.subtitle || 'Private Journal'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#c5a059]">
                  {settings.authorName || 'ASH-X8'}
                </p>
                <p className="text-[11px] text-[#9b968d]">Sealed Leather Archive</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Vault Access Card */}
        <section className="lg:col-span-7">
          <div className="rounded-xl border border-[#242834] bg-[#111319]/95 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c5a059]/30 bg-[#c5a059]/10 text-[#c5a059]">
                {needsSetup ? <ShieldCheck className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="font-serif-title text-lg sm:text-xl font-semibold tracking-wide text-[#f2efe9]">
                  {needsSetup ? 'Initialize Private Vault' : 'Unseal This Volume'}
                </h2>
                <p className="text-xs sm:text-sm text-[#9ca1ab]">
                  {needsSetup
                    ? 'Set your private Editor passkey to claim and protect this diary.'
                    : 'Enter a Reader or Editor passkey, or sign in with your cloud account.'}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-[#d66363]/40 bg-[#d66363]/10 px-4 py-3 text-xs sm:text-sm text-[#f5bcbc]"
              >
                {errorMsg}
              </div>
            )}

            {needsSetup ? (
              <form onSubmit={handleVaultSetupSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="setup-editor-pin"
                    className="block text-xs font-medium uppercase tracking-wider text-[#b7bac2] mb-1.5"
                  >
                    Owner Editor Passkey (Required)
                  </label>
                  <div className="relative">
                    <input
                      id="setup-editor-pin"
                      type={showSetupPins ? 'text' : 'password'}
                      value={setupEditorPin}
                      onChange={(e) => setSetupEditorPin(e.target.value)}
                      placeholder="Minimum 4 characters"
                      autoComplete="new-password"
                      className="w-full min-h-[44px] rounded-lg border border-[#2a2f3d] bg-[#0c0e13] px-3.5 pr-11 text-sm text-[#f2efe9] placeholder-[#606572] focus:border-[#c5a059] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPins((v) => !v)}
                      aria-label={showSetupPins ? 'Hide passkeys' : 'Show passkeys'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#8e929b] hover:text-[#e8e6e3]"
                    >
                      {showSetupPins ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="setup-reader-pin"
                    className="block text-xs font-medium uppercase tracking-wider text-[#b7bac2] mb-1.5"
                  >
                    Guest Reader Passkey (Optional)
                  </label>
                  <input
                    id="setup-reader-pin"
                    type={showSetupPins ? 'text' : 'password'}
                    value={setupReaderPin}
                    onChange={(e) => setSetupReaderPin(e.target.value)}
                    placeholder="Leave blank to disable guest PIN"
                    autoComplete="new-password"
                    className="w-full min-h-[44px] rounded-lg border border-[#2a2f3d] bg-[#0c0e13] px-3.5 text-sm text-[#f2efe9] placeholder-[#606572] focus:border-[#c5a059] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-lg bg-[#c5a059] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e13] hover:bg-[#d4b06a] disabled:opacity-50 transition-colors"
                >
                  <span>{submitting ? 'Sealing Vault…' : 'Claim & Open Diary'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleUnlockSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="vault-pin-input"
                    className="block text-xs font-medium uppercase tracking-wider text-[#b7bac2] mb-1.5"
                  >
                    Diary Access Code
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e929b]" />
                    <input
                      id="vault-pin-input"
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Enter your private access code"
                      autoComplete="current-password"
                      className="w-full min-h-[46px] rounded-lg border border-[#2a2f3d] bg-[#0c0e13] pl-10 pr-11 text-sm text-[#f2efe9] placeholder-[#606572] focus:border-[#c5a059] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((v) => !v)}
                      aria-label={showPin ? 'Hide access code' : 'Show access code'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#8e929b] hover:text-[#e8e6e3]"
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-lg bg-[#c5a059] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e13] hover:bg-[#d4b06a] disabled:opacity-50 transition-colors"
                >
                  <span>{submitting ? 'Verifying…' : 'Open Diary'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-[#6d7280]">
              <span className="h-px flex-1 bg-[#212530]" />
              <span>Cloud Account</span>
              <span className="h-px flex-1 bg-[#212530]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleSubmitting}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2.5 rounded-lg border border-[#2a2f3d] bg-[#161922] px-4 py-2.5 text-xs font-medium tracking-wide text-[#e8e6e3] hover:border-[#c5a059]/50 hover:bg-[#1b1f2a] disabled:opacity-50 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"
                />
              </svg>
              <span>
                {googleSubmitting ? 'Connecting to Cloud…' : 'Continue with Google Sync'}
              </span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

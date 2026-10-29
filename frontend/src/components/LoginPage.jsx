import React, { useState, useEffect, useRef } from 'react';
import { Compass, Shield, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage({ onLoginSuccess, themeMode = 'ocean' }) {
  const [authConfig, setAuthConfig] = useState({ google_client_id: '', is_configured: false });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [gisLoaded, setGisLoaded] = useState(false);
  const googleBtnRef = useRef(null);

  // 1. Fetch Backend Auth Configuration & Google Client ID
  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/v1/auth/config', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setAuthConfig(data);
          }
        }
      } catch (err) {
        console.error('Failed to load auth configuration:', err);
      }
    };
    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Poll for window.google.accounts.id availability (Google Identity Services)
  useEffect(() => {
    let intervalId;
    const checkGis = () => {
      if (window.google?.accounts?.id) {
        setGisLoaded(true);
        clearInterval(intervalId);
      }
    };
    checkGis();
    intervalId = setInterval(checkGis, 300);
    return () => clearInterval(intervalId);
  }, []);

  // 3. Initialize Google Identity Services Button when GIS is loaded and client_id is available
  useEffect(() => {
    const clientId = authConfig.google_client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !gisLoaded || !googleBtnRef.current) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Clear previous children in case of re-render
      googleBtnRef.current.innerHTML = '';

      const btnWidth = Math.min(280, Math.max(220, window.innerWidth - 80));

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: themeMode === 'chart' ? 'outline' : 'filled_black',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        text: 'signin_with',
        logo_alignment: 'left',
        width: btnWidth,
      });
    } catch (err) {
      console.error('Failed to render Google Identity Services button:', err);
    }
  }, [authConfig.google_client_id, gisLoaded, themeMode]);

  // 4. Handle Google Credential Response from GIS
  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) {
      setErrorMessage('Google authentication did not return a valid credential.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Google authentication failed on server.');
      }

      const data = await res.json();
      if (data.status === 'success' && data.user) {
        onLoginSuccess(data.user);
      } else {
        throw new Error('Invalid authentication response structure.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Unable to authenticate with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Authorized Development / Evaluation Login (when Google Cloud Console ID is pending)
  const handleDevLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'maritime.officer@nic.in',
          name: 'Authorized Maritime Officer',
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Developer login failed.');
      }

      const data = await res.json();
      if (data.status === 'success' && data.user) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Developer login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLight = themeMode === 'chart';
  const hasGoogleClientId = Boolean(authConfig.google_client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID);

  return (
    <div
      className={`min-h-[100dvh] w-screen flex flex-col justify-between items-center px-4 py-5 sm:py-8 pt-safe pb-safe select-none transition-colors duration-300 overflow-y-auto ${
        isLight
          ? 'bg-[#f5f5f7] text-[#1d1d1f]'
          : 'bg-[#030712] text-[#f5f5f7]'
      }`}
    >
      {/* Background Subtle Nautical Grid Accent */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Header Identity */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="glass-icon w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base sm:text-lg tracking-[-0.03em]">ORCA</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-medium tracking-[0.02em] px-1.5 sm:px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10 text-[#86868b]">
                Gov of India
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-[#86868b] tracking-[-0.01em]">
              Oceanographic Reasoning & Collaborative Agents
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#86868b] tracking-[-0.01em]">
          <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="hidden sm:inline">Territorial Security Gate</span>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="w-full max-w-md my-auto py-4 z-10">
        <div
          className={`p-5 sm:p-8 rounded-2xl border transition-all duration-300 ${
            isLight
              ? 'bg-white/80 border-black/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl'
              : 'bg-white/[0.03] border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl'
          }`}
        >
          {/* Card Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 glass-icon">
              <Lock className="w-5 h-5 text-current" />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.04em] leading-[1.08] mb-2">
              Maritime Access Control
            </h1>
            <p className="text-xs text-[#86868b] leading-[1.65] tracking-[-0.01em] max-w-xs mx-auto">
              Sign in with your verified Google / Gmail account to access real-time marine intelligence, live coastal radar, and safety circuit breakers.
            </p>
          </div>

          {/* Error Alert Banner */}
          {errorMessage && (
            <div className="mb-6 p-3 rounded-lg border text-xs flex items-start gap-2.5 bg-red-500/10 border-red-500/20 text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Real Google Sign In Action */}
          <div className="flex flex-col items-center justify-center gap-4">
            {hasGoogleClientId ? (
              <div className="flex flex-col items-center gap-3 w-full">
                {/* Official Google Identity Services Render Target */}
                <div ref={googleBtnRef} className="min-h-[44px] flex items-center justify-center w-full" />
                {!gisLoaded && (
                  <div className="text-[11px] text-[#86868b] animate-pulse">
                    Connecting to Google Identity Services...
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full flex flex-col gap-3">
                <div
                  className={`p-3.5 rounded-lg border text-left text-xs ${
                    isLight ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-500/10 border-amber-500/20'
                  }`}
                >
                  <div className="font-medium text-amber-500 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Google Client ID Setup</span>
                  </div>
                  <p className="text-[11px] text-[#86868b] leading-normal tracking-[-0.01em]">
                    To enable live Google Sign-In, add <code className="font-mono text-current tracking-[0.02em]">GOOGLE_CLIENT_ID</code> to your environment.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDevLogin}
                  disabled={isLoading}
                  className={`w-full py-2.5 px-4 rounded-lg font-medium text-xs sm:text-[13px] tracking-[-0.01em] border transition-all flex items-center justify-center gap-2 ${
                    isLight
                      ? 'bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white border-transparent'
                      : 'bg-white hover:bg-neutral-100 text-[#1d1d1f] border-transparent'
                  }`}
                >
                  {isLoading ? (
                    <span>Verifying session...</span>
                  ) : (
                    <>
                      <span>Continue as Authorized Maritime Officer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* If Google Client ID is configured, also provide fallback button in dev */}
            {hasGoogleClientId && !authConfig.is_configured && (
              <button
                type="button"
                onClick={handleDevLogin}
                className="text-[11px] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] underline underline-offset-4 transition mt-2"
              >
                Sign in with authorized officer credential
              </button>
            )}
          </div>

          {/* Security Guarantee List */}
          <div className="mt-8 pt-6 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] text-[#86868b] space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>End-to-end cryptographic session signing (HMAC-SHA256)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Zero credentials stored in browser localStorage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Real-time territorial IMBL and sanctuary geofencing</span>
            </div>
          </div>
        </div>
      </main>

      {/* Statutory Footer */}
      <footer className="w-full max-w-5xl flex items-center justify-center text-xs text-[#86868b] z-10 pt-4">
        <p className="text-center text-[11px]">
          Statutory Security Notice: National Maritime Intelligence Platform. Unauthorized access is prohibited under IT Act 2000.
        </p>
      </footer>
    </div>
  );
}

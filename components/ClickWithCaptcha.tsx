"use client";

import React, { useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { trackLinkClick } from '../lib/trackLinkClick';

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!;

export function ClickWithCaptcha({ linkId, shortCode, onSuccess }: { linkId: string, shortCode: string, onSuccess?: () => void }) {
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    const result = await trackLinkClick(linkId, shortCode, captchaToken || undefined);
    setLoading(false);
    if (result.success) {
      if (onSuccess) onSuccess();
    } else if (result.captchaRequired) {
      setCaptchaRequired(true);
      setError(result.error || 'Please complete the CAPTCHA');
    } else {
      setError(result.error || 'Unknown error');
    }
  };

  const handleCaptcha = (token: string | null) => {
    setCaptchaToken(token);
  };

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? 'Processing...' : 'Click Link'}
      </button>
      {captchaRequired && (
        <div>
          <ReCAPTCHA
            sitekey={RECAPTCHA_SITE_KEY}
            onChange={handleCaptcha}
          />
          <button onClick={handleClick} disabled={!captchaToken || loading}>
            Submit with CAPTCHA
          </button>
        </div>
      )}
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}

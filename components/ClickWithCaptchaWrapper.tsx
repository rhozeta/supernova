"use client";
import { ClickWithCaptcha } from "./ClickWithCaptcha";

interface ClickWithCaptchaWrapperProps {
  linkId: string;
  shortCode: string;
  originalUrl: string;
}

export default function ClickWithCaptchaWrapper({ linkId, shortCode, originalUrl }: ClickWithCaptchaWrapperProps) {
  return (
    <ClickWithCaptcha
      linkId={linkId}
      shortCode={shortCode}
      onSuccess={() => {
        window.location.href = originalUrl;
      }}
    />
  );
}

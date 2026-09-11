"use client";

import * as React from "react";
import {
  CONTENT,
  DZERP_WHATSAPP_NUMBER,
  WHATSAPP_DEFAULT_MESSAGE,
} from "@/components/landing/content";
import { useI18n } from "@/features/i18n/i18n-provider";

export function FloatingWhatsApp() {
  const { locale } = useI18n();
  const c = CONTENT[locale];
  const href = `https://wa.me/${DZERP_WHATSAPP_NUMBER.replace("+", "")}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={c.whatsapp.label}
      title={c.footer.whatsappLabel}
      className="group fixed bottom-5 end-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105"
    >
      <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
        chat
      </span>
    </a>
  );
}
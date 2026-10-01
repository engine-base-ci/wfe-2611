// Kaname の印（06_mockup/_icons.py の LOGO と同じ形）。色は親の文字色（currentColor）
export function KanameMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M12 12 3 5M12 12 3 12M12 12 5 20M12 12l9-7M12 12h9M12 12l7 8" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

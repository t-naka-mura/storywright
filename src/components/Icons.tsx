interface IconProps {
  size?: number | string;
  className?: string;
}

/** ● 記録インジケータ（塗りつぶし円） */
export function RecordIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <circle cx="8" cy="8" r="6" />
    </svg>
  );
}

/** ■ 停止ボタン（塗りつぶし四角） */
export function StopIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <rect x="3" y="3" width="10" height="10" rx="1" />
    </svg>
  );
}

/** ▶ 再生ボタン（三角） */
export function PlayIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M4.5 2.5L13 8L4.5 13.5V2.5Z" />
    </svg>
  );
}

/** ✓ チェックマーク */
export function CheckIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 8.5L6.5 12L13 4" />
    </svg>
  );
}

/** ✗ バツマーク（失敗） */
export function CrossIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={className}>
      <path d="M4 4L12 12M12 4L4 12" />
    </svg>
  );
}

/** ✕ 閉じるボタン */
export function CloseIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M4 4L12 12M12 4L4 12" />
    </svg>
  );
}

/** ⠿ ドラッグハンドル（6ドット） */
export function DragHandleIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <circle cx="5.5" cy="3.5" r="1.5" />
      <circle cx="10.5" cy="3.5" r="1.5" />
      <circle cx="5.5" cy="8" r="1.5" />
      <circle cx="10.5" cy="8" r="1.5" />
      <circle cx="5.5" cy="12.5" r="1.5" />
      <circle cx="10.5" cy="12.5" r="1.5" />
    </svg>
  );
}

/** ⧉ 複製ボタン（重なった四角） */
export function DuplicateIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V3.5C10.5 2.67 9.83 2 9 2H3.5C2.67 2 2 2.67 2 3.5V9C2 9.83 2.67 10.5 3.5 10.5H5.5" />
    </svg>
  );
}

/** 🔒 ロックアイコン（機密値） */
export function LockIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** 🌐 地球アイコン（空状態） */
export function GlobeIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={className}>
      <circle cx="8" cy="8" r="6.5" />
      <ellipse cx="8" cy="8" rx="3" ry="6.5" />
      <path d="M1.5 8H14.5" />
      <path d="M2.5 4.5H13.5" />
      <path d="M2.5 11.5H13.5" />
    </svg>
  );
}

/** ✅ チェック付き円（リピート成功） */
export function CheckCircleIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 8L7 10.5L11.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** ⚠️ 警告アイコン（リピート失敗あり） */
export function WarningIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M7.13 1.66a1 1 0 0 1 1.74 0l6 10.5A1 1 0 0 1 14 13.5H2a1 1 0 0 1-.87-1.34l6-10.5Z" />
      <rect x="7.25" y="5.5" width="1.5" height="4" rx="0.75" fill="white" />
      <circle cx="8" cy="11.25" r="0.85" fill="white" />
    </svg>
  );
}

/** ⏳ 砂時計アイコン（実行中） */
export function HourglassIcon({ size = "1em", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 1.5H12" />
      <path d="M4 14.5H12" />
      <path d="M5 1.5C5 5 8 7 8 8C8 9 5 11 5 14.5" />
      <path d="M11 1.5C11 5 8 7 8 8C8 9 11 11 11 14.5" />
    </svg>
  );
}

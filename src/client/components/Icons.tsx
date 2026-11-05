import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'copy'
  | 'crown'
  | 'chat'
  | 'scroll'
  | 'users'
  | 'shuffle'
  | 'move'
  | 'close'
  | 'arrow-right'
  | 'door'
  | 'wifi'
  | 'wifi-off'
  | 'spark'
  | 'cards'
  | 'check'
  | 'alert'
  | 'eye'
  | 'hand'
  | 'shield'
  | 'scale'
  | 'link';

const PATHS: Record<IconName, ReactNode> = {
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>
  ),
  crown: (
    <>
      <path d="M3 8l4 3 5-7 5 7 4-3-2 11H5L3 8Z" />
      <path d="M5 19h14" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
      <path d="M8 11h8M8 15h5" />
    </>
  ),
  scroll: (
    <>
      <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M18 14c2 .8 3 2.7 3 5" />
    </>
  ),
  shuffle: (
    <>
      <path d="M3 6h3c5 0 7 12 12 12h3" />
      <path d="M3 18h3c2 0 3.4-2 5-4.6C12.7 10.6 14.3 6 18 6h3" />
      <path d="m18 3 3 3-3 3M18 15l3 3-3 3" />
    </>
  ),
  move: (
    <>
      <path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" />
    </>
  ),
  close: <path d="m5 5 14 14M19 5 5 19" />,
  'arrow-right': (
    <>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </>
  ),
  door: (
    <>
      <path d="M5 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" />
      <path d="M3 21h18M14 12h.01" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.5 8.5a15 15 0 0 1 19 0M5.5 12a10 10 0 0 1 13 0M8.5 15.5a5 5 0 0 1 7 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  'wifi-off': (
    <>
      <path d="m3 3 18 18" />
      <path d="M8.5 15.5a5 5 0 0 1 5.6-1" />
      <path d="M5.5 12a10 10 0 0 1 3-.3M15.5 11.7a10 10 0 0 1 3 .3M2.5 8.5a15 15 0 0 1 4-2M11 6.1a15 15 0 0 1 10.5 2.4" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
    </>
  ),
  cards: (
    <>
      <rect x="7" y="4" width="12" height="17" rx="2" />
      <path d="M5 7H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h9" />
      <path d="M13 9v7M10 12.5h6" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  hand: (
    <>
      <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M11 10V4.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M14 10V5.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M17 9.5a1.5 1.5 0 0 1 3 0V15c0 4-3 6-7 6s-6-2-7-5l-2-3a1.6 1.6 0 0 1 2.7-1.7L8 14" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5c0 5 3.2 8.4 7.5 10 4.3-1.6 7.5-5 7.5-10V6L12 3Z" />
      <path d="m8.5 12 2.3 2.3 4.7-5" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v18M7 21h10M5 6h14" />
      <path d="m5 6-2.5 5a3 3 0 0 0 5 0L5 6ZM19 6l-2.5 5a3 3 0 0 0 5 0L19 6Z" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

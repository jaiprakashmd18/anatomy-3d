import React from 'react';
const S = (p: { children: React.ReactNode }) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{p.children}</svg>);
export const Icons: Record<string, React.ReactNode> = {
  probe: <S><path d="M4 20 15 9" /><path d="M15 9l3-3 2 2-3 3z" /><circle cx="5" cy="19" r="1" /></S>,
  scalpel: <S><path d="M3 21 14 10" /><path d="M14 10 20 4l-1 6-5 3z" /></S>,
  scissors: <S><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8 8l12 9M8 16 20 7" /></S>,
  forceps: <S><path d="M4 20 12 4M20 20 12 4" /><path d="M10 9h4" /></S>,
  retractor: <S><path d="M5 4v10a4 4 0 0 0 4 4h8" /><path d="M17 14l3 4-3 4" /></S>,
  peel: <S><path d="M4 16c6 0 6-8 12-8h4" /><path d="M4 20c8 0 8-10 16-10" /></S>,
  reflect: <S><path d="M4 18V8l8-4 8 4" /><path d="M12 12l8 6" /></S>,
  pin: <S><path d="M12 21v-7" /><circle cx="12" cy="8" r="4" /></S>,
  isolate: <S><rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="3 3" /><circle cx="12" cy="12" r="3" /></S>,
  transparency: <S><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></S>,
  undo: <S><path d="M9 7 4 12l5 5" /><path d="M4 12h10a6 6 0 0 1 0 12" transform="translate(0 -4)" /></S>,
  redo: <S><path d="m15 7 5 5-5 5" /><path d="M20 12H10a6 6 0 0 0 0 12" transform="translate(0 -4)" /></S>,
  reset: <S><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></S>,
};

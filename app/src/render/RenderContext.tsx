import { createContext, useContext, type PropsWithChildren } from 'react';
import type { Colors } from '@/theme';

export type RenderCtx = { fontSize: number; colors: Colors; terms: string[]; onLink: (href: string) => void; onImage: (src: string) => void };

const Ctx = createContext<RenderCtx | null>(null);

export function RenderProvider({ value, children }: PropsWithChildren<{ value: RenderCtx }>) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRenderCtx(): RenderCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRenderCtx outside RenderProvider');
  return c;
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistConfig } from './persistConfig';

export type Contact = { name: string; phone: string };
export type EmergencyCard = { name: string; bloodType: string; allergies: string; medications: string; conditions: string; contacts: Contact[]; notes: string };
type EmergencyState = { card: EmergencyCard; update: (patch: Partial<EmergencyCard>) => void; clear: () => void };

export const emptyCard: EmergencyCard = { name: '', bloodType: '', allergies: '', medications: '', conditions: '', contacts: [], notes: '' };

export const hasCard = (c: EmergencyCard) =>
  [c.name, c.bloodType, c.allergies, c.medications, c.conditions, c.notes].some((v) => v.trim() !== '') ||
  c.contacts.some((x) => x.name.trim() !== '' || x.phone.trim() !== '');

export const useEmergency = create<EmergencyState>()(
  persist(
    (set) => ({
      card: emptyCard,
      update: (patch) => set((s) => ({ card: { ...s.card, ...patch } })),
      clear: () => set({ card: emptyCard }),
    }),
    persistConfig<EmergencyState>('emergency'),
  ),
);

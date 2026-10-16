import store from 'expo-sqlite/kv-store';

export const kv: {
  getItem(name: string): Promise<string | null> | string | null;
  setItem(name: string, value: string): Promise<void> | void;
  removeItem(name: string): Promise<void> | void;
} = store;

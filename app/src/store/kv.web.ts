// expo-sqlite on web needs COOP/COEP headers that static hosts can't set, so web uses localStorage.
export const kv = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => localStorage.setItem(name, value),
  removeItem: (name: string) => localStorage.removeItem(name),
};

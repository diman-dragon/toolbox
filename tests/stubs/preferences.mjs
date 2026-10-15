const mem = new Map();
export const Preferences = {
  async get({ key }) { return { value: mem.has(key) ? mem.get(key) : null }; },
  async set({ key, value }) { mem.set(key, value); },
  async remove({ key }) { mem.delete(key); },
  async keys() { return { keys: [...mem.keys()] }; },
};

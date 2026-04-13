import { writable } from "svelte/store";

export type SettingsSection = "appearance" | "developer" | "about";

type SettingsUiState = {
  open: boolean;
  section: SettingsSection;
};

const initialState: SettingsUiState = {
  open: false,
  section: "appearance"
};

function createSettingsUiStore() {
  const store = writable<SettingsUiState>(initialState);

  return {
    subscribe: store.subscribe,
    openSettings(section: SettingsSection = "appearance") {
      store.set({ open: true, section });
    },
    closeSettings() {
      store.update((state) => ({ ...state, open: false }));
    },
    setSection(section: SettingsSection) {
      store.update((state) => ({ ...state, section }));
    }
  };
}

export const settingsUi = createSettingsUiStore();

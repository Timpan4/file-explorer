import { writable } from "svelte/store";

export type ThemePreference = "system" | "light" | "dark";

export type SettingsState = {
  themePreference: ThemePreference;
  artificialNavDelayMs: number;
};

const STORAGE_KEY = "file-explorer.settings.v1";
const DEFAULT_DELAY = parseDelay(import.meta.env.VITE_EXPLORER_NAV_DELAY_MS);

const defaults: SettingsState = {
  themePreference: "system",
  artificialNavDelayMs: DEFAULT_DELAY
};

function createSettingsStore() {
  const store = writable<SettingsState>(loadInitialState());

  store.subscribe((state) => {
    if (typeof window === "undefined") {
      return;
    }

    applyThemePreference(state.themePreference);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  });

  return {
    subscribe: store.subscribe,
    setThemePreference(themePreference: ThemePreference) {
      store.update((state) => ({ ...state, themePreference }));
    },
    setArtificialNavDelayMs(artificialNavDelayMs: number) {
      store.update((state) => ({
        ...state,
        artificialNavDelayMs: clampDelay(artificialNavDelayMs)
      }));
    },
    reset() {
      store.set(defaults);
    }
  };
}

function loadInitialState(): SettingsState {
  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      applyThemePreference(defaults.themePreference);
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    const state: SettingsState = {
      themePreference: isThemePreference(parsed.themePreference) ? parsed.themePreference : defaults.themePreference,
      artificialNavDelayMs: clampDelay(parsed.artificialNavDelayMs ?? defaults.artificialNavDelayMs)
    };

    applyThemePreference(state.themePreference);
    return state;
  } catch {
    applyThemePreference(defaults.themePreference);
    return defaults;
  }
}

function applyThemePreference(themePreference: ThemePreference) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  if (themePreference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", themePreference);
  }
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function parseDelay(rawValue: string | undefined) {
  const parsed = Number.parseInt(rawValue ?? "0", 10);
  return clampDelay(parsed);
}

function clampDelay(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.min(5000, Math.round(value));
}

export const settings = createSettingsStore();

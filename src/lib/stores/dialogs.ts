import { writable } from "svelte/store";

export type ConfirmTone = "default" | "warning" | "danger";

export type ConfirmOptions = {
  title: string;
  message: string;
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

export type ConfirmDialogState = {
  open: boolean;
  title: string;
  message: string;
  details?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
};

const initialState: ConfirmDialogState = {
  open: false,
  title: "",
  message: "",
  details: undefined,
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  tone: "default"
};

function createDialogsStore() {
  const store = writable<ConfirmDialogState>(initialState);
  let pendingResolver: ((value: boolean) => void) | null = null;

  function confirm(options: ConfirmOptions) {
    if (pendingResolver) {
      pendingResolver(false);
      pendingResolver = null;
    }

    store.set({
      open: true,
      title: options.title,
      message: options.message,
      details: options.details,
      confirmLabel: options.confirmLabel ?? "Confirm",
      cancelLabel: options.cancelLabel ?? "Cancel",
      tone: options.tone ?? "default"
    });

    return new Promise<boolean>((resolve) => {
      pendingResolver = resolve;
    });
  }

  function resolve(result: boolean) {
    if (pendingResolver) {
      pendingResolver(result);
      pendingResolver = null;
    }

    store.set(initialState);
  }

  return {
    subscribe: store.subscribe,
    confirm,
    confirmAction() {
      resolve(true);
    },
    cancel() {
      resolve(false);
    }
  };
}

export const dialogs = createDialogsStore();
export const confirm = dialogs.confirm;

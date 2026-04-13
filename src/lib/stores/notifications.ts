import { writable } from "svelte/store";

export type NotificationKind = "info" | "success" | "warning" | "error";

export type NotificationAction = {
  label: string;
  onAction: () => void;
};

export type Notification = {
  id: string;
  kind: NotificationKind;
  title?: string;
  message: string;
  durationMs: number;
  dismissible: boolean;
  action?: NotificationAction;
};

export type NotificationInput = {
  title?: string;
  message: string;
  durationMs?: number;
  dismissible?: boolean;
  action?: NotificationAction;
};

const DEFAULT_DURATIONS: Record<NotificationKind, number> = {
  info: 3000,
  success: 3000,
  warning: 4500,
  error: 4500
};

function createNotificationsStore() {
  const store = writable<Notification[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function push(kind: NotificationKind, input: NotificationInput) {
    const id = createNotificationId();
    const notification: Notification = {
      id,
      kind,
      title: input.title,
      message: input.message,
      durationMs: input.durationMs ?? DEFAULT_DURATIONS[kind],
      dismissible: input.dismissible ?? true,
      action: input.action
    };

    store.update((items) => [...items, notification]);

    if (notification.durationMs > 0) {
      const timer = setTimeout(() => {
        dismiss(id);
      }, notification.durationMs);

      timers.set(id, timer);
    }

    return id;
  }

  function dismiss(id: string) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }

    store.update((items) => items.filter((item) => item.id !== id));
  }

  function clear() {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }

    timers.clear();
    store.set([]);
  }

  return {
    subscribe: store.subscribe,
    push,
    dismiss,
    clear
  };
}

function createNotificationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const notifications = createNotificationsStore();

export const notify = {
  info(message: string, options: Omit<NotificationInput, "message"> = {}) {
    return notifications.push("info", { ...options, message });
  },
  success(message: string, options: Omit<NotificationInput, "message"> = {}) {
    return notifications.push("success", { ...options, message });
  },
  warning(message: string, options: Omit<NotificationInput, "message"> = {}) {
    return notifications.push("warning", { ...options, message });
  },
  error(message: string, options: Omit<NotificationInput, "message"> = {}) {
    return notifications.push("error", { ...options, message });
  },
  custom(kind: NotificationKind, input: NotificationInput) {
    return notifications.push(kind, input);
  }
};

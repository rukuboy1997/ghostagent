import { EventEmitter } from "events";

// In-process pub/sub for SSE notifications
export const notificationBus = new EventEmitter();
notificationBus.setMaxListeners(200);

export function emitSignalNotification(userId, payload) {
  notificationBus.emit(`signal:${userId}`, payload);
  notificationBus.emit("signal:*", { userId, ...payload });
}

export function emitSystemNotification(payload) {
  notificationBus.emit("system", payload);
}

"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

export function getSocket(auth: Record<string, string> = {}): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`;
    socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      auth,
    });
  } else if (Object.keys(auth).length) {
    socket.auth = auth;
    if (socket.connected) socket.disconnect().connect();
  }
  return socket;
}

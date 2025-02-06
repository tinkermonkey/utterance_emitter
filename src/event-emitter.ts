import { EventCallback, EventListeners } from './types';

export class EventEmitter {
    private listeners: EventListeners = {};

    on(event: string, listener: EventCallback): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }

    off(event: string, listener: EventCallback): void {
        if (!this.listeners[event]) return;

        this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    }

    emit(event: string, ...args: any[]): void {
        if (!this.listeners[event]) return;

        this.listeners[event].forEach(listener => listener(...args));
    }
}
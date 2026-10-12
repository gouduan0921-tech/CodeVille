/**
 * 轻量事件总线。接口刻意对齐 socket.io-client（on / off / emit），
 * MVP 阶段在进程内转发；接入真实后端时可直接替换为 `io(url)`。
 */
export type Handler = (payload?: any) => void;

export class Bus {
  private map = new Map<string, Set<Handler>>();
  on(event: string, fn: Handler) {
    let set = this.map.get(event);
    if (!set) this.map.set(event, (set = new Set()));
    set.add(fn);
    return this;
  }
  off(event: string, fn?: Handler) {
    if (!fn) this.map.delete(event);
    else this.map.get(event)?.delete(fn);
    return this;
  }
  emit(event: string, payload?: any) {
    this.map.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error('[bus]', event, e);
      }
    });
    return this;
  }
}

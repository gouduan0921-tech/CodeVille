import type { Nav } from './layout.ts';

/** 四向 A*。起点/终点所在格即使被家具占用（沙发等）也允许进出。*/
export function findPath(nav: Nav, sx: number, sy: number, gx: number, gy: number): [number, number][] | null {
  const { cols, rows, blocked } = nav;
  if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return null;
  if (sx === gx && sy === gy) return [];
  const N = cols * rows;
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const start = sy * cols + sx;
  const goal = gy * cols + gx;
  const h = (i: number) => Math.abs((i % cols) - gx) + Math.abs(Math.floor(i / cols) - gy);
  // 简易二叉堆（按 f 值）
  const heap: number[] = [];
  const f = new Float32Array(N).fill(Infinity);
  const push = (i: number) => {
    heap.push(i);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (f[heap[p]] <= f[heap[c]]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop() as number;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  g[start] = 0;
  f[start] = h(start);
  push(start);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (heap.length) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) {
      const path: [number, number][] = [];
      let c = cur;
      while (c !== start) {
        path.push([c % cols, Math.floor(c / cols)]);
        c = from[c];
      }
      return path.reverse();
    }
    const cx = cur % cols;
    const cy = Math.floor(cur / cols);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (closed[ni]) continue;
      if (blocked[ni] && ni !== goal) continue;
      const ng = g[cur] + 1;
      if (ng < g[ni]) {
        g[ni] = ng;
        from[ni] = cur;
        f[ni] = ng + h(ni);
        push(ni);
      }
    }
  }
  return null;
}

/** 从某格出发可达的格子集合（仅走非阻塞格） */
export function reachable(nav: Nav, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(nav.cols * nav.rows);
  const q: number[] = [sy * nav.cols + sx];
  seen[q[0]] = 1;
  while (q.length) {
    const c = q.pop() as number;
    const cx = c % nav.cols;
    const cy = Math.floor(c / nav.cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= nav.cols || ny >= nav.rows) continue;
      const ni = ny * nav.cols + nx;
      if (seen[ni] || nav.blocked[ni]) continue;
      seen[ni] = 1;
      q.push(ni);
    }
  }
  return seen;
}

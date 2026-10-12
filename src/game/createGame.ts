import * as Phaser from 'phaser';
import type { Engine } from '../core/engine.ts';
import { OfficeScene } from './OfficeScene.ts';
import type { EditorState, SceneHooks } from './OfficeScene.ts';

export interface GameHandle {
  scene: OfficeScene;
  destroy(): void;
  fit(): void;
  zoomBy(f: number): void;
  select(id: string | null): void;
  setBubbleMode(m: 'full' | 'mini'): void;
  editor: {
    enter(): void;
    exit(save: boolean): void;
    place(type: string | null): void;
    remove(): void;
    undo(): void;
    setTag(tag: string): void;
    reset(): void;
    export(): string;
    import(json: string): boolean;
  };
}

export type { EditorState };

export async function createGame(parent: HTMLElement, engine: Engine, hooks: SceneHooks): Promise<GameHandle> {
  try {
    await Promise.all([document.fonts.load('10px CVPixel'), document.fonts.load('10px CVPress')]);
  } catch {
    /* 字体失败不阻塞，使用回退字体 */
  }
  const scene = new OfficeScene(engine, hooks);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0a0a0f',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    input: { keyboard: false, mouse: { preventDefaultWheel: true }, touch: { capture: true } },
    disableContextMenu: true,
    scene,
  });
  return {
    scene,
    destroy() {
      scene.destroyOverlay();
      game.destroy(true);
    },
    fit: () => scene.fit(),
    zoomBy: (f) => scene.zoomBy(f),
    select: (id) => scene.select(id),
    setBubbleMode: (m) => {
      if (scene.overlay) scene.overlay.bubbleMode = m;
    },
    editor: {
      enter: () => scene.editorEnter(),
      exit: (s) => scene.editorExit(s),
      place: (t) => scene.editorPlace(t),
      remove: () => scene.editorDelete(),
      undo: () => scene.editorUndo(),
      setTag: (t) => scene.editorSetTag(t),
      reset: () => scene.editorReset(),
      export: () => scene.editorExport(),
      import: (j) => scene.editorImport(j),
    },
  };
}

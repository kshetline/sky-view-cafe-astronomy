import { strokeCircle, strokeLine } from '@tubular/util';
import sortBy from 'lodash-es/sortBy';

enum DrawAction {FILLED_RECT, LINE, CIRCLE, RECT}

interface ZBufferItem {
  action: DrawAction;
  color: string;
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  w?: number;
  h?: number;
  r?: number;
  z: number;
  heavy?: boolean;
}

export class ZBuffer {
  private items: ZBufferItem[] = [];
  private sorted = true;

  clear(): void {
    this.items = [];
    this.sorted = true;
  }

  addFilledRect(color: string, x: number, y: number, w: number, h: number, z: number): void {
    this.items.push({
      action: DrawAction.FILLED_RECT,
      color,
      x1: x,
      y1: y,
      w, h, z
    });
    this.sorted = false;
  }

  addLine(color: string, x1: number, y1: number, x2: number, y2: number, z: number, heavy = false): void {
    this.items.push({
      action: DrawAction.LINE,
      color, x1, y1, x2, y2, z, heavy
    });
    this.sorted = false;
  }

  addCircle(color: string, x: number, y: number, r: number, z: number): void {
    this.items.push({
      action: DrawAction.CIRCLE,
      color,
      x1: x,
      y1: y,
      r,
      z
    });
    this.sorted = false;
  }

  addRect(color: string, x: number, y: number, w: number, h: number, z: number): void {
    this.items.push({
      action: DrawAction.RECT,
      color,
      x1: x,
      y1: y,
      w, h, z
    });
    this.sorted = false;
  }

  draw(context: CanvasRenderingContext2D, maxZ = Number.MAX_VALUE): void {
    if (!this.sorted) {
      this.items = sortBy(this.items, [(item: ZBufferItem): number => item.z]);
      this.sorted = true;
    }

    for (const item of this.items) {
      if (item.z >= maxZ)
        break;

      if (item.heavy)
        context.lineWidth = 2.5;

      switch (item.action) {
        case DrawAction.FILLED_RECT:
          context.fillStyle = item.color;
          context.fillRect(item.x1, item.y1, item.w, item.h);
          break;

        case DrawAction.LINE:
          context.strokeStyle = item.color;
          strokeLine(context, item.x1, item.y1, item.x2, item.y2);
          break;

        case DrawAction.CIRCLE:
          context.strokeStyle = item.color;
          strokeCircle(context, item.x1, item.y1, item.r);
          break;

        case DrawAction.RECT:
          context.strokeStyle = item.color;
          context.strokeRect(item.x1, item.y1, item.w, item.h);
          break;
      }

      if (item.heavy)
        context.lineWidth = 1;
    }
  }
}

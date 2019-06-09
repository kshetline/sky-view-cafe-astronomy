/*
  Copyright © 2017-2019 Kerry Shetline, kerry@shetline.com

  MIT license: https://opensource.org/licenses/MIT

  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
  documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
  rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
  persons to whom the Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
  Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
  WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
  COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { sortBy } from 'lodash';
import { strokeCircle, strokeLine } from 'ks-util';

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

  public clear(): void {
    this.items = [];
    this.sorted = true;
  }

  public addFilledRect(color: string, x: number, y: number, w: number, h: number, z: number): void {
    this.items.push({
      action: DrawAction.FILLED_RECT,
      color: color,
      x1: x,
      y1: y,
      w: w,
      h: h,
      z: z
    });
    this.sorted = false;
  }

  public addLine(color: string, x1: number, y1: number, x2: number, y2: number, z: number, heavy = false): void {
    this.items.push({
      action: DrawAction.LINE,
      color: color,
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      z: z,
      heavy: heavy
    });
    this.sorted = false;
  }

  public addCircle(color: string, x: number, y: number, r: number, z: number): void {
    this.items.push({
      action: DrawAction.CIRCLE,
      color: color,
      x1: x,
      y1: y,
      r: r,
      z: z
    });
    this.sorted = false;
  }

  public addRect(color: string, x: number, y: number, w: number, h: number, z: number): void {
    this.items.push({
      action: DrawAction.RECT,
      color: color,
      x1: x,
      y1: y,
      w: w,
      h: h,
      z: z
    });
    this.sorted = false;
  }

  public draw(context: CanvasRenderingContext2D, maxZ = Number.MAX_VALUE): void {
    if (!this.sorted) {
      this.items = sortBy(this.items, [(item: ZBufferItem) => { return item.z; }]);
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

/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com.

  This code is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This code is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this code.  If not, see <http://www.gnu.org/licenses/>.

  For commercial, proprietary, or other uses not compatible with
  GPL-3.0-or-later, terms of licensing for this code may be
  negotiated by contacting the author, Kerry Shetline, otherwise all
  other uses are restricted.
*/

import { asin, floor, limitNeg1to1, max, min, mod, PI, round, sqrt, tan_deg } from '../util/ks-math';
import { fillEllipse, getPixel, setPixel } from '../util/ks-util';

export abstract class PlanetDrawer {
  protected scaledCylinderCanvas: HTMLCanvasElement;
  protected scaledCylinderPixels: ImageData;
  protected stretchCanvas: HTMLCanvasElement;
  protected spheroidCanvas: HTMLCanvasElement;
  protected spheroidPixels: ImageData;
  protected lastTime = Number.MAX_VALUE;
  protected lastFH: boolean;
  protected lastFV: boolean;
  protected lastRotation: number;
  protected width: number;
  protected height: number;
  protected wc: number;
  protected w2: number;
  protected h2: number;

  constructor(protected baseImage: HTMLImageElement, protected flattening: number, protected defaultColor: string) {
    if (baseImage) {
      this.scaledCylinderCanvas = <HTMLCanvasElement> <any> document.createElement('canvas');
      this.scaledCylinderCanvas.width = 1;
      this.scaledCylinderCanvas.height = 1;
      this.stretchCanvas = <HTMLCanvasElement> <any> document.createElement('canvas');
      this.spheroidCanvas = <HTMLCanvasElement> <any> document.createElement('canvas');
      this.spheroidCanvas.width = 1;
      this.spheroidCanvas.height = 1;
    }
  }

  protected convertTimeToRotation(time_JDE: number): number {
    return 0.0;
  }

  public hasImage(): boolean {
    return !!this.baseImage;
  }

  public resetCachedTime(): void {
    this.lastTime = Number.MAX_VALUE;
  }

  public draw(context: CanvasRenderingContext2D, time_JDE: number, cx: number, cy: number, discWidth: number,
              flipHorizontal: boolean, flipVertical: boolean): void {
    const discHeight = discWidth / this.flattening;

    this.width  = round(discWidth) + 1;
    this.height = round(discHeight) + 1;
    this.w2 = this.width / 2;
    this.h2 = this.height / 2;
    this.wc = floor(this.width * 2);

    if (!this.baseImage) {
      context.fillStyle = this.defaultColor;
      fillEllipse(context, cx + 0.5, cy + 0.5, this.w2 - 1, this.h2 - 1);
    }
    else {
      const rotation = this.convertTimeToRotation(time_JDE);

      if (this.lastTime !== time_JDE || this.width !== this.spheroidCanvas.width || this.height !== this.spheroidCanvas.height ||
          this.lastFH !== flipHorizontal || this.lastFV !== flipVertical || this.lastRotation !== rotation) {
        this.lastTime = time_JDE;
        this.lastFH = flipHorizontal;
        this.lastFV = flipVertical;
        this.lastRotation = rotation;

        if (this.wc !== this.scaledCylinderCanvas.width || this.height !== this.scaledCylinderCanvas.height) {
          const h3 = this.height * 3;
          const h32 = h3 / 2.0;

          this.stretchCanvas.width = this.wc;
          this.stretchCanvas.height = h3;

          let context2 = this.stretchCanvas.getContext('2d');
          const baseImageWidth = this.baseImage.width;
          const baseImageHeight = this.baseImage.height;

          for (let y = 0; y < h3; ++y) {
            const dy1 = limitNeg1to1(((y * h3 / (h3 - 1.0)) - h32) / h32);
            const sy = asin(dy1) / PI * baseImageHeight + floor(baseImageHeight / 2);
            const isy = max(min(floor(sy), baseImageHeight - 1), 0);

            context2.drawImage(this.baseImage, 0, isy, baseImageWidth, 1, 0, y, this.wc, 1);
          }

          this.scaledCylinderCanvas.width = this.wc;
          this.scaledCylinderCanvas.height = this.height;
          context2 = this.scaledCylinderCanvas.getContext('2d');
          context2.drawImage(this.stretchCanvas, 0, 0, this.wc, this.height);
          this.scaledCylinderPixels = context2.getImageData(0, 0, this.wc, this.height);
        }

        if (!this.spheroidPixels || this.width !== this.spheroidPixels.width || this.height !== this.spheroidPixels.height)
          this.spheroidPixels = context.createImageData(max(this.width, 8), max(this.height, 8));

        const sctr = this.wc - rotation * this.wc;
        let dx, dy;
        let x1, x2;
        let xx, yy;
        let pixel;

        for (let y = 0; y < this.height; ++y) {
          dy = (y - this.h2 + 0.5) / this.h2;
          dx = sqrt(1.0 - dy * dy);
          x1 = max(floor(this.w2 - dx * this.w2), 0);
          x2 = min(floor(this.w2 + dx * this.w2), this.width - 1);

          if (flipVertical)
            yy = this.height - 1 - y;
          else
            yy = y;

          for (let x = x1; x <= x2; ++x) {
            pixel = this.getCylinderPixel(x, y, sctr);

            if (flipHorizontal)
              xx = this.width - 1 - x;
            else
              xx = x;

            setPixel(this.spheroidPixels, xx, yy, pixel);
          }
        }

        this.spheroidCanvas.width = this.width;
        this.spheroidCanvas.height = this.height;
        this.spheroidCanvas.getContext('2d').putImageData(this.spheroidPixels, 0, 0);
      }

      context.drawImage(this.spheroidCanvas, cx - round(discWidth / 2.0), cy - round(discHeight / 2.0));
    }
  }

  private getCylinderPixel(x: number, y: number, sctr: number): number {
    const w2 = this.w2;
    const wc = this.wc;
    const dx  =  (x * this.width  / (this.width  - 1.0)) - w2;
    const dy1 = ((y * this.height / (this.height - 1.0)) - this.h2) / this.h2;
    const dy  = dy1 * w2;
    const dr  = sqrt(dx * dx + dy * dy);
    let a, r, g, b;

    if (dr > w2)
      return 0;
    else if (dr > w2 - 1.0)
      a = 0xFF - min(round((dr - w2 + 1.0) * 0xFF), 0xFF);
    else
      a = 0xFF;

    const dxm = sqrt(1.0 - dy1 * dy1);
    const  dx1 = limitNeg1to1(dx / w2 / dxm);
    const shade = 0xFF - floor(0x80 * tan_deg(dr / w2 * 88.0) / 28.64);
    const sx = asin(dx1) / PI * wc / 2.0 + sctr;
    const isx = floor(sx);
    const weight2 = min(round((sx - isx) * 0xFF), 0xFF);
    const weight1 = 0xFF - weight2;
    const pixel1 = getPixel(this.scaledCylinderPixels, mod(isx,     wc), y);
    const pixel2 = getPixel(this.scaledCylinderPixels, mod(isx + 1, wc), y);

    r  = ((pixel1 & 0xFF0000) >> 16) * weight1 / 0xFF;
    g  = ((pixel1 & 0x00FF00) >>  8) * weight1 / 0xFF;
    b  =  (pixel1 & 0x0000FF)        * weight1 / 0xFF;

    r += ((pixel2 & 0xFF0000) >> 16) * weight2 / 0xFF;
    g += ((pixel2 & 0x00FF00) >>  8) * weight2 / 0xFF;
    b +=  (pixel2 & 0x0000FF)        * weight2 / 0xFF;

    r  = r * shade / 0xFF;
    g  = g * shade / 0xFF;
    b  = b * shade / 0xFF;

    const pixel = (a << 24) | (r << 16) | (g << 8) | b;

    return pixel;
  }
}

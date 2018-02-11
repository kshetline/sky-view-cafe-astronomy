/*
  Copyright © 2000-2017 Kerry Shetline, kerry@shetline.com.

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

import { SolarSystem } from '../astronomy/solar-system';
import { abs, Angle, ceil, floor, interpolate, max, round, sqrt, TWO_PI, Unit } from 'ks-math';
import { getPixel, setPixel } from 'ks-util';
import { MOON } from '../astronomy/astro-constants';
import { ISkyObserver } from '../astronomy/i-sky-observer';

export class MoonDrawer {
  private moonPixels: ImageData;
  private canvas: HTMLCanvasElement;
  private scaledBuffer: ImageData;

  public static getMoonDrawer(): Promise<MoonDrawer> {
    return new Promise<MoonDrawer>((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        resolve(new MoonDrawer(image));
      };
      image.onerror = () => {
        reject('Moon image failed to load from: ' + image.src);
      };

      image.src = 'assets/resources/full_moon.jpg';
    });
  }

  constructor(private moonImage: HTMLImageElement) {
    const size = moonImage.width; // height should be identical.
    const canvas = <HTMLCanvasElement> document.createElement('canvas');

    canvas.width = size;
    canvas.height = size;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    const context = canvas.getContext('2d');

    context.drawImage(this.moonImage, 0, 0);
    this.moonPixels = context.getImageData(0, 0, size, size);
  }

  private getPixel(x: number, y: number): number {
    const size = this.moonPixels.width;

    // The upper-left hand corner should be a neutral gray that can be substituted
    // for any off-the-edge pixel requests.
    if (x < 0 || x >= size || y < 0 || y >= size)
      return this.moonPixels.data[0];

    return this.moonPixels.data[(y * size + x) * 4];
  }

  private getPixelLevel(x: number, y: number): number {
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const dx = x - x0;
    const y0 = Math.floor(y);
    const y1 = y0 + 1;
    const dy = y - y0;

    const v0 = this.getPixel(x0, y0) * (1.0 - dx) + this.getPixel(x1, y0) * dx;
    const v1 = this.getPixel(x0, y1) * (1.0 - dx) + this.getPixel(x1, y1) * dx;

    return v0 * (1.0 - dy) + v1 * dy;
  }

  public drawMoon(context: CanvasRenderingContext2D, solarSystem: SolarSystem, time_JDE: number,
                  cx: number, cy: number, size: number, pixelsPerArcSec: number,
                  parallacticAngle?: Angle, observer?: ISkyObserver, showEclipses?: boolean): void {
    const originalImageSize = this.moonPixels.width;

    if (size === 0 && observer)
      size = ceil(solarSystem.getAngularDiameter(MOON, time_JDE, observer) * pixelsPerArcSec);

    // Make sure that the size is odd, so that one pixel can be the exact center of the image.
    size += (size + 1) % 2;

    if (size < 3)
      size = 3;

    const phase = solarSystem.getLunarPhase(time_JDE);
    const illum = solarSystem.getLunarIlluminatedFraction(time_JDE);
    const waxing = phase < 180.0;
    const r0 = floor(size / 2);
    const r2 = round((r0 + 0.5) * (r0 + 0.5));
    let x: number, y: number;
    let xmax: number, xmax2: number;
    let lineWidth;
    let shadowWidth;
    let shadowEdge;
    let gray;
    const parallactic = Boolean(parallacticAngle);
    let sin_pa = 0.0;
    let cos_pa = 1.0;
    let eclipsed = false;
    let u2 = 0; // umbral radius, squared
    let p2 = 0; // penumbral radius, squared
    let sx = 0, sy = 0; // shadow center
    let sdx: number, sdy: number; // offset shadow center
    let pixel: number;

    if (!this.scaledBuffer || this.scaledBuffer.width !== size) {
      this.canvas = <HTMLCanvasElement> document.createElement('canvas');

      this.canvas.width = size;
      this.canvas.height = size;

      const context2 = this.canvas.getContext('2d');

      context2.clearRect(0, 0, size, size);
      context2.beginPath();
      context2.arc(r0 + 0.5, r0 + 0.5, r0, 0, TWO_PI);
      context2.fillStyle = 'white';
      context2.fill();

      this.scaledBuffer = context2.getImageData(0, 0, size, size);
    }

    if (parallactic) {
      sin_pa = parallacticAngle.sin;
      cos_pa = parallacticAngle.cos;
    }

    // I'm going to treat the umbra and penumbra of the Earth as imaginary circular
    // objects directly opposite from the Sun and located at the same distance from
    // the Earth as the Moon.
    //
    // If you can imagine the typical diagram of how umbral and penumbral shadows are
    // cast, I'm simply solving some similar triangles that can be drawn into such a
    // diagram to figure out the size of the Moon-distanced cross-sections of the
    // two types of shadow.

    // If we're near a full moon, it's worth checking for a lunar eclipse, but not otherwise.
    if (showEclipses && abs(phase - 180.0) < 3.0) {
      const ei = solarSystem.getLunarEclipseInfo(time_JDE);

      if (ei.inPenumbra) {
        eclipsed = true;

        const dLon = ei.shadowPos.longitude.subtract(ei.pos.longitude).getAngle(Unit.ARC_SECONDS);
        const dLat = ei.shadowPos.latitude .subtract(ei.pos.latitude ).getAngle(Unit.ARC_SECONDS);

        sx = round((dLon * cos_pa - dLat * sin_pa) * -pixelsPerArcSec);
        sy = round((dLon * sin_pa + dLat * cos_pa) * -pixelsPerArcSec);

        const uRadius = round(ei.umbraRadius * pixelsPerArcSec) + 2;
        const pRadius = round(ei.penumbraRadius * pixelsPerArcSec) + 2;

        u2 = uRadius * uRadius;
        p2 = pRadius * pRadius;
      }
    }

    for (let dy = -r0; dy <= r0; ++dy) {
      xmax = ceil(sqrt(r2 - dy * dy));

      for (let dx = -xmax; dx <= xmax; ++dx) {
        x = dx * cos_pa + dy * sin_pa;
        y = dy * cos_pa - dx * sin_pa;

        gray = this.getPixelLevel((x + r0) * originalImageSize / size,
                                  (y + r0) * originalImageSize / size);

        xmax2 = round(sqrt(max(r2 - y * y, 0)));
        lineWidth = xmax2 * 2 + 1;
        // When the Moon is new, shadowWidth is biased one pixel wider, when full, one pixel narrower, with the
        // bias varying smoothly in between (no bias at all at half-full).
        shadowWidth = lineWidth * (1.0 - illum) - illum * 2.0 + 1.0;

        if (waxing) {
          shadowEdge = -xmax2 + shadowWidth;

          if (x < shadowEdge - 1.0 || illum < 0.02)
            gray /= 5.0;
          else if (x < shadowEdge + 1.0)
            gray /= interpolate(shadowEdge - 1.0, x, shadowEdge + 1.0, 5.0, 1.0);
        }
        else {
          shadowEdge = xmax2 - shadowWidth;

          if (x > shadowEdge + 1.0 || illum < 0.02)
            gray /= 5.0;
          else if (x > shadowEdge - 1.0)
            gray /= interpolate(shadowEdge + 1.0, x, shadowEdge - 1.0, 5.0, 1.0);
        }

        pixel = (getPixel(this.scaledBuffer, r0 + dx, r0 + dy) & 0xFF000000) | (0x010101 * round(gray));

        if (eclipsed) {
          sdx = sx - dx;
          sdy = sy - dy;

          // Are we within the penumbra?
          if (sdx * sdx + sdy * sdy <= p2) {
            // Also within the umbra? Even darker a shadow.
            if (sdx * sdx + sdy * sdy <= u2)
              gray /= 2.5;

            const igray = round(gray);

            // A shading of the moon image, leaning toward orange and brown.
            pixel = (pixel & 0xFF000000) |
                    (      igray        << 16) |
                    (round(igray * 0.8) << 8) |
                     round(igray * 0.5);
          }
        }

        setPixel(this.scaledBuffer, r0 + dx, r0 + dy, pixel);
      }
    }

    this.canvas.getContext('2d').putImageData(this.scaledBuffer, 0, 0);
    context.drawImage(this.canvas, cx - r0, cy - r0);
  }
}

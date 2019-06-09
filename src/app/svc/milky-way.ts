/*
  Copyright © 2017-2019 Kerry Shetline, kerry@shetline.com.

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
import { floor, mod, SphericalPosition } from 'ks-math';
import { isNumber } from 'lodash';

export class MilkyWay {
  private static milkyWayPixels: ImageData;

  static getMilkyWay(): Promise<MilkyWay> {
    return new Promise<MilkyWay>((resolve, reject) => {
      if (MilkyWay.milkyWayPixels)
        resolve(new MilkyWay());
      else {
        const image = new Image();

        image.onload = () => {
          const canvas = <HTMLCanvasElement> document.createElement('canvas');

          canvas.width = image.width;
          canvas.height = image.height;

          const context = canvas.getContext('2d');

          context.drawImage(image, 0, 0);
          this.milkyWayPixels = context.getImageData(0, 0, image.width, image.height);

          resolve(new MilkyWay());
        };
        image.onerror = () => {
          reject('Milky Way image failed to load from: ' + image.src);
        };

        image.src = 'assets/resources/milky_way.jpg';
      }
    });
  }

  private constructor() {
  }

  // noinspection JSMethodCanBeStatic
  getBrightness(posOrLongitude: SphericalPosition | number, latitude?: number): number {
    let longitude: number;

    if (isNumber(posOrLongitude)) {
      longitude = <number> posOrLongitude;
      latitude = (latitude ? latitude : 0);
    }
    else {
      longitude = (<SphericalPosition> posOrLongitude).longitude.degrees;
      latitude = (<SphericalPosition> posOrLongitude).latitude.degrees;
    }

    const w = MilkyWay.milkyWayPixels.width;
    const h = MilkyWay.milkyWayPixels.height;

    longitude = (longitude / 360.0 + 0.5) * w;
    latitude  = -latitude / 360.0 * w + h / 2;

    if (latitude < 0 || latitude >= h)
      return 0;

    const x = mod(floor(longitude), w);
    const y = floor(latitude);
    const offset = (y * w + x) * 4;

    return MilkyWay.milkyWayPixels.data[offset];
  }
}

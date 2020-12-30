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

import { SATURN_FLATTENING } from '@tubular/astronomy';
import { mod } from '@tubular/math';
import { PlanetDrawer } from './planet-drawer';

export class SaturnDrawer extends PlanetDrawer {
  private static saturnImage: HTMLImageElement;

  static getSaturnDrawer(): Promise<SaturnDrawer> {
    return new Promise<SaturnDrawer>((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        this.saturnImage = image;
        resolve(new SaturnDrawer());
      };
      image.onerror = () => {
        reject('Saturn image failed to load from: ' + image.src);
      };

      image.src = 'assets/resources/saturn_cyl.jpg';
    });
  }

  private constructor() {
    super(SaturnDrawer.saturnImage, SATURN_FLATTENING, '#FFFF33');
  }

  protected convertTimeToRotation(time_JDE: number): number {
    // No attempt at great accuracy! This is just here for a rough
    // effect of having Saturn's image rotate at a reasonable rate --
    // a rotation which is difficult to see anyway given the lack of
    // much distinct east/west detail in Saturn's image.
    return mod(time_JDE, 0.44) / 0.44;
  }
}

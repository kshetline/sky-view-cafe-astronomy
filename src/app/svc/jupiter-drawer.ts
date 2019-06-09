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

import { PlanetDrawer } from './planet-drawer';
import { JUPITER_FLATTENING, JupiterInfo } from 'ks-astronomy';
import { AstroDataService } from '../astronomy/astro-data.service';
import { JpegCommentReader } from '../util/ks-read-jpeg-comment';
import { HttpClient } from '@angular/common/http';
import { mod } from 'ks-math';

export class JupiterDrawer extends PlanetDrawer {
  private static jupiterImage: HTMLImageElement;
  private static imageGrsLat = -20.0;
  private static imageGrsLong = 129.5;

  private grsLong = 267.0;

  static getJupiterDrawer(astroDataService: AstroDataService, httpClient: HttpClient): Promise<JupiterDrawer> {
    const jupiterInfoPromise = JupiterInfo.getJupiterInfo(astroDataService);

    if (JupiterDrawer.jupiterImage) {
      jupiterInfoPromise.then((jupiterInfo: JupiterInfo) => new JupiterDrawer(jupiterInfo))
        .catch((reason: any) => Promise.reject('Failed to create JupiterDrawer: ' + reason));
    }

    const commentReader = new JpegCommentReader(httpClient);
    const commentPromise = commentReader.readComment('assets/resources/jupiter_cyl.jpg');
    const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        resolve(image);
      };
      image.onerror = () => {
        reject('Jupiter image failed to load from: ' + image.src);
      };

      image.src = 'assets/resources/jupiter_cyl.jpg';
    });

    return Promise.all([commentPromise, jupiterInfoPromise, imagePromise]).then(([grsPos, jupiterInfo, image]: [string, JupiterInfo, HTMLImageElement]) => {
      this.jupiterImage = image;

      const grsParts = grsPos ? grsPos.split(/=|,/) : [];

      if (grsParts.length === 3) {
        this.imageGrsLong = Number(grsParts[1]);
        this.imageGrsLat = Number(grsParts[2]);
      }

      return new JupiterDrawer(jupiterInfo);
    }).catch((reason: any) => {
      return Promise.reject('Failed to create JupiterDrawer: ' + reason);
    });
  }

  // noinspection JSMethodCanBeStatic
  getGrsLatitude(): number {
    return JupiterDrawer.imageGrsLat;
  }

  getJupiterInfo(): JupiterInfo {
    return this.jupiterInfo;
  }

  private constructor(private jupiterInfo: JupiterInfo) {
    super(JupiterDrawer.jupiterImage, JUPITER_FLATTENING, '#FFCC66');
  }

  protected convertTimeToRotation(time_JDE: number): number {
    const angle = this.jupiterInfo.getSystemIILongitude(time_JDE).degrees -
                    this.jupiterInfo.getGRSLongitude(time_JDE).degrees - JupiterDrawer.imageGrsLong;

    return mod(angle, 360.0) / 360.0;
  }
}

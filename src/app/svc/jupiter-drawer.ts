import { HttpClient } from '@angular/common/http';
import { JUPITER_FLATTENING, JupiterInfo } from '@tubular/astronomy';
import { mod } from '@tubular/math';
import { AstroDataService } from '../astronomy/astro-data.service';
import { JpegCommentReader } from '../util/ks-read-jpeg-comment';
import { PlanetDrawer } from './planet-drawer';

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

      const grsParts = grsPos ? grsPos.split(/[=,]/) : [];

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

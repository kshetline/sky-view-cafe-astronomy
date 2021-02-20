import { floor, mod, SphericalPosition } from '@tubular/math';
import { isNumber } from 'lodash-es';

export class MilkyWay {
  private static milkyWayPixels: ImageData;

  static getMilkyWay(): Promise<MilkyWay> {
    return new Promise<MilkyWay>((resolve, reject) => {
      if (MilkyWay.milkyWayPixels)
        resolve(new MilkyWay());
      else {
        const image = new Image();

        image.onload = (): void => {
          const canvas = <HTMLCanvasElement> document.createElement('canvas');

          canvas.width = image.width;
          canvas.height = image.height;

          const context = canvas.getContext('2d');

          context.drawImage(image, 0, 0);
          this.milkyWayPixels = context.getImageData(0, 0, image.width, image.height);

          resolve(new MilkyWay());
        };
        image.onerror = (): void => {
          reject(new Error('Milky Way image failed to load from: ' + image.src));
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
      latitude = latitude || 0;
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

import { SATURN_FLATTENING } from '@tubular/astronomy';
import { mod } from '@tubular/math';
import { PlanetDrawer } from './planet-drawer';

export class SaturnDrawer extends PlanetDrawer {
  private static saturnImage: HTMLImageElement;

  static getSaturnDrawer(): Promise<SaturnDrawer> {
    return new Promise<SaturnDrawer>((resolve, reject) => {
      const image = new Image();

      image.onload = (): void => {
        this.saturnImage = image;
        resolve(new SaturnDrawer());
      };
      image.onerror = (): void => {
        reject(new Error('Saturn image failed to load from: ' + image.src));
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

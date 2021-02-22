import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AsteroidCometInfo, IAstroDataService } from '@tubular/astronomy';

@Injectable()
export class AstroDataService implements IAstroDataService {
  private static starData: ArrayBuffer;
  private static starDataPromise: Promise<ArrayBuffer>;
  private static grsData: ArrayBuffer;
  private static grsDataPromise: Promise<ArrayBuffer>;
  private static asteroidData: AsteroidCometInfo[];
  private static asteroidDataPromise: Promise<AsteroidCometInfo[]>;
  private static cometData: AsteroidCometInfo[];
  private static cometDataPromise: Promise<AsteroidCometInfo[]>;

  constructor(private httpClient: HttpClient) {
  }

  getStars(): Promise<ArrayBuffer> {
    if (AstroDataService.starData)
      return Promise.resolve(AstroDataService.starData);
    else if (AstroDataService.starDataPromise)
      return AstroDataService.starDataPromise;

    AstroDataService.starDataPromise = this.httpClient.get('/assets/resources/stars.dat', { responseType: 'arraybuffer' }).toPromise().then(data => {
      AstroDataService.starData = data;

      return AstroDataService.starData;
    });

    return AstroDataService.starDataPromise;
  }

  getGrsData(): Promise<ArrayBuffer> {
    if (AstroDataService.grsData)
      return Promise.resolve(AstroDataService.grsData);
    else if (AstroDataService.grsDataPromise)
      return AstroDataService.grsDataPromise;

    AstroDataService.grsDataPromise = this.httpClient.get('/assets/resources/grs_longitude.txt', { responseType: 'arraybuffer' }).toPromise().then(data => {
      AstroDataService.grsData = data;

      return AstroDataService.grsData;
    });

    return AstroDataService.grsDataPromise;
  }

  getAsteroidData(): Promise<AsteroidCometInfo[]> {
    if (AstroDataService.asteroidData)
      return Promise.resolve(AstroDataService.asteroidData);
    else if (AstroDataService.asteroidDataPromise)
      return AstroDataService.asteroidDataPromise;

    AstroDataService.asteroidDataPromise =  this.httpClient.get<AsteroidCometInfo[]>('/assets/resources/asteroids.json').toPromise().then(data => {
      AstroDataService.asteroidData = data;

      return AstroDataService.asteroidData;
    });

    return AstroDataService.asteroidDataPromise;
  }

  getCometData(): Promise<AsteroidCometInfo[]> {
    if (AstroDataService.cometData)
      return Promise.resolve(AstroDataService.cometData);
    else if (AstroDataService.cometDataPromise)
      return AstroDataService.cometDataPromise;

    AstroDataService.cometDataPromise = this.httpClient.get<AsteroidCometInfo[]>('/assets/resources/comets.json').toPromise().then(data => {
      AstroDataService.cometData = data;

      return AstroDataService.cometData;
    });

    return AstroDataService.cometDataPromise;
  }
}

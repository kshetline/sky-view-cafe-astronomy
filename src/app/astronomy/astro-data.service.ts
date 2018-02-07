/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com

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

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AsteroidCometInfo } from './solar-system';

@Injectable()
export class AstroDataService {
  private static starData: ArrayBuffer;
  private static grsData: ArrayBuffer;
  private static asteroidData: AsteroidCometInfo[];
  private static cometData: AsteroidCometInfo[];

  constructor(private httpClient: HttpClient) {
  }

  public getStars(): Promise<ArrayBuffer> {
    if (AstroDataService.starData)
      return Promise.resolve(AstroDataService.starData);

    return this.httpClient.get('/assets/resources/stars.dat', {responseType: 'arraybuffer'}).toPromise().then(data => {
      AstroDataService.starData = data;

      return AstroDataService.starData;
    });
  }

  public getGrsData(): Promise<ArrayBuffer> {
    if (AstroDataService.grsData)
      return Promise.resolve(AstroDataService.grsData);

    return this.httpClient.get('/assets/resources/grs_longitude.txt', {responseType: 'arraybuffer'}).toPromise().then(data => {
      AstroDataService.grsData = data;

      return AstroDataService.grsData;
    });
  }

  public getAsteroidData(): Promise<AsteroidCometInfo[]> {
    if (AstroDataService.asteroidData)
      return Promise.resolve(AstroDataService.asteroidData);

    return this.httpClient.get<AsteroidCometInfo[]>('/assets/resources/asteroids.json').toPromise().then(data => {
      AstroDataService.asteroidData = data;

      return AstroDataService.asteroidData;
    });
  }

  public getCometData(): Promise<AsteroidCometInfo[]> {
    if (AstroDataService.cometData)
      return Promise.resolve(AstroDataService.cometData);

    return this.httpClient.get<AsteroidCometInfo[]>('/assets/resources/comets.json').toPromise().then(data => {
      AstroDataService.cometData = data;

      return AstroDataService.cometData;
    });
  }
}

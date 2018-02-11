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

import { AstroDataService } from './astro-data.service';
import { Angle, asin_deg, cos_deg, interpolateTabular, limitNeg1to1, sign, sin_deg, sqrt, squared, Unit } from 'ks-math';
import { KsArrayBufferReader } from '../util/ks-array-buffer-reader';
import { KsDateTime } from '../util/ks-date-time';
import { isNumber, isUndefined } from 'util';
import { JD_J2000 } from './astro-constants';
import { TDB_to_UT } from './ut-converter';

export enum DataQuality { GOOD = 1, FAIR, POOR }

export class JupiterInfo {
  private static properlyInitialized: boolean = undefined;
  private static imageGrsLat = -20.0;
  private static imageGrsLong = 129.5;
  private static firstGRSDate: string;
  private static grsLongAtMinTime: number;
  private static grsLongAtMaxTime: number;
  private static grsLongAtMaxTimeAngle: Angle;
  private static interpolationSpan: number;
  private static lastGRSDate: string;
  private static maxGRSTableTime: number;
  private static minGRSTableTime: number;
  private static postTableGRSDrift: number; // degrees/day
  private static preTableGRSDrift: number;  // degrees/day
  private static grsTimes: number[] = [];
  private static grsLongs: number[] = [];

  public static readonly DEFAULT_GRS_LONG = new Angle(-93.0, Unit.DEGREES);

  protected cacheTime = Number.MAX_VALUE;
  protected fixedGRSLong: Angle;
  protected grsCMOffset: Angle;
  protected grsLong = JupiterInfo.DEFAULT_GRS_LONG;
  protected sys1Long: Angle;
  protected sys2Long: Angle;

  private static readGrsInfo(grsData: ArrayBuffer): void {
    try {
      const reader = new KsArrayBufferReader(grsData);

      this.preTableGRSDrift = Number(reader.readAnsiLine(true)) / 365.2425; // Convert degrees/year -> degrees/day
      this.postTableGRSDrift = Number(reader.readAnsiLine(true)) / 365.2425;
      this.interpolationSpan = Number(reader.readAnsiLine(true));

      let line;

      while ((line = reader.readAnsiLine(true)) !== null) {
        const parts = line.split(/-|,/);

        if (parts.length === 4) {
          const Y = parts[0];
          const M = parts[1];
          const D = parts[2];
          const date = `${Y}-${M}-${D}`;
          const lon = Number(parts[3]);
          const year = Number(Y);
          const month = Number(M);
          const day = Number(D);
          const jd = KsDateTime.julianDay_SGC(year, month, day, 0, 0, 0);

          this.grsTimes.push(jd);
          this.grsLongs.push(lon);

          if (isUndefined(this.minGRSTableTime) || this.minGRSTableTime > jd) {
            this.firstGRSDate = date;
            this.minGRSTableTime =  jd;
            this.grsLongAtMinTime = lon;
          }

          if (isUndefined(this.maxGRSTableTime) || this.maxGRSTableTime < jd) {
            this.lastGRSDate = date;
            this.maxGRSTableTime =  jd;
            this.grsLongAtMaxTime = lon;
          }
        }
      }

      this.grsLongAtMaxTimeAngle = new Angle(this.grsLongAtMaxTime, Unit.DEGREES);
      this.properlyInitialized = true;
    }
    catch (error) {
      this.properlyInitialized = false;
    }
  }

  public static getJupiterInfo(astroDataService: AstroDataService): Promise<JupiterInfo> {
    if (this.properlyInitialized)
      return Promise.resolve(new JupiterInfo());
    else if (this.properlyInitialized === false)
      return Promise.reject('Failed to initialize JupiterInfo');
    else {
      return astroDataService.getGrsData().then((grsData: ArrayBuffer) => {
          this.readGrsInfo(grsData);

          return this.getJupiterInfo(astroDataService);
        }).catch((reason: any) => {
          this.properlyInitialized = false;
          return Promise.reject('Failed to initialize JupiterInfo: ' + reason);
        });
    }
  }

  public static grsDataQuality(time_JDU: number): DataQuality {
    if      (!this.properlyInitialized || time_JDU < this.minGRSTableTime - 730.0 || time_JDU > this.maxGRSTableTime + 730.0)
      return DataQuality.POOR;
    else if (time_JDU < this.minGRSTableTime - 365.0 || time_JDU > this.maxGRSTableTime + 365.0)
      return DataQuality.FAIR;
    else
      return DataQuality.GOOD;
  }

  public static getFirstGRSDate(): string {
    return this.firstGRSDate;
  }

  public static getLastGRSDate(): string {
    return this.lastGRSDate;
  }

  public static getLastKnownGRSLongitude(): Angle {
    return this.grsLongAtMaxTimeAngle;
  }

  private constructor() {
  }

  public getSystemILongitude(time_JDE: number): Angle {
    if (this.cacheTime !== time_JDE) {
      this.calculateLongitudes(time_JDE);
      this.cacheTime = time_JDE;
    }

    return this.sys1Long;
  }

  public getSystemIILongitude(time_JDE: number): Angle {
    if (this.cacheTime !== time_JDE) {
      this.calculateLongitudes(time_JDE);
      this.cacheTime = time_JDE;
    }

    return this.sys2Long;
  }

  public getGRSLongitude(time_JDE: number): Angle {
    if (this.fixedGRSLong)
      return this.fixedGRSLong;
    else if (!JupiterInfo.properlyInitialized)
      return JupiterInfo.DEFAULT_GRS_LONG;
    else if (this.cacheTime !== time_JDE) {
      this.calculateLongitudes(time_JDE);
      this.cacheTime = time_JDE;
    }

    return this.grsLong;
  }

  public getGRSCMOffset(time_JDE: number): Angle {
    if (this.cacheTime !== time_JDE) {
      this.calculateLongitudes(time_JDE);
      this.cacheTime = time_JDE;
    }

    return this.grsCMOffset;
  }

  public setFixedGRSLongitude(longitude: number | Angle): void {
    if (isNumber(longitude))
      this.fixedGRSLong = new Angle(<number> longitude, Unit.DEGREES);
    else
      this.fixedGRSLong = <Angle> longitude;

    this.cacheTime = Number.MAX_VALUE;
  }

  public getFixedGRSLongitude(): Angle {
    return this.fixedGRSLong;
  }

  public getEffectiveFixedGRSLongitude(): Angle {
    if (this.fixedGRSLong)
      return this.fixedGRSLong;
    else if (JupiterInfo.properlyInitialized && JupiterInfo.minGRSTableTime === JupiterInfo.maxGRSTableTime &&
             JupiterInfo.preTableGRSDrift === 0.0 && JupiterInfo.postTableGRSDrift === 0.0)
      return new Angle(JupiterInfo.grsLongAtMinTime, Unit.DEGREES);
    else
      return JupiterInfo.DEFAULT_GRS_LONG;
  }

  public clearFixedGRSLongitude(): void {
    this.fixedGRSLong = undefined;
    this.cacheTime = Number.MAX_VALUE;
  }

  protected calculateLongitudes(time_JDE: number): void {
    // This is an implementation of the low-accuracy calculation of Jupiter's
    // rotational values from _Astronomical Algorithms, 2nd Ed._ by Jean Meeus,
    // pp. 297-298.

    const d = time_JDE - JD_J2000;
    const V = 172.74  + 0.00111588 * d;
    const M = 357.529 + 0.9856003  * d;
    const N =  20.020 + 0.0830853  * d + 0.329 * sin_deg(V);
    const J =  66.115 + 0.9025179  * d - 0.329 * sin_deg(V);
    const A = 1.915 * sin_deg(M) + 0.020 * sin_deg(2.0 * M);
    const B = 5.555 * sin_deg(N) + 0.168 * sin_deg(2.0 * N);
    const K = J + A - B;
    const R = 1.00014 - 0.01671 * cos_deg(M) - 0.00014 * cos_deg(2.0 * M);
    const r = 5.20872 - 0.25208 * cos_deg(N) - 0.00611 * cos_deg(2.0 * N);
    const delta = sqrt(r * r + R * R - 2.0 * r * R * cos_deg(K));
    const psi = asin_deg(limitNeg1to1(R / delta * sin_deg(K)));
    const omega1 = 210.98 + 877.8169088 * (d - delta / 173) + psi - B;
    const omega2 = 187.23 + 870.1869088 * (d - delta / 173) + psi - B;
    const cfp = 57.3 * squared(sin_deg(psi / 2.0)) * sign(sin_deg(K));
    const cm1 = omega1 + cfp;
    const cm2 = omega2 + cfp;

    this.sys1Long = new Angle(cm1, Unit.DEGREES);
    this.sys2Long = new Angle(cm2, Unit.DEGREES);

    // And in addition to the above from Meeus...

    if (this.fixedGRSLong)
      this.grsLong = this.fixedGRSLong;
    else if (JupiterInfo.properlyInitialized) {
      let grs;
      const time_JDU = TDB_to_UT(time_JDE);

      if      (time_JDE < JupiterInfo.minGRSTableTime)
        grs = JupiterInfo.grsLongAtMinTime - (JupiterInfo.minGRSTableTime - time_JDU) * JupiterInfo.preTableGRSDrift;
      else if (time_JDE > JupiterInfo.maxGRSTableTime)
        grs = JupiterInfo.grsLongAtMaxTime + (time_JDU - JupiterInfo.maxGRSTableTime) * JupiterInfo.postTableGRSDrift;
      else
        grs = interpolateTabular(JupiterInfo.grsTimes, JupiterInfo.grsLongs, time_JDU, JupiterInfo.interpolationSpan);

      this.grsLong = new Angle(grs, Unit.DEGREES);
    }
    else
      this.grsLong = JupiterInfo.DEFAULT_GRS_LONG;

    this.grsCMOffset = this.sys2Long.subtract(this.grsLong);
  }
}

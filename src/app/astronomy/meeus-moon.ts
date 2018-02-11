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

  This is an implementation of the Chapront ELP 2000-82 lunar theory, as
  presented in a shorter but lower-accuracy form, by Jean Meeus.
*/

import { cos_deg, sin_deg, SphericalPosition3D, Unit } from 'ks-math';
import { JD_J2000, KM_PER_AU } from './astro-constants';

interface LongitudeTerm
{
  fD: number;
  fM: number;
  fM1: number;
  fF: number;
  cs: number;
  cc: number;
}

interface LatitudeTerm
{
  fD: number;
  fM: number;
  fM1: number;
  fF: number;
  cs: number;
}

// From _Astronomical Algorithms, 2nd Ed._ by Jean Meeus
// pp. 339-341, tables 47.A and 47.B.
const lon_table = [
  '0 0 1 0 6288774 -20905355',
  '2 0 -1 0 1274027 -3699111',
  '2 0 0 0 658314 -2955968',
  '0 0 2 0 213618 -569925',
  '0 1 0 0 -185116 48888',
  '0 0 0 2 -114332 -3149',
  '2 0 -2 0 58793 246158',
  '2 -1 -1 0 57066 -152138',
  '2 0 1 0 53322 -170733',
  '2 -1 0 0 45758 -204586',
  '0 1 -1 0 -40923 -129620',
  '1 0 0 0 -34720 108743',
  '0 1 1 0 -30383 104755',
  '2 0 0 -2 15327 10321',
  '0 0 1 2 -12528 0',
  '0 0 1 -2 10980 79661',
  '4 0 -1 0 10675 -34782',
  '0 0 3 0 10034 -23210',
  '4 0 -2 0 8548 -21636',
  '2 1 -1 0 -7888 24208',
  '2 1 0 0 -6766 30824',
  '1 0 -1 0 -5163 -8379',
  '1 1 0 0 4987 -16675',
  '2 -1 1 0 4036 -12831',
  '2 0 2 0 3994 -10445',
  '4 0 0 0 3861 -11650',
  '2 0 -3 0 3665 14403',
  '0 1 -2 0 -2689 -7003',
  '2 0 -1 2 -2602 0',
  '2 -1 -2 0 2390 10056',
  '1 0 1 0 -2348 6322',
  '2 -2 0 0 2236 -9884',
  '0 1 2 0 -2120 5751',
  '0 2 0 0 -2069 0',
  '2 -2 -1 0 2048 -4950',
  '2 0 1 -2 -1773 4130',
  '2 0 0 2 -1595 0',
  '4 -1 -1 0 1215 -3958',
  '0 0 2 2 -1110 0',
  '3 0 -1 0 -892 3258',
  '2 1 1 0 -810 2616',
  '4 -1 -2 0 759 -1897',
  '0 2 -1 0 -713 -2117',
  '2 2 -1 0 -700 2354',
  '2 1 -2 0 691 0',
  '2 -1 0 -2 596 0',
  '4 0 1 0 549 -1423',
  '0 0 4 0 537 -1117',
  '4 -1 0 0 520 -1571',
  '1 0 -2 0 -487 -1739',
  '2 1 0 -2 -399 0',
  '0 0 2 -2 -381 -4421',
  '1 1 1 0 351 0',
  '3 0 -2 0 -340 0',
  '4 0 -3 0 330 0',
  '2 -1 2 0 327 0',
  '0 2 1 0 -323 1165',
  '1 1 -1 0 299 0',
  '2 0 3 0 294 0',
  '2 0 -1 -2 0 8752'];

const lat_table = [
  '0 0 0 1 5128122',
  '0 0 1 1 280602',
  '0 0 1 -1 277693',
  '2 0 0 -1 173237',
  '2 0 -1 1 55413',
  '2 0 -1 -1 46271',
  '2 0 0 1 32573',
  '0 0 2 1 17198',
  '2 0 1 -1 9266',
  '0 0 2 -1 8822',
  '2 -1 0 -1 8216',
  '2 0 -2 -1 4324',
  '2 0 1 1 4200',
  '2 1 0 -1 -3359',
  '2 -1 -1 1 2463',
  '2 -1 0 1 2211',
  '2 -1 -1 -1 2065',
  '0 1 -1 -1 -1870',
  '4 0 -1 -1 1828',
  '0 1 0 1 -1794',
  '0 0 0 3 -1749',
  '0 1 -1 1 -1565',
  '1 0 0 1 -1491',
  '0 1 1 1 -1475',
  '0 1 1 -1 -1410',
  '0 1 0 -1 -1344',
  '1 0 0 -1 -1335',
  '0 0 3 1 1107',
  '4 0 0 -1 1021',
  '4 0 -1 1 833',
  '0 0 1 -3 777',
  '4 0 -2 1 671',
  '2 0 0 -3 607',
  '2 0 2 -1 596',
  '2 -1 1 -1 491',
  '2 0 -2 1 -451',
  '0 0 3 -1 439',
  '2 0 2 1 422',
  '2 0 -3 -1 421',
  '2 1 -1 1 -366',
  '2 1 0 1 -351',
  '4 0 0 1 331',
  '2 -1 1 1 315',
  '2 -2 0 -1 302',
  '0 0 1 3 -283',
  '2 1 1 -1 -229',
  '1 1 0 -1 223',
  '1 1 0 1 223',
  '0 1 -2 -1 -220',
  '2 1 -1 -1 -220',
  '1 0 1 1 -185',
  '2 -1 -2 -1 181',
  '0 1 2 1 -177',
  '4 0 -2 -1 176',
  '4 -1 -1 -1 166',
  '1 0 1 -1 -164',
  '4 0 1 -1 132',
  '1 0 -1 -1 -119',
  '4 -1 0 -1 115',
  '2 -2 0 1 107'];

let termsLR: LongitudeTerm[];
let termsB: LatitudeTerm[];

(function(): void {
  termsLR = lon_table.map((line): LongitudeTerm => {
    const fields = line.split(' ');

    return {
      fD:  Number(fields[0]),
      fM:  Number(fields[1]),
      fM1: Number(fields[2]),
      fF:  Number(fields[3]),
      cs:  Number(fields[4]),
      cc:  Number(fields[5])
    };
  });

  termsB = lat_table.map((line): LatitudeTerm => {
    const fields = line.split(' ');

    return {
      fD:  Number(fields[0]),
      fM:  Number(fields[1]),
      fM1: Number(fields[2]),
      fF:  Number(fields[3]),
      cs:  Number(fields[4])
    };
  });
})();

const CACHE_SIZE = 6;

export class MeeusMoon {

  private cachedTimes: number[] = [];
  private cachedPositions: SphericalPosition3D[] = [];

  constructor() {
    this.cachedPositions.length = CACHE_SIZE;
    this.cachedPositions.fill(null, 0, CACHE_SIZE);
  }

  public getEclipticPosition(time_JDE: number): SphericalPosition3D {
    for (let i = 0; i < CACHE_SIZE; ++i) {
      if (this.cachedPositions[i] !== null && this.cachedTimes[i] === time_JDE)
        return this.cachedPositions[i];
    }

    const T = (time_JDE - JD_J2000) / 36525.0;
    const T2 = T * T;
    const T3 = T2 * T;
    const T4 = T3 * T;

    const L1 = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2
          + T3 / 538841.0 - T4 / 65194000.0
          // Undoing the built-in 0.7' light-time adjustment
          + 0.0001944;
    const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2
            + T3 / 545868.0 - T4 / 113065000.0;
    const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2
            + T3 / 24490000.0;
    const M1 = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2
             + T3 / 69699.0 - T4 / 14712000.0;
    const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T2
            - T3 / 3526000.0 + T4 / 863310000.0;
    const A1 = 119.75 + 131.849 * T;
    const A2 = 53.09 + 479264.290 * T;
    const A3 = 313.45 + 481266.484 * T;
    const E = 1.0 - 0.002516 * T - 0.0000074 * T2;
    const E2 = E * E;

    let L = 0.0, B = 0.0, R = 0.0;
    let arg;

    for (const term of termsLR) {
      arg = term.fD * D + term.fM * M + term.fM1 * M1 + term.fF * F;

      if (term.fM === -2.0 || term.fM === 2.0) {
        L += term.cs * E2 * sin_deg(arg);
        R += term.cc * E2 * cos_deg(arg);
      }
      else if (term.fM === -1.0 || term.fM === 1.0) {
        L += term.cs * E * sin_deg(arg);
        R += term.cc * E * cos_deg(arg);
      }
      else {
        L += term.cs * sin_deg(arg);
        R += term.cc * cos_deg(arg);
      }
    }

    L +=  3958.0 * sin_deg(A1)
        + 1962.0 * sin_deg(L1 - F)
        +  318.0 * sin_deg(A2);
    L = L1 + L / 1000000.0;

    R = 385000.56 + R / 1000.0;

    for (const term of termsB) {
      arg = term.fD * D + term.fM * M + term.fM1 * M1 + term.fF * F;

      if (term.fM === -2.0 || term.fM === 2.0)
        B += term.cs * E2 * sin_deg(arg);
      else if (term.fM === -1.0 || term.fM === 1.0)
        B += term.cs * E * sin_deg(arg);
      else
        B += term.cs * sin_deg(arg);
    }

    B += - 2235.0 * sin_deg(L1)
         +  382.0 * sin_deg(A3)
         +  175.0 * sin_deg(A1 - F)
         +  175.0 * sin_deg(A1 + F)
         +  127.0 * sin_deg(L1 - M1)
         -  115.0 * sin_deg(L1 + M1);
    B /= 1000000.0;

    // Convert to AU for consistency with other code
    const pos = new SphericalPosition3D(L, B, R / KM_PER_AU, Unit.DEGREES, Unit.DEGREES);

    // Shuffle cache
    for (let i = 0; i < CACHE_SIZE - 1; ++i) {
      this.cachedTimes[i] = this.cachedTimes[i + 1];
      this.cachedPositions[i] = this.cachedPositions[i + 1];
    }

    this.cachedTimes[CACHE_SIZE - 1] = time_JDE;
    this.cachedPositions[CACHE_SIZE - 1] = pos;

    return pos;
  }
}

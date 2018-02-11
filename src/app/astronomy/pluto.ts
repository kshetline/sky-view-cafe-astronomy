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

  This is an implementation of Aldo Vitagliano's Pluto theory, as
  presented by Jean Meeus.
*/

import { cos, sin, SphericalPosition3D, to_radian, Unit } from 'ks-math';
import { JD_J2000 } from './astro-constants';
import { Ecliptic } from './ecliptic';

interface PlutoTerm {
  fJ: number;
  fS: number;
  fP: number;
  La: number;
  Lb: number;
  Ba: number;
  Bb: number;
  Ra: number;
  Rb: number;
}

// From _Astronomical Algorithms, 2nd Ed._ by Jean Meeus
// p. 265, table 37.A.
const table = [
  '0 0 1 -19799805 19850055 -5452852 -14974862 66865439 68951812',
  '0 0 2 897144 -4954829 3527812 1672790 -11827535 -332538',
  '0 0 3 611149 1211027 -1050748 327647 1593179 -1438890',
  '0 0 4 -341243 -189585 178690 -292153 -18444 483220',
  '0 0 5 129287 -34992 18650 100340 -65977 -85431',
  '0 0 6 -38164 30893 -30697 -25823 31174 -6032',
  '0 1 -1 20442 -9987 4878 11248 -5794 22161',
  '0 1 0 -4063 -5071 226 -64 4601 4032',
  '0 1 1 -6016 -3336 2030 -836 -1729 234',
  '0 1 2 -3956 3039 69 -604 -415 702',
  '0 1 3 -667 3572 -247 -567 239 723',
  '0 2 -2 1276 501 -57 1 67 -67',
  '0 2 -1 1152 -917 -122 175 1034 -451',
  '0 2 0 630 -1277 -49 -164 -129 504',
  '1 -1 0 2571 -459 -197 199 480 -231',
  '1 -1 1 899 -1449 -25 217 2 -441',
  '1 0 -3 -1016 1043 589 -248 -3359 265',
  '1 0 -2 -2343 -1012 -269 711 7856 -7832',
  '1 0 -1 7042 788 185 193 36 45763',
  '1 0 0 1199 -338 315 807 8663 8547',
  '1 0 1 418 -67 -130 -43 -809 -769',
  '1 0 2 120 -274 5 3 263 -144',
  '1 0 3 -60 -159 2 17 -126 32',
  '1 0 4 -82 -29 2 5 -35 -16',
  '1 1 -3 -36 -29 2 3 -19 -4',
  '1 1 -2 -40 7 3 1 -15 8',
  '1 1 -1 -14 22 2 -1 -4 12',
  '1 1 0 4 13 1 -1 5 6',
  '1 1 1 5 2 0 -1 3 1',
  '1 1 3 -1 0 0 0 6 -2',
  '2 0 -6 2 0 0 -2 2 2',
  '2 0 -5 -4 5 2 2 -2 -2',
  '2 0 -4 4 -7 -7 0 14 13',
  '2 0 -3 14 24 10 -8 -63 13',
  '2 0 -2 -49 -34 -3 20 136 -236',
  '2 0 -1 163 -48 6 5 273 1065',
  '2 0 0 9 -24 14 17 251 149',
  '2 0 1 -4 1 -2 0 -25 -9',
  '2 0 2 -3 1 0 0 9 -2',
  '2 0 3 1 3 0 0 -8 7',
  '3 0 -2 -3 -1 0 1 2 -10',
  '3 0 -1 5 -3 0 0 19 35',
  '3 0 0 0 0 1 0 10 3'
];

let terms: PlutoTerm[];

(function(): void {
  terms = table.map((line): PlutoTerm => {
    const fields = line.split(' ');

    return {
      fJ: Number(fields[0]),
      fS: Number(fields[1]),
      fP: Number(fields[2]),
      La: Number(fields[3]) / 1.0E6,
      Lb: Number(fields[4]) / 1.0E6,
      Ba: Number(fields[5]) / 1.0E6,
      Bb: Number(fields[6]) / 1.0E6,
      Ra: Number(fields[7]) / 1.0E7,
      Rb: Number(fields[8]) / 1.0E7
    };
  });
})();

export class Pluto {
  private cachedPosition: SphericalPosition3D = null;
  private cachedTime = 0;

  public getHeliocentricPosition(time_JDE: number): SphericalPosition3D {
    if (this.cachedTime === time_JDE && this.cachedPosition !== null)
      return this.cachedPosition;

    const T = (time_JDE - JD_J2000) / 36525.0;
    const J = to_radian(34.35 + 3034.9057 * T);
    const S = to_radian(50.08 + 1222.1138 * T);
    const P = to_radian(238.96 + 144.9600 * T);

    let L = 238.958116 + 144.96 * T;
    let B = -3.908239;
    let R = 40.7241346;

    let arg;

    for (const term of terms) {
      arg = term.fJ * J + term.fS * S + term.fP * P;

      L += term.La * sin(arg) + term.Lb * cos(arg);
      B += term.Ba * sin(arg) + term.Bb * cos(arg);
      R += term.Ra * sin(arg) + term.Rb * cos(arg);
    }

    this.cachedPosition = Ecliptic.precessEcliptical3D(new SphericalPosition3D(L, B, R, Unit.DEGREES, Unit.DEGREES), time_JDE);
    this.cachedTime = time_JDE;

    return this.cachedPosition;
  }
}

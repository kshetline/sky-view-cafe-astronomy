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

  This is an implementation of the E5 Jovian satellite theory by Jay Lieske,
  as presented by Jean Meeus.
*/

import { MoonEvents, MoonInfo, PlanetaryMoons } from './planetary-moons';
import { DELAYED_TIME, FIRST_JUPITER_MOON, JUPITER, JUPITER_FLATTENING, LAST_JUPITER_MOON, MEAN_JUPITER_SYS_II } from './astro-constants';
import { abs, atan2, atan_deg, cos, cos_deg, floor, max, min, sin, sin_deg, SphericalPosition3D, sqrt, squared } from 'ks-math';
import { SolarSystem } from './solar-system';
import { JupiterInfo } from './jupiter-info';
import { extendDelimited } from 'ks-util';

export class JupitersMoons extends PlanetaryMoons {
  private static initialized = false;

  constructor() {
    super();

    if (!JupitersMoons.initialized) {
      PlanetaryMoons.registerMoonNames(FIRST_JUPITER_MOON, LAST_JUPITER_MOON,
        ['Io', 'Europa', 'Ganymede', 'Callisto'],
        ['Shadow of Io', 'Shadow of Europa', 'Shadow of Ganymede', 'Shadow of Callisto']);
      JupitersMoons.initialized = true;
    }

    this.flattening = JUPITER_FLATTENING;
    this.v_max = [0.0147, 0.0117, 0.0092, 0.0070];
  }

  protected getMoonPositionsAux(time_JDE: number, sunPerspective: boolean): MoonInfo[] {
    // Adapted from _Astronomical Algorithms, 2nd Ed._ by Jean Meeus
    // pp. 304-315.
    const nmoons = LAST_JUPITER_MOON - FIRST_JUPITER_MOON + 1;
    const moons: MoonInfo[] = [];
    const lightDelay = time_JDE - this.solarSystem.getEclipticPosition(JUPITER, time_JDE, null, DELAYED_TIME).radius;
    let jpos: SphericalPosition3D;

    if (sunPerspective)
      jpos = this.solarSystem.getHeliocentricPosition(JUPITER, time_JDE - lightDelay);
    else
      jpos = this.solarSystem.getEclipticPosition(JUPITER, time_JDE - lightDelay, null, 0);

    const L0 = jpos.longitude.degrees;
    const B0 = jpos.latitude.degrees;
    const DELTA = jpos.radius;
    const t = time_JDE - 2443000.5 - lightDelay;

    const l1 = 106.07719 + 203.488955790 * t;
    const l2 = 175.73161 + 101.374724735 * t;
    const l3 = 120.55883 +  50.317609207 * t;
    const l4 =  84.44459 +  21.571071177 * t;

    const p1 =  97.0881 + 0.16138586 * t;
    const p2 = 154.8663 + 0.04726307 * t;
    const p3 = 188.1840 + 0.00712734 * t;
    const p4 = 335.2868 + 0.00184000 * t;

    const w1 = 312.3346 - 0.13279386 * t;
    const w2 = 100.4411 - 0.03263064 * t;
    const w3 = 119.1942 - 0.00717703 * t;
    const w4 = 322.6186 - 0.00175934 * t;

    const GAMMA = 0.33033 * sin_deg(163.679 + 0.0010512 * t)
                  + 0.03439 * sin_deg(34.486 - 0.0161713 * t);
    const PHI_l = 199.6766 + 0.17379190 * t;
    const psi = 316.5182 - 0.00000208 * t;
    const G = 30.23756 + 0.0830925701 * t + GAMMA;
    const G1 = 31.97853 + 0.0334597339 * t;
    const PIj = 13.469942;

    let S;
    let L = 0.0;
    let B = 0.0;
    let R = 0.0;
    let K = 0.0;
    let W;
    const X: number[] = [];
    const Y: number[] = [];
    const Z: number[] = [];

    for (let j = 0; j < nmoons; ++j) {
      switch (j) {
        case 0: // I, Io
          S = + 0.47259 * sin_deg(2.0 * (l1 - l2))
              - 0.03478 * sin_deg(p3 - p4)
              + 0.01081 * sin_deg(l2 - 2.0 * l3 + p3)
              + 0.00738 * sin_deg(PHI_l)
              + 0.00713 * sin_deg(l2 - 2.0 * l3 + p2)
              - 0.00674 * sin_deg(p1 + p3 - 2.0 * PIj - 2.0 * G)
              + 0.00666 * sin_deg(l2 - 2.0 * l3 + p4)
              + 0.00445 * sin_deg(l1 - p3)
              - 0.00354 * sin_deg(l1 - l2)
              - 0.00317 * sin_deg(2.0 * psi - 2.0 * PIj)
              + 0.00265 * sin_deg(l1 - p4)
              - 0.00186 * sin_deg(G)
              + 0.00162 * sin_deg(p2 - p3)
              + 0.00158 * sin_deg(4.0 * (l1 - l2))
              - 0.00155 * sin_deg(l1 - l3)
              - 0.00138 * sin_deg(psi + w3 - 2.0 * PIj - 2.0 * G)
              - 0.00115 * sin_deg(2.0 * (l1 - 2.0 * l2 + w2))
              + 0.00089 * sin_deg(p2 - p4)
              + 0.00085 * sin_deg(l1 + p3 - 2.0 * PIj - 2.0 * G)
              + 0.00083 * sin_deg(w2 - w3)
              + 0.00053 * sin_deg(psi - w2);

          L = l1 + S;

          B = atan_deg(
              + 0.0006393 * sin_deg(L - w1)
              + 0.0001825 * sin_deg(L - w2)
              + 0.0000329 * sin_deg(L - w3)
              - 0.0000311 * sin_deg(L - psi)
              + 0.0000093 * sin_deg(L - w4)
              + 0.0000075 * sin_deg(3.0 * L - 4.0 * l2 - 1.9927 * S + w2)
              + 0.0000046 * sin_deg(L + psi - 2.0 * PIj - 2.0 * G));

          R = 5.90569 * (1.0
              - 0.0041339 * cos_deg(2.0 * (l1 - l2))
              - 0.0000387 * cos_deg(l1 - p3)
              - 0.0000214 * cos_deg(l1 - p4)
              + 0.0000170 * cos_deg(l1 - l2)
              - 0.0000131 * cos_deg(4.0 * (l1 - l2))
              + 0.0000106 * cos_deg(l1 - l3)
              - 0.0000066 * cos_deg(l1 + p3 - 2.0 * PIj - 2.0 * G));

          K = 17295.0;
        break;

        case 1: // II, Europa
          S = + 1.06476 * sin_deg(2.0 * (l2 - l3))
              + 0.04256 * sin_deg(l1 - 2.0 * l2 + p3)
              + 0.03581 * sin_deg(l2 - p3)
              + 0.02395 * sin_deg(l1 - 2.0 * l2 + p4)
              + 0.01984 * sin_deg(l2 - p4)
              - 0.01778 * sin_deg(PHI_l)
              + 0.01654 * sin_deg(l2 - p2)
              + 0.01334 * sin_deg(l2 - 2.0 * l3 + p2)
              + 0.01294 * sin_deg(p3 - p4)
              - 0.01142 * sin_deg(l2 - l3)
              - 0.01057 * sin_deg(G)
              - 0.00775 * sin_deg(2.0 * (psi - PIj))
              + 0.00524 * sin_deg(2.0 * (l1 - l2))
              - 0.00460 * sin_deg(l1 - l3)
              + 0.00316 * sin_deg(psi - 2.0 * G + w3 - 2.0 * PIj)
              - 0.00203 * sin_deg(p1 + p3 - 2.0 * PIj - 2.0 * G)
              + 0.00146 * sin_deg(psi - w3)
              - 0.00145 * sin_deg(2.0 * G)
              + 0.00125 * sin_deg(psi - w4)
              - 0.00115 * sin_deg(l1 - 2.0 * l3 + p3)
              - 0.00094 * sin_deg(2.0 * (l2 - w2))
              + 0.00086 * sin_deg(2.0 * (l1 - 2.0 * l2 + w2))
              - 0.00086 * sin_deg(5.0 * G1 - 2.0 * G + 52.225)
              - 0.00078 * sin_deg(l2 - l4)
              - 0.00064 * sin_deg(3.0 * l3 - 7.0 * l4 + 4.0 * p4)
              + 0.00064 * sin_deg(p1 - p4)
              - 0.00063 * sin_deg(l1 - 2.0 * l3 + p4)
              + 0.00058 * sin_deg(w3 - w4)
              + 0.00056 * sin_deg(2.0 * (psi - PIj - G))
              + 0.00056 * sin_deg(2.0 * (l2 - l4))
              + 0.00055 * sin_deg(2.0 * (l1 - l3))
              + 0.00052 * sin_deg(3.0 * l3 - 7.0 * l4 + p3 + 3.0 * p4)
              - 0.00043 * sin_deg(l1 - p3)
              + 0.00041 * sin_deg(5.0 * (l2 - l3))
              + 0.00041 * sin_deg(p4 - PIj)
              + 0.00032 * sin_deg(w2 - w3)
              + 0.00032 * sin_deg(2.0 * (l3 - G - PIj));

          L = l2 + S;

          B = atan_deg(
              + 0.0081004 * sin_deg(L - w2)
              + 0.0004512 * sin_deg(L - w3)
              - 0.0003284 * sin_deg(L - psi)
              + 0.0001160 * sin_deg(L - w4)
              + 0.0000272 * sin_deg(l1 - 2.0 * l3 + 1.0146 * S + w2)
              - 0.0000144 * sin_deg(L - w1)
              + 0.0000143 * sin_deg(L + psi - 2.0 * PIj - 2.0 * G)
              + 0.0000035 * sin_deg(L - psi + G)
              - 0.0000028 * sin_deg(l1 - 2.0 * l3 + 1.0146 * S + w3));

          R = 9.39657 * (1.0
              + 0.0093848 * cos_deg(l1 - l2)
              - 0.0003116 * cos_deg(l2 - p3)
              - 0.0001744 * cos_deg(l2 - p4)
              - 0.0001442 * cos_deg(l2 - p2)
              + 0.0000553 * cos_deg(l2 - l3)
              + 0.0000523 * cos_deg(l1 - l3)
              - 0.0000290 * cos_deg(2.0 * (l1 - l2))
              + 0.0000164 * cos_deg(2.0 * (l2 - w2))
              + 0.0000107 * cos_deg(l1 - 2.0 * l3 + p3)
              - 0.0000102 * cos_deg(l2 - p1)
              - 0.0000091 * cos_deg(2.0 * (l1 - l3)));

          K = 21819.0;
        break;

        case 2: // III, Ganymede
          S = + 0.16490 * sin_deg(l3 - p3)
              + 0.09081 * sin_deg(l3 - p4)
              - 0.06907 * sin_deg(l2 - l3)
              + 0.03784 * sin_deg(p3 - p4)
              + 0.01846 * sin_deg(2.0 * (l3 - l4))
              - 0.01340 * sin_deg(G)
              - 0.01014 * sin_deg(2.0 * (psi - PIj))
              + 0.00704 * sin_deg(l2 - 2.0 * l3 + p3)
              - 0.00620 * sin_deg(l2 - 2.0 * l3 + p2)
              - 0.00541 * sin_deg(l3 - l4)
              + 0.00381 * sin_deg(l2 - 2.0 * l3 + p4)
              + 0.00235 * sin_deg(psi - w3)
              + 0.00198 * sin_deg(psi - w4)
              + 0.00176 * sin_deg(PHI_l)
              + 0.00130 * sin_deg(3.0 * (l3 - l4))
              + 0.00125 * sin_deg(l1 - l3)
              - 0.00119 * sin_deg(5.0 * G1 - 2.0 * G + 52.225)
              + 0.00109 * sin_deg(l1 - l2)
              - 0.00100 * sin_deg(3.0 * l3 - 7.0 * l4 + 4.0 * p4)
              + 0.00091 * sin_deg(w3 - w4)
              + 0.00080 * sin_deg(3.0 * l3 - 7.0 * l4 + p3 + 3.0 * p4)
              - 0.00075 * sin_deg(2.0 * l2 - 3.0 * l3 + p3)
              + 0.00072 * sin_deg(p1 + p3 - 2.0 * PIj - 2.0 * G)
              + 0.00069 * sin_deg(p4 - PIj)
              - 0.00058 * sin_deg(2.0 * l3 - 3.0 * l4 + p4)
              - 0.00057 * sin_deg(l3 - 2.0 * l4 + p4)
              + 0.00056 * sin_deg(l3 + p3 - 2.0 * PIj - 2.0 * G)
              - 0.00052 * sin_deg(l2 - 2.0 * l3 + p1)
              - 0.00050 * sin_deg(p2 - p3)
              + 0.00048 * sin_deg(l3 - 2.0 * l4 + p3)
              - 0.00045 * sin_deg(2.0 * l2 - 3.0 * l3 + p4)
              - 0.00041 * sin_deg(p2 - p4)
              - 0.00038 * sin_deg(2.0 * G)
              - 0.00037 * sin_deg(p3 - p4 + w3 - w4)
              - 0.00032 * sin_deg(3.0 * l3 - 7.0 * l4 + 2.0 * p3 + 2.0 * p4)
              + 0.00030 * sin_deg(4.0 * (l3 - l4))
              + 0.00029 * sin_deg(l3 + p4 - 2.0 * PIj - 2.0 * G)
              - 0.00028 * sin_deg(w3 + psi - 2.0 * PIj - 2.0 * G)
              + 0.00026 * sin_deg(l3 - PIj - G)
              + 0.00024 * sin_deg(l2 - 3.0 * l3 + 2.0 * l4)
              + 0.00021 * sin_deg(2.0 * (l3 - PIj - G))
              - 0.00021 * sin_deg(l3 - p2)
              + 0.00017 * sin_deg(2.0 * (l3 - p3));

          L = l3 + S;

          B = atan_deg(
              + 0.0032402 * sin_deg(L - w3)
              - 0.0016911 * sin_deg(L - psi)
              + 0.0006847 * sin_deg(L - w4)
              - 0.0002797 * sin_deg(L - w2)
              + 0.0000321 * sin_deg(L + psi - 2.0 * PIj - 2.0 * G)
              + 0.0000051 * sin_deg(L - psi + G)
              - 0.0000045 * sin_deg(L - psi - G)
              - 0.0000045 * sin_deg(L + psi - 2.0 * PIj)
              + 0.0000037 * sin_deg(L + psi - 2.0 * PIj - 3.0 * G)
              + 0.0000030 * sin_deg(2.0 * l2 - 3.0 * L + 4.03 * S + w2)
              - 0.0000021 * sin_deg(2.0 * l2 - 3.0 * L + 4.03 * S + w3));

          R = 14.98832 * (1.0
              - 0.0014388 * cos_deg(l3 - p3)
              - 0.0007919 * cos_deg(l3 - p4)
              + 0.0006342 * cos_deg(l2 - l3)
              - 0.0001761 * cos_deg(2.0 * (l3 - l4))
              + 0.0000294 * cos_deg(l3 - l4)
              - 0.0000156 * cos_deg(3.0 * (l3 - l4))
              + 0.0000156 * cos_deg(l1 - l3)
              - 0.0000153 * cos_deg(l1 - l2)
              + 0.0000070 * cos_deg(2.0 * l2 - 3.0 * l3 + p3)
              - 0.0000051 * cos_deg(l3 + p3 - 2.0 * PIj - 2.0 * G));

          K = 27558.0;
        break;

        case 3: // IV, Callisto
          S = + 0.84287 * sin_deg(l4 - p4)
              + 0.03431 * sin_deg(p4 - p3)
              - 0.03305 * sin_deg(2.0 * (psi - PIj))
              - 0.03211 * sin_deg(G)
              - 0.01862 * sin_deg(l4 - p3)
              + 0.01186 * sin_deg(psi - w4)
              + 0.00623 * sin_deg(l4 + p4 - 2.0 * G - 2.0 * PIj)
              + 0.00387 * sin_deg(2.0 * (l4 - p4))
              - 0.00284 * sin_deg(5.0 * G1 - 2.0 * G + 52.225)
              - 0.00234 * sin_deg(2.0 * (psi - p4))
              - 0.00223 * sin_deg(l3 - l4)
              - 0.00208 * sin_deg(l4 - PIj)
              + 0.00178 * sin_deg(psi + w4 - 2.0 * p4)
              + 0.00134 * sin_deg(p4 - PIj)
              + 0.00125 * sin_deg(2.0 * (l4 - G - PIj))
              - 0.00117 * sin_deg(2.0 * G)
              - 0.00112 * sin_deg(2.0 * (l3 - l4))
              + 0.00107 * sin_deg(3.0 * l3 - 7.0 * l4 + 4.0 * p4)
              + 0.00102 * sin_deg(l4 - G - PIj)
              + 0.00096 * sin_deg(2.0 * l4 - psi - w4)
              + 0.00087 * sin_deg(2.0 * (psi - w4))
              - 0.00085 * sin_deg(3.0 * l3 - 7.0 * l4 + p3 + 3.0 * p4)
              + 0.00085 * sin_deg(l3 - 2.0 * l4 + p4)
              - 0.00081 * sin_deg(2.0 * (l4 - psi))
              + 0.00071 * sin_deg(l4 + p4 - 2.0 * PIj - 3.0 * G)
              + 0.00061 * sin_deg(l1 - l4)
              - 0.00056 * sin_deg(psi - w3)
              - 0.00054 * sin_deg(l3 - 2.0 * l4 + p3)
              + 0.00051 * sin_deg(l2 - l4)
              + 0.00042 * sin_deg(2.0 * (psi - G - PIj))
              + 0.00039 * sin_deg(2.0 * (p4 - w4))
              + 0.00036 * sin_deg(psi + PIj - p4 - w4)
              + 0.00035 * sin_deg(2.0 * G1 - G + 188.37)
              - 0.00035 * sin_deg(l4 - p4 + 2.0 * PIj - 2.0 * psi)
              - 0.00032 * sin_deg(l4 + p4 - 2.0 * PIj - G)
              + 0.00030 * sin_deg(2.0 * G1 - 2.0 * G + 149.15)
              + 0.00029 * sin_deg(3.0 * l3 - 7.0 * l4 + 2.0 * p3 + 2.0 * p4)
              + 0.00028 * sin_deg(l4 - p4 + 2.0 * psi - 2.0 * PIj)
              - 0.00028 * sin_deg(2.0 * (l4 - w4))
              - 0.00027 * sin_deg(p3 - p4 + w3 - w4)
              - 0.00026 * sin_deg(5.0 * G1 - 3.0 * G + 188.37)
              + 0.00025 * sin_deg(w4 - w3)
              - 0.00025 * sin_deg(l2 - 3.0 * l3 + 2.0 * l4)
              - 0.00023 * sin_deg(3.0 * (l3 - l4))
              + 0.00021 * sin_deg(2.0 * l4 - 2.0 * PIj - 3.0 * G)
              - 0.00021 * sin_deg(2.0 * l3 - 3.0 * l4 + p4)
              + 0.00019 * sin_deg(l4 - p4 - G)
              - 0.00019 * sin_deg(2.0 * l4 - p3 - p4)
              - 0.00018 * sin_deg(l4 - p4 + G)
              - 0.00016 * sin_deg(l4 + p3 - 2.0 * PIj - 2.0 * G);

          L = l4 + S;

          B = atan_deg(
              - 0.0076579 * sin_deg(L - psi)
              + 0.0044134 * sin_deg(L - w4)
              - 0.0005112 * sin_deg(L - w3)
              + 0.0000773 * sin_deg(L + psi - 2.0 * PIj - 2.0 * G)
              + 0.0000104 * sin_deg(L - psi + G)
              - 0.0000102 * sin_deg(L - psi - G)
              + 0.0000088 * sin_deg(L + psi - 2.0 * PIj - 3.0 * G)
              - 0.0000038 * sin_deg(L + psi - 2.0 * PIj - G));

          R = 26.36273 * (1.0
              - 0.0073546 * cos_deg(l4 - p4)
              + 0.0001621 * cos_deg(l4 - p3)
              + 0.0000974 * cos_deg(l3 - l4)
              - 0.0000543 * cos_deg(l4 + p4 - 2.0 * PIj - 2.0 * G)
              - 0.0000271 * cos_deg(2.0 * (l4 - p4))
              + 0.0000182 * cos_deg(l4 - PIj)
              + 0.0000177 * cos_deg(2.0 * (l3 - l4))
              - 0.0000167 * cos_deg(2.0 * l4 - psi - w4)
              + 0.0000167 * cos_deg(psi - w4)
              - 0.0000155 * cos_deg(2.0 * (l4 - PIj - G))
              + 0.0000142 * cos_deg(2.0 * (l4 - psi))
              + 0.0000105 * cos_deg(l1 - l4)
              + 0.0000092 * cos_deg(l2 - l4)
              - 0.0000089 * cos_deg(l4 - PIj - G)
              - 0.0000062 * cos_deg(l4 + p4 - 2.0 * PIj - 3.0 * G)
              + 0.0000048 * cos_deg(2.0 * (l4 - w4)));

          K = 36548.0;
        break;
      }

      // The precessional adjustment, P, made to both L and psi by Meeus, cancels out
      // inside this loop. Since I'm not saving L, and psi should remain unadjusted for
      // the series calculations, I only use P to produce PHI (derived from psi) later.

      X[j] = R * cos_deg(L - psi) * cos_deg(B);
      Y[j] = R * sin_deg(L - psi) * cos_deg(B);
      Z[j] = R * sin_deg(B);
    }

    const T0 = (time_JDE - 2433282.423) / 36525.0;
    const P = 1.3966626 * T0 + 0.0003088 * T0 * T0;
    const T = (time_JDE - 2415020.0) / 36525.0;
    const I = 3.120262 + 0.0006 * T;
    const oe = SolarSystem.getOrbitalElements(JUPITER, time_JDE - lightDelay);
    const OMEGA = oe.OMEGA;
    const PHI = psi + P - OMEGA;
    const i = oe.i;

    // Now we set up a fictitious moon.
    X[nmoons] = 0.0;
    Y[nmoons] = 0.0;
    Z[nmoons] = 1.0;

    let A1: number, A2: number, A3: number, A4: number, A5: number, A6: number;
    let B1: number, B2: number, B3: number, B4: number, B5: number, B6: number;
    let C1: number, C2: number, C3: number, C4: number, C5: number, C6: number;
    let D = 0;
    let Y1: number;
    let moon: MoonInfo;

    // We'll loop backwards so we can compute D from the fictitious moon first.
    for (let j = nmoons; j >= 0; --j) {
      // Rotation towards Jupiter's orbital plane
      A1 = X[j];
      B1 = Y[j] * cos_deg(I) - Z[j] * sin_deg(I);
      C1 = Y[j] * sin_deg(I) + Z[j] * cos_deg(I);
      // Rotation towards ascending node of Jupiter's orbit
      A2 = A1 * cos_deg(PHI) - B1 * sin_deg(PHI);
      B2 = A1 * sin_deg(PHI) + B1 * cos_deg(PHI);
      C2 = C1;
      // Rotation towards plane of ecliptic
      A3 = A2;
      B3 = B2 * cos_deg(i) - C2 * sin_deg(i);
      C3 = B2 * sin_deg(i) + C2 * cos_deg(i);
      // Rotation towards the vernal equinox
      A4 = A3 * cos_deg(OMEGA) - B3 * sin_deg(OMEGA);
      B4 = A3 * sin_deg(OMEGA) + B3 * cos_deg(OMEGA);
      C4 = C3;
      // Meeus does not explain these last two rotations, but they're
      // obviously related to accounting for the location of Jupiter.
      A5 = A4 * sin_deg(L0) - B4 * cos_deg(L0);
      B5 = A4 * cos_deg(L0) + B4 * sin_deg(L0);
      C5 = C4;

      A6 = A5;
      B6 = C5 * sin_deg(B0) + B5 * cos_deg(B0);
      C6 = C5 * cos_deg(B0) - B5 * sin_deg(B0);

      if (j === nmoons)
        D = atan2(A6, C6);
      else {
        X[j] = A6 * cos(D) - C6 * sin(D);
        Y[j] = A6 * sin(D) + C6 * cos(D);
        Z[j] = B6;

        W = DELTA / (DELTA + Z[j] / 2095.0);

        X[j] += abs(Z[j]) / K * sqrt(1.0 - squared(X[j] / R));
        X[j] *= W;
        Y[j] *= W;

        moon = <MoonInfo> {};
        moon.moonIndex = j + FIRST_JUPITER_MOON;
        moon.X = X[j];
        moon.Y = Y[j];
        moon.Z = Z[j];
        moon.inferior = (moon.Z <= 0.0);
        Y1 = moon.Y * this.flattening;
        moon.withinDisc    = (sqrt(moon.X * moon.X + Y1 * Y1) < 1.0);
        moon.inFrontOfDisc = moon.withinDisc &&  moon.inferior;
        moon.behindDisc    = moon.withinDisc && !moon.inferior;

        moons[j] = moon;
      }
    }

    return moons;
  }

  public getMoonEventsForOneMinuteSpan(time_JDU: number, longFormat = false, jupiterInfo?: JupiterInfo): MoonEvents {
    const events = super.getMoonEventsForOneMinuteSpan(time_JDU, longFormat);

    if (jupiterInfo) {
      const grs0 = jupiterInfo.getGRSCMOffset(events.t0).degrees;
      const grs1 = jupiterInfo.getGRSCMOffset(events.t1).degrees;

      if (grs0 < 0.0 && grs1 >= 0.0) {
        events.text = extendDelimited(events.text, 'GRS transit');
        ++events.count;
      }
      else if (grs1 < 0.0) {
        const estMinsNextTransit = floor(-grs1 / 360.0 * MEAN_JUPITER_SYS_II * 1440.0 * 0.9);

        events.searchDeltaT = min(events.searchDeltaT, max(estMinsNextTransit, 1));
      }
    }

    return events;
  }
}

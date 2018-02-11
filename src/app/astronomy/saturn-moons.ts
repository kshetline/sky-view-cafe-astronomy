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

  This is an implementation of the method of computing Saturn's moons created
  by Gérard Dourneau, as presented by Jean Meeus.
*/

import { MoonInfo, PlanetaryMoons } from './planetary-moons';
import { DELAYED_TIME, FIRST_SATURN_MOON, JD_B1950, LAST_SATURN_MOON, SATURN, SATURN_FLATTENING } from './astro-constants';
import { abs, asin_deg, atan2, atan2_deg, cos, cos_deg, sin, sin_deg, SphericalPosition3D, sqrt, squared, to_degree } from 'ks-math';
import { Ecliptic } from './ecliptic';

const s1 = sin_deg(28.0817);
const c1 = cos_deg(28.0817);
const s2 = sin_deg(168.8112);
const c2 = cos_deg(168.8112);

interface OuterMoonInfo {
  lambda: number;
  gamma: number;
  w: number;
  r: number;
}

export class SaturnMoons extends PlanetaryMoons {
  private static initialized = false;

  constructor() {
    super();

    if (!SaturnMoons.initialized) {
      PlanetaryMoons.registerMoonNames(FIRST_SATURN_MOON, LAST_SATURN_MOON,
        ['Mimas', 'Enceladus', 'Tethys', 'Dione', 'Rhea', 'Titan', 'Hyperion', 'Iapetus'],
        []);
      SaturnMoons.initialized = true;
    }

    this.flattening = SATURN_FLATTENING;
  }

  protected getMoonPositionsAux(time_JDE: number, sunPerspective: boolean): MoonInfo[] {
    // Adapted from _Astronomical Algorithms, 2nd Ed._ by Jean Meeus
    // pp. 323-333.

    const nmoons = LAST_SATURN_MOON - FIRST_SATURN_MOON + 1;
    const moons: MoonInfo[] = [];
    const lightDelay = time_JDE - this.solarSystem.getEclipticPosition(SATURN, time_JDE, null, DELAYED_TIME).radius;
    let spos: SphericalPosition3D;

    if (sunPerspective)
      spos = this.solarSystem.getHeliocentricPosition(SATURN, time_JDE - lightDelay);
    else
      spos = this.solarSystem.getEclipticPosition(SATURN, time_JDE - lightDelay, null, 0);

    spos = Ecliptic.precessEcliptical3D(spos, time_JDE, JD_B1950);

    const L0 = spos.longitude.degrees;
    const B0 = spos.latitude.degrees;
    const DELTA = spos.radius;

    const t = time_JDE - lightDelay;
    const t1  = t - 2411093.0;
    const t2  = t1 / 365.25;
    const t3  = (t - 2433282.423) / 365.25 + 1950.0;
    const t4  = t - 2411368.0;
    const t5  = t4 / 365.25;
    const t6  = t - 2415020.0;
    const t7  = t6 / 36525.0;
    const t8  = t6 / 365.25;
    const t9  = (t - 2442000.5) / 365.25;
    const t10 = t - 2409786.0;
    const t11 = t10 / 36525.0;

    const W0 = 5.095 * (t3 - 1866.39);
    const W1 = 74.4 + 32.39 * t2;
    const W2 = 134.3 + 92.62 * t2;
    const W3 = 42.0 - 0.5118 * t5;
    const W4 = 276.59 + 0.5118 * t5;
    const W5 = 267.2635 + 1222.1136 * t7;
    const W6 = 175.4762 + 1221.5515 * t7;
    const W7 = 2.4891 + 0.002435 * t7;
    const W8 = 113.35 - 0.2597 * t7;

    let lambda = 0.0, r = 0.0, gamma = 0.0, OMEGA = 0.0, K = 0.0;
    let W: number;
    let L: number;
    let p = 0.0;
    let M: number;
    let C: number;
    let u: number;
    let w: number;
    const X: number[] = [];
    const Y: number[] = [];
    const Z: number[] = [];

    for (let j = 0; j < nmoons; ++j) {
      switch (j) {
        case 0: // I, Mimas
          L = 127.64 + 381.994497 * t1 - 43.57 * sin_deg(W0) - 0.720 * sin_deg(3.0 * W0)
              - 0.02144 * sin(5.0 * W0);
          p = 106.1 + 365.549 * t2;
          M = L - p;
          C = 2.18287 * sin_deg(M) + 0.025988 * sin_deg(2.0 * M) + 0.00043 * sin_deg(3.0 * M);
          lambda = L + C;
          r = 3.06879 / (1.0 + 0.01905 * cos_deg(M + C));
          gamma = 1.563;
          OMEGA = 54.5 - 365.072 * t2;
          K = 20947.0;
        break;

        case 1: // II, Enceladus
          L = 200.317 + 262.7319002 * t1 + 0.25667 *  sin_deg(W1) + 0.20883 * sin_deg(W2);
          p = 309.107 + 123.44121 * t2;
          M = L - p;
          C = 0.55577 * sin_deg(M) + 0.00168 * sin_deg(2.0 * M);
          lambda = L + C;
          r = 3.94118 / (1.0 + 0.00485 * cos_deg(M + C));
          gamma = 0.0262;
          OMEGA = 348.0 - 151.95 * t2;
          K = 23715.0;
        break;

        case 2: // III, Tethys
          lambda = 285.306 + 190.69791226 * t1 + 2.063 * sin_deg(W0)
                 + 0.03409 * sin_deg(3.0 * W0) + 0.001015 * sin_deg(5.0 * W0);
          r = 4.880998;
          gamma = 1.0976;
          OMEGA = 111.33 - 72.2441 * t2;
          K = 26382.0;
        break;

        case 3: // IV, Dione
          L = 254.712 + 131.53493193 * t1 - 0.0215 * sin_deg(W1) - 0.01733 * sin_deg(W2);
          p = 174.8 + 30.820 * t2;
          M = L - p;
          C = 0.24717 * sin_deg(M) + 0.00033 * sin_deg(2.0 * M);
          lambda = L + C;
          r = 6.24871 / (1.0 + 0.002157 * cos_deg(M + C));
          gamma = 0.0139;
          OMEGA = 232.0 - 30.27 * t2;
          K = 29876.0;
        break;

        case 4: // Outer moons
        case 5:
        case 6:
        case 7:
          let p1: number, a1: number, a2: number, N: number, i1: number, OMEGA1: number;
          let g0: number, psi: number, s: number, g: number, ww = 0.0, e1: number, q: number;
          let b1, b2, theta, h;
          let eta, zeta, theta1, as, bs, cs, phi, chi;
          let ww1, ww0, mu, l, g1, ls, gs, lT, gT, u1, u2, u3, u4, u5, w1, PHI;
          let e = 0.0, a = 0.0, i = 0.0, lambda1 = 0.0;
          let omi: OuterMoonInfo;

          switch (j) {
            case 4: // V, Rhea
              p1 = 342.7 + 10.057 * t2;
              a1 = 0.000265 * sin_deg(p1) + 0.01 * sin_deg(W4);
              a2 = 0.000265 * cos_deg(p1) + 0.01 * cos_deg(W4);
              e = sqrt(a1 * a1 + a2 * a2);
              p = atan2_deg(a1, a2);
              N = 345.0 - 10.057 * t2;
              lambda1 = 359.244 + 79.69004720 * t1 + 0.086754 * sin_deg(N);
              i = 28.0362 + 0.346890 * cos_deg(N) + 0.01930 * cos_deg(W3);
              OMEGA = 168.8034 + 0.73693 * sin_deg(N) + 0.041 * sin_deg(W3);
              a = 8.725924;
              // Not used: M = lambda1 - p;
              K = 35313.0;
            break;

            case 5: // VI, Titan
              L = 261.1582 + 22.57697855 * t4 + 0.074025 * sin_deg(W3);
              i1 = 27.45141 + 0.295999 * cos_deg(W3);
              OMEGA1 = 168.66925 + 0.628808 * sin_deg(W3);
              a1 = sin_deg(W7) * sin_deg(OMEGA1 - W8);
              a2 = cos_deg(W7) * sin_deg(i1) - sin_deg(W7) * cos_deg(i1) * cos_deg(OMEGA1 - W8);
              g0 = 102.8623;
              psi = atan2_deg(a1, a2);
              s = sqrt(a1 * a1 + a2 * a2);
              g = W4 - OMEGA1 - psi;

              for (let k = 0; k < 3; ++k) {
                ww = W4 + 0.37515 * (sin_deg(2.0 * g) - sin_deg(2.0 * g0));
                g = ww - OMEGA1 - psi;
              }

              e1 = 0.029092 + 0.00019048 * (cos_deg(2.0 * g) - cos_deg(2.0 * g0));
              q = 2.0 * (W5 - ww);
              b1 = sin_deg(i1) * sin_deg(OMEGA1 - W8);
              b2 = cos_deg(W7) * sin_deg(i1) * cos_deg(OMEGA1 - W8) - sin_deg(W7) * cos_deg(i1);
              theta = atan2_deg(b1, b2) + W8;
              e = e1 + 0.002778797 * e1 * cos_deg(q);
              p = ww + 0.159215 * sin_deg(q);
              u = 2.0 * W5 - 2.0 * theta + psi;
              h = 0.9375 * e1 * e1 * sin_deg(q) + 0.1875 * s * s * sin_deg(2.0 * (W5 - theta));
              lambda1 = L - 0.254744 * (e1 * sin_deg(W6) + 0.75 * e1 * e1 * sin_deg(2.0 * W6) + h);
              i = i1 + 0.031843 * s * cos_deg(u);
              OMEGA = OMEGA1 + 0.031843 * s * sin_deg(u) / sin_deg(i1);
              a = 20.216193;
              K = 53800.0;
            break;

            case 6: // VII, Hyperion
              eta = 92.39 + 0.5621071 * t6;
              zeta = 148.19 - 19.18 * t8;
              theta = 184.8 - 35.41 * t9;
              theta1 = theta - 7.5;
              as = 176.0 + 12.22 * t8;
              bs = 8.0 + 24.44 * t8;
              cs = bs + 5.0;
              ww = 69.898 - 18.67088 * t8;
              phi = 2.0 * (ww - W5);
              chi = 94.9 - 2.292 * t8;
              a = 24.50601 - 0.08686 * cos_deg(eta) - 0.00166 * cos_deg(zeta + eta)
                  + 0.00175 * cos_deg(zeta - eta);
              e = 0.103458 - 0.004099 * cos_deg(eta) - 0.000167 * cos_deg(zeta + eta)
                  + 0.000235 * cos_deg(zeta - eta) + 0.02303 * cos_deg(zeta)
                  - 0.00212 * cos_deg(2.0 * zeta)
                  + 0.000151 * cos_deg(3.0 * zeta) + 0.00013 * cos_deg(phi);
              p = ww + 0.15648 * sin_deg(chi) - 0.4457 * sin_deg(eta) - 0.2657 * sin_deg(zeta + eta)
                  - 0.3573 * sin_deg(zeta - eta) - 12.872 * sin_deg(zeta) + 1.668 * sin_deg(2.0 * zeta)
                  - 0.2419 * sin_deg(3.0 * zeta) - 0.07 * sin_deg(phi);
              lambda1 = 177.047 + 16.91993829 * t6 + 0.15648 * sin_deg(chi) + 9.142 * sin_deg(eta)
                      + 0.007 * sin_deg(2.0 * eta) - 0.014 * sin_deg(3.0 * eta)
                      + 0.2275 * sin_deg(zeta + eta)
                      + 0.2112 * sin_deg(zeta - eta) - 0.26 * sin_deg(zeta)
                      - 0.0098 * sin_deg(2.0 * zeta)
                      - 0.013 * sin_deg(as) + 0.017 * sin_deg(bs) - 0.0303 * sin_deg(phi);
              i = 27.3347 + 0.643486 * cos_deg(chi) + 0.315 * cos_deg(W3) + 0.018 * cos_deg(theta)
                  - 0.018 * cos_deg(cs);
              OMEGA = 168.6812 + 1.40136 * cos_deg(chi) + 0.68599 * sin_deg(W3)
                    - 0.0392 * sin_deg(cs) + 0.0366 * sin_deg(theta1);
              K = 59222.0;
            break;

            case 7: // VII, Iapetus
              L = 261.1582 + 22.57697855 * t4;
              ww1 = 91.769 + 0.562 * t7;
              psi = 4.367 - 0.195 * t7;
              theta = 146.819 - 3.198 * t7;
              phi = 60.470 + 1.521 * t7;
              PHI = 205.055 - 2.091 * t7;
              e1 = 0.028298 + 0.001156 * t11;
              ww0 = 352.91 + 11.71 * t11;
              mu = 76.3852 + 4.53795125 * t10;
              i1 = 18.4602 - 0.9518 * t11 - 0.072 * t11 * t11 + 0.0054 * t11 * t11 * t11;
              OMEGA1 = 143.198 - 3.919 * t11 + 0.116 * t11 * t11 + 0.008 * t11 * t11 * t11;
              l = mu - ww0;
              g = ww0 - OMEGA1 - psi;
              g1 = ww0 - OMEGA1 - phi;
              ls = W5 - ww1;
              gs = ww1 - theta;
              lT = L - W4;
              gT = W4 - PHI;
              u1 = 2.0 * (l + g - ls - gs);
              u2 = l + g1 - lT - gT;
              u3 = l + 2.0 * (g - ls - gs);
              u4 = lT + gT - g1;
              u5 = 2.0 * (ls + gs);
              a = 58.935028 + 0.004638 * cos_deg(u1) + 0.058222 * cos_deg(u2);
              e = e1 - 0.0014097 * cos_deg(g1 - gT) + 0.0003733 * cos_deg(u5 - 2.0 * g)
                  + 0.0001180 * cos_deg(u3) + 0.0002408 * cos_deg(l)
                  + 0.0002849 * cos_deg(l + u2) + 0.0006190 * cos_deg(u4);
              w = 0.08077 * sin_deg(g1 - gT) + 0.02139 * sin_deg(u5 - 2.0 * g) - 0.00676 * sin_deg(u3)
                  + 0.01380 * sin_deg(l) + 0.01632 * sin_deg(l + u2) + 0.03547 * sin_deg(u4);
              p = ww0 + w / e1;
              lambda1 = mu - 0.04299 * sin_deg(u2) - 0.00789 * sin_deg(u1) - 0.06312 * sin_deg(ls)
                      - 0.00295 * sin_deg(2.0 * ls) - 0.02231 * sin_deg(u5) + 0.00650 * sin_deg(u5 + psi);
              i = i1 + 0.04204 * cos_deg(u5 + psi) + 0.00235 * cos_deg(l + g1 + lT + gT + phi)
                  + 0.00360 * cos_deg(u2 + phi);
              w1 = 0.04204 * sin_deg(u5 + psi) + 0.00235 * sin_deg(l + g1 + lT + gT + phi)
                   + 0.00358 * sin_deg(u2 + phi);
              OMEGA = OMEGA1 + w1 / sin_deg(i1);
              K = 91820.0;
            break;
          }

          M = lambda1 - p;
          omi = SaturnMoons.solveOuterMoon(e, M, a, OMEGA, i, lambda1);

          lambda = omi.lambda;
          gamma = omi.gamma;
          OMEGA = omi.w;
          r = omi.r;
        break;
      }

      u = lambda - OMEGA;
      w = OMEGA - 168.8112;

      X[j] = r * (cos_deg(u) * cos_deg(w) - sin_deg(u) * cos_deg(gamma) * sin_deg(w));
      Y[j] = r * (sin_deg(u) * cos_deg(w) * cos_deg(gamma) + cos_deg(u) * sin_deg(w));
      Z[j] = r * sin_deg(u) * sin_deg(gamma);
    }

    // Now we set up a fictitious moon.
    X[nmoons] = 0.0;
    Y[nmoons] = 0.0;
    Z[nmoons] = 1.0;

    let A1: number, A2: number, A3: number, A4: number;
    let B1: number, B2: number, B3: number, B4: number;
    let C1: number, C2: number, C3: number, C4: number;
    let D = 0;
    let Y1: number;
    let moon: MoonInfo;

    // We'll loop backwards so we can compute D from the fictitious moon first.
    for (let j = nmoons; j >= 0; --j) {
      // Rotate towards the plane of the ecliptic
      A1 = X[j];
      B1 = c1 * Y[j] - s1 * Z[j];
      C1 = s1 * Y[j] + c1 * Z[j];
      // Rotate towards the vernal equinox
      A2 = c2 * A1 - s2 * B1;
      B2 = s2 * A1 + c2 * B1;
      C2 = C1;
      // Meeus does not explain these last two rotations, but they're
      // obviously related to accounting for the location of Saturn.
      A3 = A2 * sin_deg(L0) - B2 * cos_deg(L0);
      B3 = A2 * cos_deg(L0) + B2 * sin_deg(L0);
      C3 = C2;

      A4 = A3;
      B4 = C3 * sin_deg(B0) + B3 * cos_deg(B0);
      C4 = C3 * cos_deg(B0) - B3 * sin_deg(B0);

      if (j === nmoons)
        D = atan2(A4, C4);
      else {
        X[j] = A4 * cos(D) - C4 * sin(D);
        Y[j] = A4 * sin(D) + C4 * cos(D);
        Z[j] = B4;

        W = DELTA / (DELTA + Z[j] / 2475.0);

        X[j] += abs(Z[j]) / K * sqrt(1.0 - squared(X[j] / r));
        X[j] *= W;
        Y[j] *= W;

        moon = <MoonInfo> {};
        moon.moonIndex = j + FIRST_SATURN_MOON;
        moon.X = X[j];
        moon.Y = Y[j];
        moon.Z = Z[j];
        moon.inferior = (moon.Z <= 0.0);
        Y1 = moon.Y * this.flattening;
        moon.withinDisc = (sqrt(moon.X * moon.X + Y1 * Y1) < 1.0);
        moon.inFrontOfDisc = moon.withinDisc && moon.inferior;
        moon.behindDisc = moon.withinDisc && !moon.inferior;

        moons[j] = moon;
      }
    }

    return moons;
  }

  private static solveOuterMoon(e, M, a, OMEGA, i, lambda1): OuterMoonInfo {
    const omi = <OuterMoonInfo> {};
    const e2 = e * e;
    const e3 = e2 * e;
    const e4 = e3 * e;
    const e5 = e4 * e;

    const C = to_degree((2.0 * e - 0.25 * e3 + 0.0520833333 * e5) * sin_deg(M)
              + (1.25 * e2 - 0.458333333 * e4) * sin_deg(2.0 * M)
              + (1.083333333 * e3 - 0.671875 * e5) * sin_deg(3.0 * M)
              + 1.072917 * e4 * sin_deg(4.0 * M) + 1.142708 * e5 * sin_deg(5.0 * M));

    omi.r = a * (1.0 - e2) / (1.0 + e * cos_deg(M + C));

    const g = OMEGA - 168.8112;
    const a1 = sin_deg(i) * sin_deg(g);
    const a2 = c1 * sin_deg(i) * cos_deg(g) - s1 * cos_deg(i);

    omi.gamma = asin_deg(sqrt(a1 * a1 + a2 * a2));

    const u = atan2_deg(a1, a2);

    omi.w = 168.8112 + u;

    const h = c1 * sin_deg(i) - s1 * cos_deg(i) * cos_deg(g);
    const psi = atan2_deg(s1 * sin_deg(g), h);

    omi.lambda = lambda1 + C + u - g - psi;

    return omi;
  }
}

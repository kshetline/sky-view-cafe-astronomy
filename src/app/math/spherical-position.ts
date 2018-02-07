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

import { Angle, Mode, Unit } from './angle';
import { abs, acos, limitNeg1to1, mod2, TWO_PI } from '../util/ks-math';
import * as _ from 'lodash';

export class SphericalPosition {
  protected _longitude: Angle;
  protected _latitude: Angle;

  constructor(longitude: Angle | number = 0, latitude: Angle | number = 0,
              longUnit = Unit.RADIANS, latUnit = Unit.RADIANS) {
    if (_.isNumber(longitude))
      this._longitude = new Angle(<number> longitude, longUnit, Mode.RANGE_LIMIT_NONNEGATIVE);
    else
      this._longitude = <Angle> longitude;

    if (_.isNumber(latitude))
      this._latitude = new Angle(<number> latitude, latUnit);
    else
      this._latitude = <Angle> latitude;
  }

  public get longitude(): Angle {
    return this._longitude;
  }

  public get rightAscension(): Angle {
    return this._longitude;
  }

  public get altitude(): Angle {
    return this._latitude;
  }

  public get azimuth(): Angle {
    return this._longitude;
  }

  public get latitude(): Angle {
    return this._latitude;
  }

  public get declination(): Angle {
    return this._latitude;
  }

  public distanceFrom(p: SphericalPosition): Angle {
    // Tiny rounding errors which can make the argument of acos very slightly larger than 1.0
    // or very slight smaller than -1.0 are enough to blow up the acos function and get you a
    // NaN for your trouble.
    //
    let d = acos(limitNeg1to1(this._latitude.sin * p._latitude.sin +
                              this._latitude.cos * p._latitude.cos *
                              this._longitude.subtract(p._longitude).cos));

    d = abs(mod2(d, TWO_PI));

    return new Angle(d);
  }

  public toString(): string {
    return 'lon: ' + this.longitude + ', lat: ' + this.latitude;
  }
}

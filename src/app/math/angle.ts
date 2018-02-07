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

import { abs, floor, mod, mod2, pow, round } from '../util/ks-math';
import { isUndefined } from 'util';

export enum Unit {RADIANS, DEGREES, ARC_MINUTES, ARC_SECONDS, HOURS, HOUR_ANGLE_MINUTES, HOUR_ANGLE_SECONDS, ROTATIONS, GRADS}
export enum Mode {RANGE_LIMIT_SIGNED, RANGE_LIMIT_NONNEGATIVE, RANGE_UNLIMITED}

export const PI      = Math.PI;
export const HALF_PI = PI / 2.0;
export const TWO_PI  = PI * 2.0;

export const FMT_DD = 0x01;
export const FMT_HH = 0x01;
export const FMT_DDD = 0x02;
export const FMT_MINS = 0x04;
export const FMT_SECS = 0x08;
export const FMT_SIGNED = 0x10;

export function convertToRadians(angle: number, unit: Unit): number {
  switch (unit) {
    case Unit.RADIANS:
      return angle;
    case Unit.DEGREES:
      return angle / 180.0 * PI;
    case Unit.ARC_MINUTES:
      return angle / 10800.0 * PI;
    case Unit.ARC_SECONDS:
      return angle / 648000.0 * PI;
    case Unit.HOURS:
      return angle / 12.0 * PI;
    case Unit.HOUR_ANGLE_MINUTES:
      return angle / 720.0 * PI;
    case Unit.HOUR_ANGLE_SECONDS:
      return angle / 43200.0 * PI;
    case Unit.ROTATIONS:
      return angle * TWO_PI;
    case Unit.GRADS:
      return angle / 200.0 * PI;
  }

  return NaN;
}

export function convertFromRadians(angle: number, unit: Unit): number {
  switch (unit) {
    case Unit.RADIANS:
      return angle;
    case Unit.DEGREES:
      return angle * 180.0 / PI;
    case Unit.ARC_MINUTES:
      return angle * 10800.0 / PI;
    case Unit.ARC_SECONDS:
      return angle * 648000.0 / PI;
    case Unit.HOURS:
      return angle * 12.0 / PI;
    case Unit.HOUR_ANGLE_MINUTES:
      return angle * 720.0 / PI;
    case Unit.HOUR_ANGLE_SECONDS:
      return angle * 43200.0 / PI;
    case Unit.ROTATIONS:
      return angle / TWO_PI;
    case Unit.GRADS:
      return angle * 200.0 / PI;
  }

  return NaN;
}

export class Angle {
  public static ZERO     = new Angle(0.0);
  public static RIGHT    = new Angle(HALF_PI);
  public static STRAIGHT = new Angle(PI);

  private angle: number; // In radians
  private cached_sin = 2.0;
  private cached_cos = 2.0;
  private cached_tan = 0.0;

  public static asin(x: number): Angle {
    return new Angle(Math.asin(x));
  }

  public static asin_nonneg(x: number): Angle {
    return new Angle(Math.asin(x), Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  public static acos(x: number): Angle {
    return new Angle(Math.acos(x));
  }

  public static atan(x: number): Angle {
    return new Angle(Math.atan(x));
  }

  public static atan_nonneg(x: number): Angle {
    return new Angle(Math.atan(x), Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  public static atan2(y: number, x: number): Angle {
    return new Angle(Math.atan2(y, x));
  }

  public static atan2_nonneg(y: number, x: number): Angle {
    return new Angle(Math.atan2(y, x), Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  constructor(angle = 0, unit?: Unit, mode = Mode.RANGE_LIMIT_SIGNED) {
    if (unit === undefined)
        unit = Unit.RADIANS;

    if (mode === Mode.RANGE_LIMIT_SIGNED)
      this.angle = mod2(convertToRadians(angle, unit), TWO_PI);
    else if (mode === Mode.RANGE_LIMIT_NONNEGATIVE)
      this.angle = mod(convertToRadians(angle, unit), TWO_PI);
    else
      this.angle = convertToRadians(angle, unit);
  }

  public get radians(): number {
    return this.angle;
  }

  public get degrees(): number {
    return convertFromRadians(this.angle, Unit.DEGREES);
  }

  public get arcMinutes(): number {
    return convertFromRadians(this.angle, Unit.ARC_MINUTES);
  }

  public get arcSeconds(): number {
    return convertFromRadians(this.angle, Unit.ARC_SECONDS);
  }

  public get hours(): number {
    return convertFromRadians(this.angle, Unit.HOURS);
  }

  public get rotations(): number {
    return convertFromRadians(this.angle, Unit.ROTATIONS);
  }

  public get grads(): number {
    return convertFromRadians(this.angle, Unit.GRADS);
  }

  public getAngle(unit = Unit.RADIANS): number {
    return convertFromRadians(this.angle, unit);
  }

  public get sin(): number {
    if (this.cached_sin > 1.0)
      this.cached_sin = Math.sin(this.angle);

    return this.cached_sin;
  }

  public get cos(): number {
    if (this.cached_cos > 1.0)
      this.cached_cos = Math.cos(this.angle);

    return this.cached_cos;
  }

  public get tan(): number {
    if (this.angle === 0.0)
      return 0.0;
    else if (this.cached_tan === 0.0)
      this.cached_tan = Math.tan(this.angle);

    return this.cached_tan;
  }

  public add(angle2: Angle, mode = Mode.RANGE_LIMIT_SIGNED): Angle {
    return new Angle(this.angle + angle2.angle, Unit.RADIANS, mode);
  }

  public add_nonneg(angle2: Angle): Angle {
    return new Angle(this.angle + angle2.angle, Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  public subtract(angle2: Angle, mode = Mode.RANGE_LIMIT_SIGNED): Angle {
    return new Angle(this.angle - angle2.angle, Unit.RADIANS, mode);
  }

  public subtract_nonneg(angle2: Angle): Angle {
    return new Angle(this.angle - angle2.angle, Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  public complement(mode = Mode.RANGE_LIMIT_SIGNED): Angle {
    return new Angle(HALF_PI - this.angle, Unit.RADIANS, mode);
  }

  public complement_nonneg(): Angle {
    return new Angle(HALF_PI - this.angle, Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  public supplement(mode = Mode.RANGE_LIMIT_SIGNED): Angle {
    return new Angle(PI - this.angle, Unit.RADIANS, mode);
  }

  public supplement_nonneg(): Angle {
    return new Angle(PI - this.angle, Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  public opposite(mode = Mode.RANGE_LIMIT_SIGNED): Angle {
    return new Angle(this.angle + PI, Unit.RADIANS, mode);
  }

  public opposite_nonneg(): Angle {
    return new Angle(this.angle + PI, Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  public negate(mode = Mode.RANGE_LIMIT_SIGNED): Angle {
    return new Angle(-this.angle, Unit.RADIANS, mode === undefined ? Mode.RANGE_UNLIMITED : mode);
  }

  // Sounds contradictory, doesn't it? Return whatever angle is 180 degrees away, as a non-negative value.
  public negate_nonneg(): Angle {
    return new Angle(-this.angle, Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  public multiply(x: number, mode = Mode.RANGE_LIMIT_SIGNED): Angle {
    return new Angle(this.angle * x, Unit.RADIANS, mode);
  }

  public multiply_nonneg(x: number): Angle {
    return new Angle(this.angle * x, Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  public divide(x: number, mode = Mode.RANGE_LIMIT_SIGNED): Angle {
    return new Angle(this.angle / x, Unit.RADIANS, mode);
  }

  public divide_nonneg(x: number): Angle {
    return new Angle(this.angle / x, Unit.RADIANS, Mode.RANGE_LIMIT_NONNEGATIVE);
  }

  public toString(format?: number, precision?: number): string {
    return Angle.toStringAux(this.degrees, '\u00B0', '\'', '"', format, precision);
  }

  public toSuffixedString(positiveSuffix: string, negativeSuffix: string,
                          format?: number, precision?: number): string {
    return Angle.toStringAux(abs(this.degrees), '\u00B0', '\'', '"', format, precision) +
           (this.degrees < 0 ? negativeSuffix : positiveSuffix);
  }

  public toHourString(format?: number, precision?: number): string {
    return Angle.toStringAux(this.hours, 'h', 'm', 's', format, precision);
  }

  public toTimeString(format?: number, precision?: number): string {
    return Angle.toStringAux(this.hours, ':', format === FMT_MINS ? '' : ':', '', format, precision, 2);
  }

  private static toStringAux(units: number, delim1: string, delim2: string, delim3: string,
                             format: number, precision: number, unitsPadding = 0): string {
    format = (format ? format : 0);

    const sxg = ((format & (FMT_MINS | FMT_SECS)) !== 0);

    if ((format & FMT_DD) !== 0)
      unitsPadding = 2;
    else if ((format & FMT_DDD) !== 0)
      unitsPadding = 3;

    if (isUndefined(precision)) {
      if (!isUndefined(format) && sxg)
        precision = 0;
      else
        precision = 3;
    }

    const sign = Math.sign(units);
    units = abs(units);
    let result: string;

    if (sxg) {
      const pwr = pow(10, precision);

      if ((format & FMT_MINS) !== 0) {
        let mins = round(units * 60 * pwr) / pwr;

        units = floor(mins / 60);
        mins = mins % 60;
        result = units + delim1 + (mins < 10 ? '0' : '') + mins.toFixed(precision) + delim2;
      }
      else {
        let secs = round(units * 3600 * pwr) / pwr;
        let mins = floor(secs / 60);

        secs = secs % 60;
        units = floor(mins / 60);
        mins = mins % 60;

        result = units + delim1 + (mins < 10 ? '0' : '') + mins + delim2
                + (secs < 10 ? '0' : '') + secs.toFixed(precision) + delim3;
      }
    }
    else {
      result = units.toFixed(precision) + delim1;
    }

    if (unitsPadding) {
      const match = /^(\d+)\D/.exec(result);
      const padding = unitsPadding - match[1].length;

      for (let i = 0; i < padding; ++i)
        result = '0' + result;
    }

    if (sign < 0)
      result = '-' + result;
    else if ((format & FMT_SIGNED) !== 0)
      result = '+' + result;

    return result;
  }
}

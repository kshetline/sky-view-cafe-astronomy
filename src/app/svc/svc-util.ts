import { abs, div_rd, round, sign } from '@tubular/math';
import { padLeft } from '@tubular/util';

export function formatLatitude(lat: number): string {
  const theSign = sign(lat);
  let minutes = round(abs(lat) * 60);
  const degrees = div_rd(minutes, 60);
  minutes -= degrees * 60;

  return padLeft(degrees, 2, '0') + '°' + padLeft(minutes, 2, '0') + '\'' + (theSign < 0 ? 'S' : 'N');
}

export function formatLongitude(lon: number): string {
  const theSign = sign(lon);
  let minutes = round(abs(lon) * 60);
  const degrees = div_rd(minutes, 60);
  minutes -= degrees * 60;

  return padLeft(degrees, 3, '0') + '°' + padLeft(minutes, 2, '0') + '\'' + (theSign < 0 ? 'W' : 'E');
}

export function hasOneOf<T>(set: Set<T>, list: T[]): boolean {
  for (const item of list) {
    if (set.has(item))
      return true;
  }

  return false;
}

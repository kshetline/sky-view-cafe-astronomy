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

import { SolarSystem } from './solar-system';
import * as _ from 'lodash';
import { UT_to_TDB } from './ut-converter';
import { floor, max, min, sqrt } from '../util/ks-math';
import { FIRST_JUPITER_MOON, NO_MATCH } from './astro-constants';
import { extendDelimited } from '../util/ks-util';

export const AS_SEEN_FROM_EARTH = false;
export const AS_SEEN_FROM_SUN   = true;
export const MOON_ITSELF        = false;
export const MOON_SHADOW        = true;

export enum MoonEvent { TR_I = 1, // Transit Ingress - begins transit
                        TR_E,     // Transit Egress  - ends transit
                        OC_D,     // Occultation Disappears - becomes occulted
                        OC_R,     // Occultation Reappears  - emerges from occultation
                        EC_D,     // Eclipse Disappears - becomes eclipsed
                        EC_R,     // Eclipse Reappears  - emerges from eclipse
                        SH_I,     // Shadow Ingress - shadow of moon appears
                        SH_E      // Shadow Egress  - shadow of moon ends
}

const moonNumbers = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
                     'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

const moonEvents = ['{0} Tr.I.', '{0} Tr.E.', '{0} Oc.D.', '{0} Oc.R.',
                    '{0} Ec.D.', '{0} Ec.R.', '{0} Sh.I.', '{0} Sh.E.'];
const moonEventsLong = ['{0} begins transit', '{0} ends transit', '{0} becomes occulted', '{0} emerges from occultation',
                        '{0} becomes eclipsed', '{0} emerges from eclipse', 'Shadow of {0} appears', 'Shadow of {0} ends'];

const CACHE_SIZE = 6;


interface MoonNameInfo {
  first: number;
  last: number;
  names: string[];
  shadowNames: string[];
}

export interface MoonInfo {
  moonIndex: number;
  X: number;
  Y: number;
  Z: number;
  inferior: boolean;
  withinDisc: boolean;
  inFrontOfDisc: boolean; // This is a transit for earth-perspective info, a shadow for sun-perspective.
  behindDisc: boolean;    // This is an occultation for earth-perspective info, an eclipse for sun-perspective.
}

export class MoonEvents {
  t0: number;
  t1: number;
  count = 0;
  events: MoonEvent[];
  shadowEvents: MoonEvent[];
  text = '';
  searchDeltaT = 1; // In minutes
}

export abstract class PlanetaryMoons {
  protected static namesList: MoonNameInfo[] = [];

  protected cachedTimes: number[][] = [];
  protected cachedMoons: MoonInfo[][][] = [];

  protected solarSystem = new SolarSystem();
  protected flattening;
  // Approximate maximum rates at which a moon's x coordinate changes, used as a hint
  // for speeding up the process of finding moon events. If null, event finding must be
  // done minute-by-minute.
  protected v_max: number[]; // planet radii per minute

  constructor() {
    this.cachedTimes[0] = [];
    this.cachedTimes[1] = [];
    this.cachedMoons[0] = [];
    this.cachedMoons[1] = [];
  }

  public getMoonPosition(moonIndex: number, time_JDE: number, sunPerspective = false): MoonInfo {
    const moons = this.getMoonPositions(time_JDE, sunPerspective, false);

    for (const moon of moons) {
      if (moon.moonIndex === moonIndex)
        return _.clone(moon);
    }

    return undefined;
  }

  public getMoonPositions(time_JDE: number, sunPerspective = false, makeClones = true): MoonInfo[] {
    const index = (sunPerspective ? 1 : 0);
    let moons: MoonInfo[];

    for (let i = 0; i < CACHE_SIZE; ++i) {
      if (time_JDE === this.cachedTimes[index][i] && !_.isUndefined(this.cachedMoons[index][i])) {
        moons = this.cachedMoons[index][i];
        break;
      }
    }

    if (!moons) {
      moons = this.getMoonPositionsAux(time_JDE, sunPerspective);

      // Shuffle cache
      for (let i = 0; i < CACHE_SIZE - 1; ++i) {
        this.cachedTimes[index][i] = this.cachedTimes[index][i + 1];
        this.cachedMoons[index][i] = this.cachedMoons[index][i + 1];
      }

      this.cachedTimes[index][CACHE_SIZE - 1] = time_JDE;
      this.cachedMoons[index][CACHE_SIZE - 1] = moons;
    }

    if (!makeClones)
      return moons;

    const result: MoonInfo[] = [];

    for (const moon of moons)
      result.push(_.clone(moon));

    return result;
  }

  protected abstract getMoonPositionsAux(time_JDE: number, sunPerspective: boolean): MoonInfo[];

  // Note: The span considered is +/- 30 seconds of the specified time *in Universal Time*.
  //
  public getMoonEventsForOneMinuteSpan(time_JDU: number, longFormat = false): MoonEvents {
    const events = new MoonEvents();
    const t0 = UT_to_TDB(time_JDU - 0.5 / 1440.0);
    const t1 = UT_to_TDB(time_JDU + 0.5 / 1440.0);
    const pos0 = this.getMoonPositions(t0);
    const pos1 = this.getMoonPositions(t1);
    const sunPos0 = this.getMoonPositions(t0, AS_SEEN_FROM_SUN);
    const sunPos1 = this.getMoonPositions(t1, AS_SEEN_FROM_SUN);
    const nmoons = pos0.length;

    events.events = [];
    events.shadowEvents = [];
    events.searchDeltaT = (!this.v_max ? 1 : 120); // At the very most, put off more event checking for two hours.
    events.t0 = t0;
    events.t1 = t1;

    if (this.v_max) {
      let Y1: number;
      let d: number;
      let deltaT: number;

    findSearchTime:
      for (let i = 0; i < nmoons; ++i) {
        for (let j = 0; j < 4; ++j) {
          let pos: MoonInfo[];

          switch (j) {
            case 0:  pos = pos0;    break;
            case 1:  pos = pos1;    break;
            case 2:  pos = sunPos0; break;
            case 3:
            default: pos = sunPos1; break;
          }

          Y1 = pos[i].Y * this.flattening;
          d  = sqrt(pos[i].X * pos[i].X + Y1 * Y1);

          if (d > 1.0)
            d -= 1.0;
          else
            d = 1.0 - d;

          deltaT = max(floor(d / this.v_max[i] * 0.75), 1);
          events.searchDeltaT = min(deltaT, events.searchDeltaT);

          if (deltaT === 1)
            break findSearchTime;
        }
      }
    }

    for (let i = 0; i < nmoons; ++i) {
      const tr0 = pos0[i].inFrontOfDisc;
      const tr1 = pos1[i].inFrontOfDisc;
      const oc0 = pos0[i].behindDisc;
      const oc1 = pos1[i].behindDisc;
      const ec0 = sunPos0[i].behindDisc;
      const ec1 = sunPos1[i].behindDisc;
      const sh0 = sunPos0[i].inFrontOfDisc;
      const sh1 = sunPos1[i].inFrontOfDisc;

      if (!tr0 && tr1) {
        ++events.count;
        events.events[i] = MoonEvent.TR_I;
      }
      else if (tr0 && !tr1) {
        ++events.count;
        events.events[i] = MoonEvent.TR_E;
      }
      else if (!oc0 && oc1 && !ec0) {
        ++events.count;
        events.events[i] = MoonEvent.OC_D;
      }
      else if (oc0 && !oc1 && !ec1) {
        ++events.count;
        events.events[i] = MoonEvent.OC_R;
      }
      else if (!ec0 && ec1 && !oc0) {
        ++events.count;
        events.events[i] = MoonEvent.EC_D;
      }
      else if (ec0 && !ec1 && !oc1) {
        ++events.count;
        events.events[i] = MoonEvent.EC_R;
      }

      if (!sh0 && sh1) {
        ++events.count;
        events.shadowEvents[i] = MoonEvent.SH_I;
      }
      else if (sh0 && !sh1) {
        ++events.count;
        events.shadowEvents[i] = MoonEvent.SH_E;
      }
    }

    if (events.count > 0) {
      let eventNames: string[];
      const pad: string[] = [];
      let maxNumLen = 0;
      let eventText: string;

      if (longFormat)
        eventNames = moonEventsLong;
      else
        eventNames = moonEvents;

      for (let i = 0; i < nmoons; ++i)
        maxNumLen = max(moonNumbers[i + 1].length, maxNumLen);

      if (!longFormat) {
        for (let i = 0; i < nmoons; ++i)
          pad.push(' '.repeat(maxNumLen - moonNumbers[i + 1].length));
      }

      for (let i = 0; i < nmoons; ++i) {
        let moonName: string;

        if (longFormat)
          moonName = PlanetaryMoons.getMoonName(FIRST_JUPITER_MOON + i);
        else
          moonName = pad[i] + moonNumbers[i + 1];

        for (let j = 0; j < 2; ++j) {
          const list = (j === 0 ? events.events : events.shadowEvents);

          if (list[i]) {
            eventText = eventNames[list[i] - 1];
            eventText = eventText.replace('{0}', moonName);
            events.text = extendDelimited(events.text, eventText);
          }
        }
      }
    }

    return events;
  }

  public static getMoonName(moonIndex: number, getShadow = MOON_ITSELF): string {
    for (const mni of PlanetaryMoons.namesList) {
      if (mni.first <= moonIndex && moonIndex <= mni.last) {
        moonIndex -= mni.first;

        return (getShadow ? mni.shadowNames[moonIndex] : mni.names[moonIndex]);
      }
    }

    return undefined;
  }

  public static getMoonNumber(moonIndex: number): string {
    moonIndex %= 1000;

    if (moonIndex <= 0 || moonIndex >= moonNumbers.length)
      return String(moonIndex);
    else
      return moonNumbers[moonIndex];
  }

  public static getMoonByName(moonName: string): number {
    moonName = moonName.toLowerCase();

    for (const mni of this.namesList) {
      for (let j = 0; j < mni.names.length; ++j) {
        if (mni.names[j].toLowerCase() === moonName)
          return mni.first + j;
      }
    }

    return NO_MATCH;
  }

  protected static registerMoonNames(first: number, last: number, names: string[], shadowNames: string[]): void {
    const mni = <MoonNameInfo> {};

    mni.first = first;
    mni.last = last;
    mni.names = names;
    mni.shadowNames = shadowNames;

    this.namesList.push(mni);
  }
}

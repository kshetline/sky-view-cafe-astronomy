import { Timezone } from '@tubular/time';
import { eqci } from './common';
import { adjustUSCountyName } from './gazetteer';

function addParenthetical(s: string): string {
  return ` (${s})`;
}

function compare(a: string, b: string): number {
  if (!a && !b)
    return 0;
  else if (!a)
    return -1;
  else if (!b)
    return 1;
  else
    return a.localeCompare(b, 'en');
}

export class AtlasLocation {
  city: string;
  variant: string;
  county: string;
  showCounty: boolean;
  state: string;
  showState: boolean;
  country: string;
  longCountry: string;
  flagCode: string;
  latitude: number;
  longitude: number;
  elevation: number;
  zone: string;
  zip: string;
  rank: number;
  placeType: string;
  source: string;
  matchedByAlternateName = false;
  matchedBySound = false;
  geonamesID?: number;
  useAsUpdate?: boolean;

  getZoneOffset(): number {
    const zoneName = /(.*?)(\?)?$/.exec(this.zone)[1];
    const zone = Timezone.getTimezone(zoneName);

    return Math.round(zone.utcOffset / 60);
  }

  getZoneDst(): number {
    const zoneName = /(.*?)(\?)?$/.exec(this.zone)[1];
    const zone = Timezone.getTimezone(zoneName);

    return Math.round(zone.dstOffset / 60);
  }

  get displayName(): string {
    let city = this.city;
    let county = this.county;
    let cityQualifier = '';
    let displayState;
    let stateQualifier = '';
    let showState = this.showState;

    if (this.country === 'USA' || this.country === 'CAN' && this.placeType !== 'A.ADM0') {
      if (this.placeType !== 'A.ADM1')
        displayState = this.state;
      else
        displayState = this.country;

      if (this.country === 'USA') {
        if (this.placeType === 'A.ADM2')
          city = adjustUSCountyName(city, this.state);
        else
          county = adjustUSCountyName(county, this.state);
      }
    }
    else {
      displayState = this.country;

      if (this.country === 'GBR' && this.state) {
        stateQualifier = addParenthetical(this.state);
        showState = false;
      }
      else if (this.longCountry && this.placeType !== 'A.ADM0')
        stateQualifier = addParenthetical(this.longCountry);
    }

    if (county && this.showCounty)
      cityQualifier = addParenthetical(county);

    if (this.state && showState)
      stateQualifier += addParenthetical(this.state);

    if (this.placeType === 'T.CAPE')
      stateQualifier += ' (cape)';
    else if (this.placeType === 'H.LK')
      stateQualifier += ' (lake)';
    else if (this.placeType === 'L.PRK')
      stateQualifier += ' (park)';
    else if (this.placeType === 'T.PK')
      stateQualifier += ' (peak)';
    else if (this.placeType === 'L.MILB')
      stateQualifier += ' (military base)';
    else if (this.placeType === 'A.ADM2') {
      if (/ (Borough|Census Area|County|Division|Parish)/i.test(city)) {
        stateQualifier += ' (county)';
      }
    }
    else if (this.placeType === 'T.ISL')
      stateQualifier += ' (island)';
    else if (this.placeType === 'S.ASTR' || this.placeType === 'T.POLE')
      stateQualifier += ' (geographic point)';
    else if (this.placeType === 'T.MT')
      stateQualifier += ' (mountain)';
    else if (this.placeType === 'A.ADM0')
      stateQualifier += ' (nation)';
    else if (this.placeType === 'S.OBS')
      stateQualifier += ' (observatory)';
    else if (this.placeType === 'A.ADM1' && this.country === 'CAN')
      stateQualifier += ' (province)';
    else if (this.placeType === 'A.ADM1' && this.country === 'USA')
      stateQualifier += ' (state)';

    return city + cityQualifier + (displayState ? ', ' + displayState : '') + stateQualifier;
  }

  set displayName(s: string) { /* Allow but ignore so this can be set via JSON without causing an error. */ }

  isCloseMatch(other: AtlasLocation): boolean {
    return eqci(this.city, other.city) &&
           eqci(this.variant, other.variant) &&
           eqci(this.county, other.county) &&
           eqci(this.state, other.state) &&
           eqci(this.country, other.country) &&
           Math.abs(this.latitude - other.latitude) < 0.0001 &&
           Math.abs(this.longitude - other.longitude) < 0.0001 &&
           this.elevation === other.elevation &&
           this.zone === other.zone &&
           this.zip === other.zip &&
           this.placeType === other.placeType;
  }

  toString(): string {
    return `${this.displayName} - lat: ${this.latitude}, long: ${this.longitude};` +
      (this.zip ? ` zip: ${this.zip};` : '') +
      ` zone: ${this.zone}; placeType: ${this.placeType}; source: ${this.source}; rank: ${this.rank}` +
      (this.flagCode ? ` flagCode: ${this.flagCode};` : '') +
      (this.matchedByAlternateName ? ' matchedByAlternateName;' : '') +
      (this.matchedBySound ? ' matchedBySound;' : '');
  }

  toJSON(): any {
    const copy: any = {};

    Object.assign(copy, this);
    copy.displayName = this.displayName;
    copy.zoneOffset = this.getZoneOffset();
    copy.zoneDst = this.getZoneDst();
    delete copy.geonameID;
    delete copy.useAsUpdate;

    return copy;
  }

  compareTo(other: AtlasLocation): number {
    let comparison = (other.rank || 0) - (this.rank || 0);

    if (comparison)
      return comparison;

    comparison = compare(this.city, other.city);

    if (comparison)
      return comparison;

    comparison = compare(this.country, other.country);

    if (comparison)
      return comparison;

    return compare(this.state, other.state);
  }
}

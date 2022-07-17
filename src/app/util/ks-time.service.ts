import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { timeout } from 'rxjs/operators';

// noinspection JSUnusedGlobalSymbols
export interface RegionAndSubzones {
  region: string;
  subzones: string[];
}

export interface ZoneForLocation {
  status: string;
  dstOffset?: number;
  rawOffset?: number;
  timeZoneId?: string;
  timeZoneName?: string;
  errorMessage?: string;
}

@Injectable()
export class KsTimeService {
  constructor(private httpClient: HttpClient) {}

  getZoneForLocation(longitude: number, latitude: number, timestamp?: number | null, timeoutValue?: number): Promise<ZoneForLocation> {
    if (timestamp === null || timestamp === undefined)
      timestamp = Math.floor(Date.now() / 1000);

    const params = 'lon=' + longitude + '&lat=' + latitude + '&timestamp=' + timestamp;

    if (!timeoutValue)
      timeoutValue = 60000;

    return this.httpClient.get<ZoneForLocation>('/api/zoneloc/?' + params).pipe(timeout(timeoutValue)).toPromise();
  }
}

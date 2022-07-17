import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { urlEncodeParams } from '@tubular/util';

const PING_INTERVAL = 1800000; // half hour

export interface AtlasLocation {
  displayName: string;
  city: string;
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
  zoneOffset: number; // in minutes
  zoneDst: number; // in minutes
  zip: string;
  rank: number;
  placeType: string;
  source: number;
  matchedByAlternateName: boolean;
  matchedBySound: boolean;
}

export interface AtlasResults {
  originalSearch: string;
  normalizedSearch: string;
  time: number;
  error: string;
  warning: string;
  info: string;
  limitReached: boolean;
  matches: AtlasLocation[];
}

@Injectable()
export class SvcAtlasService {
  private static states: string[];
  private static statesPromise: Promise<string[]>;

  private readonly hostname: string;
  private readonly port: number;
  private readonly localTesting: boolean;
  private lastPing = -Number.MAX_SAFE_INTEGER;

  constructor(private httpClient: HttpClient) {
    this.hostname = document.location.hostname;
    this.port = parseInt(document.location.port, 10);
    this.localTesting = (this.hostname === 'localhost' || this.hostname === '127.0.0.1' || this.port === 4200);
  }

  search(q: string, extend?: boolean, fast = false): Promise<AtlasResults> {
    const params = urlEncodeParams({
      client: 'svc',
      notrace: this.localTesting ? 'true' : null,
      pt: 'false',
      q,
      remote: extend ? 'extend' : fast ? 'skip' : null
    });

    return this.httpClient.get<AtlasResults>('api/atlas/?' + params).toPromise();
  }

  getStates(): Promise<string[]> {
    if (SvcAtlasService.states)
      return Promise.resolve(SvcAtlasService.states);
    else if (SvcAtlasService.statesPromise)
      return SvcAtlasService.statesPromise;

    SvcAtlasService.statesPromise = this.httpClient.get<string[]>('api/states/').toPromise().then(data => {
      SvcAtlasService.states = data;

      return data;
    });

    return SvcAtlasService.statesPromise;
  }

  ping(): void {
    if (performance.now() > this.lastPing + PING_INTERVAL) {
      // We don't care about nor need to return these results.
      this.httpClient.get('/api/maps/ping').subscribe(() => this.lastPing = performance.now());
    }
  }

  async getTimezoneMapUrl(): Promise<string> {
    return await this.httpClient.get<string>('/api/zonemap').toPromise();
  }
}

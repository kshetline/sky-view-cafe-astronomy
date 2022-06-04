import { Request, Response, Router } from 'express';

import { asyncHandler, notFoundForEverythingElse, formatVariablePrecision } from './common';
import { doDataBaseSearch, hasSearchBeenDoneRecently, logMessage, logSearchResults, pool } from './atlas_database';
import {
  celestialNames, initGazetteer, LocationMap, ParsedSearchString, parseSearchString,
  roughDistanceBetweenLocationsInKm
} from './gazetteer';
import { SearchResult } from './search-result';
import { AtlasLocation } from './atlas-location';
import { MapClass } from './map-class';
import { GettyMetrics, gettySearch } from './getty-search';
import { initTimezones } from './timezones';
import { GeonamesMetrics, geonamesSearch } from './geonames-search';
import { svcApiConsole } from './svc-api-logger';
import { toInt, toBoolean, makePlainASCII_UC, processMillis } from '@tubular/util';
import * as requestIp from 'request-ip';

export const router = Router();

type RemoteMode = 'skip' | 'normal' | 'extend' | 'forced' | 'only' | 'geonames' | 'getty';

class LocationArrayMap extends MapClass<string, AtlasLocation[]> { }

interface RemoteSearchResults {
  geoNamesMatches: LocationMap;
  geoNamesMetrics: GeonamesMetrics;
  geoNamesError: string;
  gettyMatches: LocationMap;
  gettyMetrics: GettyMetrics;
  gettyError: string;
  noErrors: boolean;
  matches: number;
}

const DEFAULT_MATCH_LIMIT = 75;
const MAX_MATCH_LIMIT = 500;
const REFRESH_TIME_FOR_INIT_DATA = 86400; // seconds
const DB_UPDATE = true;

let lastInit = 0;

export async function initAtlas(re_init = false): Promise<void> {
  try {
    await initTimezones();
    await initGazetteer();
    lastInit = processMillis();
  }
  catch (err) {
    svcApiConsole.error(`Atlas ${re_init ? 're-' : ''}init error: ${err}`);

    if (!re_init)
      throw (err);
  }
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = processMillis();

  const q = req.query.q ? req.query.q.toString().trim() : 'Nashua, NH';
  const version = toInt(req.query.version, 9);
  const lang = (req.query.lang?.toString().trim().toLowerCase() || req.header('Accept-Language') || '').substring(0, 2);
  const callback = req.query.callback;
  const plainText = toBoolean(req.query.pt, false, true);
  const remoteMode = (/skip|normal|extend|forced|only|geonames|getty/i.test((req.query.remote ?? '').toString()) ?
    req.query.remote.toString().toLowerCase() : 'skip') as RemoteMode;
  const withoutDB = /only|geonames|getty/i.test(remoteMode);
  const extend = (remoteMode === 'extend' || remoteMode === 'only' || remoteMode === 'forced');
  const client = (req.query.client ? req.query.client.toString().toLowerCase() : '');
  const svc = (!client || client === 'sa' || client === 'web');
  const limit = Math.min(toInt(req.query.limit, DEFAULT_MATCH_LIMIT), MAX_MATCH_LIMIT);
  const noTrace = toBoolean(req.query.notrace, false, true) || remoteMode === 'only';
  const dbUpdate = DB_UPDATE && !noTrace;

  const parsed = parseSearchString(q, version < 3 ? 'loose' : 'strict');
  const result = new SearchResult(q, parsed.normalizedSearch);
  const connection = (withoutDB ? null : await pool.getConnection());
  let consultRemoteData = false;
  let remoteResults: RemoteSearchResults;
  let dbMatchedOnlyBySound = false;
  let dbMatches: LocationMap;
  let dbError: string;
  // let gotBetterMatchesFromRemoteData = false;

  for (let attempt = 0; attempt < 2; ++attempt) {
    if (/forced|only|geonames|getty/i.test(remoteMode) ||
      (remoteMode !== 'skip' && !(await hasSearchBeenDoneRecently(connection, parsed.normalizedSearch, extend)))) {
      consultRemoteData = true;
    }

    if (startTime / 1000 > lastInit + REFRESH_TIME_FOR_INIT_DATA)
      await initAtlas(true);

    if (withoutDB)
      dbMatches = undefined;
    else {
      try {
        dbMatches = await doDataBaseSearch(connection, parsed, extend, limit + 1, true, lang);
        dbMatchedOnlyBySound = true;

        for (const location of dbMatches.values) {
          if (!location.matchedBySound) {
            dbMatchedOnlyBySound = false;
            break;
          }
        }

        dbError = undefined;
      }
      catch (err) {
        dbError = err.toString();

        if (attempt === 0)
          continue;
      }
    }

    if (consultRemoteData) {
      const doGeonames = remoteMode !== 'getty';
      const doGetty = remoteMode !== 'geonames';

      remoteResults = await remoteSourcesSearch(parsed, doGeonames, doGetty, noTrace);

      if (remoteResults.matches > 0 && dbMatchedOnlyBySound) {
        // gotBetterMatchesFromRemoteData = true;
        dbMatches = undefined;
      }
    }

    break;
  }

  const mergedMatches = new LocationArrayMap();

  if (dbMatches)
    copyAndMergeLocations(mergedMatches, dbMatches);

  if (remoteResults) {
    if (remoteResults.geoNamesMatches)
      copyAndMergeLocations(mergedMatches, remoteResults.geoNamesMatches);

    if (remoteResults.gettyMatches)
      copyAndMergeLocations(mergedMatches, remoteResults.gettyMatches);
  }

  const uniqueMatches = eliminateDuplicatesAndSort(mergedMatches, limit + 1);

  if (uniqueMatches.length > limit) {
    uniqueMatches.length = limit;
    result.limitReached = true;
  }

  result.matches = uniqueMatches;

  if (parsed.altNormalized)
    result.normalizedSearch += '; ' + parsed.altNormalized;

  const { celestial, suggestions } = summarizeResults(result, remoteResults, dbError, extend, version, parsed, svc);

//  if (!dbError)
//    await updateDbIfRequired(uniqueMatches, remoteResults, parsed.normalizedSearch, gotBetterMatchesFromRemoteData, extend, dbUpdate && !noTrace);

  const log = createCompactLogSummary(result, remoteResults, dbMatches ? dbMatches.size : 0, dbError, startTime,
    client, version, celestial, suggestions);

  logMessage(log, noTrace);

  result.time = processMillis() - startTime;

  if (dbUpdate && connection)
    logSearchResults(connection, result.normalizedSearch, extend, result.matches.length, requestIp.getClientIp(req)).finally();

  connection?.release();

  if (plainText) {
    res.set('Content-Type', 'text/plain');
    res.send(result.toPlainText());
  }
  else if (callback)
    res.jsonp(result);
  else
    res.send(result);
}));

function copyAndMergeLocations(destination: LocationArrayMap, source: LocationMap): void {
  source.keys.forEach(key => {
    const location = source.get(key);
    let locations: AtlasLocation[];

    key = key.replace(/\(\d+\)$/, '');

    if (destination.has(key))
      locations = destination.get(key);
    else {
      locations = [];
      destination.set(key, locations);
    }

    locations.push(location);
  });
}

const MATCH_ADM  = /^A\.ADM/i;
const MATCH_PPL  = /^P\.PPL/i;
const MATCH_PPLX = /^P\.PPL\w/i;

function eliminateDuplicatesAndSort(mergedMatches: LocationArrayMap, limit: number): AtlasLocation[] {
  const keys = mergedMatches.keys.sort();

  keys.forEach(key => {
    const locations = mergedMatches.get(key);

    for (let i = 0; i < locations.length - 1; ++i) {
      const location1 = locations[i];

      if (!location1)
        continue;

      const city1       = location1.city;
      const county1     = location1.county;
      const state1      = location1.state;
      const country1    = location1.country;
      const latitude1   = location1.latitude;
      const longitude1  = location1.longitude;
      let zone1       = location1.zone;
      const zip1        = location1.zip;
      const rank1       = location1.rank;
      let placeType1  = location1.placeType;
      const source1     = location1.source;
      const geonamesID1 = location1.geonamesID;

      if (!zone1)
        zone1 = '?';

      for (let j = i + 1; j < locations.length; ++j) {
        const location2 = locations[j];

        if (!location2)
          continue;

        const county2     = location2.county;
        const state2      = location2.state;
        const latitude2   = location2.latitude;
        const longitude2  = location2.longitude;
        let zone2         = location2.zone;
        const zip2        = location2.zip;
        const rank2       = location2.rank;
        let placeType2    = location2.placeType;
        const source2     = location2.source;
        const geonamesID2 = location2.geonamesID;

        if (zone2 == null)
          zone2 = '?';

        if (MATCH_ADM.test(placeType1) && MATCH_PPL.test(placeType2))
          placeType1 = placeType2;

        if (MATCH_ADM.test(placeType2) && MATCH_PPL.test(placeType1))
          placeType2 = placeType1;

        if (MATCH_PPL.test(placeType1) && MATCH_PPLX.test(placeType2))
          placeType1 = placeType2;

        if (MATCH_PPL.test(placeType2) && MATCH_PPLX.test(placeType1))
          placeType2 = placeType1;

        const distance = roughDistanceBetweenLocationsInKm(latitude1, longitude1, latitude2, longitude2);

        // If locations are close and one location has a questionable time zone, but the other is more
        // certain, use the more certain time zone for both locations.
        if (distance < 10) {
          if (zone1.endsWith('?') && !zone2.endsWith('?'))
            location1.zone = zone2;
          else if (zone2.endsWith('?') && !zone1.endsWith('?'))
            location2.zone = zone1;
        }

        // Newer GeoNames data for the same location should replace older.
        if (geonamesID1 && geonamesID1 === geonamesID2) {
          if (source1 > source2) {
            locations[j] = undefined;
            location1.rank = Math.max(rank1, rank2);
            location1.zip = (zip1 || zip2);
            location1.source = source2;
            location1.useAsUpdate = !location1.isCloseMatch(location2);
          }
          else {
            locations[i] = undefined;
            location2.rank = Math.max(rank1, rank2);
            location1.zip = (zip2 || zip1);
            location2.source = source1;
            location2.useAsUpdate = (source2 > source1 && !location2.isCloseMatch(location1));
            // After eliminating location1 (index i), end j loop since there's nothing left from the outer loop for inner
            // loop locations to be compared to.
            break;
          }
        }
        else if (distance < 10 && placeType2 === 'T.PK' && placeType1 === 'T.MT') {
          locations[i] = undefined;
          break;
        }
        // Favor peak (T.PK) place types over mountain (T.MT) place types.
        else if (distance < 10 && placeType1 === 'T.PK' && placeType2 === 'T.MT') {
          locations[j] = undefined;
        }
        else if (placeType1 !== placeType2) {
          // Do nothing - differing place types of non-city items will be noted.
        }
        else if (state1 !== state2) {
          if (distance < 10 && state1 && state2)
            svcApiConsole.warn(`Possible detail conflict for same location: ${city1}, ${state1}/${state2}, ${country1}`);

          if (rank2 > rank1) {
            locations[i] = undefined;
            break;
          }
          else if (rank1 > rank2 || !state2) {
            locations[j] = undefined;
          }
          else if (!state1) {
            locations[i] = undefined;
            break;
          }
          else {
            location1.showState = true;
            location2.showState = true;
          }
        }
        else if (county1 !== county2) {
          if (distance < 10 && county1 && county2)
            svcApiConsole.warn(`Possible detail conflict for same location: ${city1}, ${county1}/${county2}, ${state1}, ${country1}`);

          if (rank2 > rank1) {
            locations[i] = undefined;
            break;
          }
          else if (rank1 > rank2 || !county2)
            locations[j] = undefined;
          else if (!county1) {
            locations[i] = undefined;
            break;
          }
          else {
            location1.showCounty = true;
            location2.showCounty = true;
          }
        }
        else if (rank2 > rank1) {
          if (source1.startsWith('GEO') && !source2.startsWith('GEO')) {
            // Favor SVC's database entry, but keep higher rank.
            locations[j] = undefined;
            location1.rank = rank2;
          }
          else {
            locations[i] = undefined;
            break;
          }
        }
        else if ((zip1 && !zip2) || rank1 > rank2) {
          if (source2.startsWith('GEO') && !source1.startsWith('GEO')) {
            // Favor SVC's database entry, but keep higher rank.
            locations[i] = undefined;
            location2.rank = Math.max(rank1, rank2);
            location2.zip = (zip1 || zip2);
            break;
          }
          else
            locations[j] = undefined;
        }
        else if (source1.startsWith('GEO') && !source2.startsWith('GEO'))
          locations[j] = undefined;
        else {
          locations[i] = undefined;
          break;
        }
      }
    }
  });

  const uniqueMatches: AtlasLocation[] = [];

  keys.forEach(key => {
    const locations = mergedMatches.get(key);

    locations.forEach(location => {
      if (location && uniqueMatches.length < limit)
        uniqueMatches.push(location);
    });
  });

  return uniqueMatches.sort((a, b) => a.compareTo(b));
}

async function remoteSourcesSearch(parsed: ParsedSearchString, doGeonames: boolean, doGetty: boolean, noTrace: boolean): Promise<RemoteSearchResults> {
  const results = {} as RemoteSearchResults;
  const promises: Promise<LocationMap>[] = [];
  let geoNamesIndex = -1;
  let gettyIndex = -1;
  let nextIndex = 0;
  let noErrors = true;
  let matches = 0;

  if (doGeonames) {
    results.geoNamesMetrics = {} as GeonamesMetrics;
    geoNamesIndex = nextIndex++;
    promises.push(geonamesSearch(parsed.targetCity, parsed.targetState, parsed.postalCode, results.geoNamesMetrics, noTrace));
  }

  if (doGetty && !parsed.postalCode) {
    results.gettyMetrics = {} as GettyMetrics;
    gettyIndex = nextIndex; /* ++ */ // TODO: Put back trailing ++ if another remote source is added.
    promises.push(gettySearch(parsed.targetCity, parsed.targetState, results.gettyMetrics, noTrace));
  }

  const locationsOrErrors = await Promise.all(promises.map(promise => promise.catch(err => err)));

  if (geoNamesIndex >= 0) {
    if (locationsOrErrors[geoNamesIndex] instanceof Error) {
      results.geoNamesError = (locationsOrErrors[geoNamesIndex] as Error).message;
      noErrors = false;
    }
    else {
      results.geoNamesMatches = locationsOrErrors[geoNamesIndex];
      matches += results.geoNamesMatches.size;
    }
  }

  if (gettyIndex >= 0) {
    if (locationsOrErrors[gettyIndex] instanceof Error) {
      results.gettyError = (locationsOrErrors[gettyIndex] as Error).message;
      noErrors = false;
    }
    else {
      results.gettyMatches = locationsOrErrors[gettyIndex];
      matches += results.gettyMatches.size;
    }
  }

  results.noErrors = noErrors;
  results.matches = matches;

  return results;
}

function summarizeResults(result: SearchResult, remoteResults: RemoteSearchResults, dbError: string,
                          extend: boolean, version: number, parsed: ParsedSearchString,
                          svc: boolean): { celestial: boolean, suggestions: string } {
  if (remoteResults) {
    if (remoteResults.geoNamesMetrics && !remoteResults.geoNamesError) {
      const metrics = remoteResults.geoNamesMetrics;
      const retrievalTime = formatVariablePrecision(metrics.retrievalTime / 1000);

      result.appendInfoLine(`GeoName raw matches: ${metrics.rawCount}, filtered matches: ${metrics.matchedCount}, \
retrieval time: ${retrievalTime}s.`);
    }

    if (remoteResults.gettyMetrics && !remoteResults.gettyError) {
      const metrics = remoteResults.gettyMetrics;
      const totalTime = formatVariablePrecision(metrics.totalTime / 1000);
      const preliminaryTime = formatVariablePrecision(metrics.preliminaryTime / 1000);
      const retrievalTime = formatVariablePrecision(metrics.retrievalTime / 1000);

      if (metrics.failedSyntax)
        result.appendInfoLine('Getty failed search syntax: ' + metrics.failedSyntax);

      result.appendInfoLine(`Getty remote data: ${metrics.retrievedCount}\
${metrics.retrievedCount === metrics.matchedCount ? '' : ' of ' + metrics.matchedCount} \
item${metrics.matchedCount === 1 ? '' : 's'} retrieved, total time: ${totalTime}s, preliminary time: \
${preliminaryTime}s, retrieval time: ${retrievalTime}s.`);
    }
  }

  // Returning one error will suffice.
  if (dbError)
    result.error = dbError;
  else
    result.error = remoteResults && (remoteResults.geoNamesError || remoteResults.gettyError);

  if (remoteResults) {
    if (remoteResults.geoNamesError && (!extend || remoteResults.gettyError))
      result.appendWarningLine('Supplementary data temporarily unavailable.');
    else if (remoteResults.geoNamesError || remoteResults.gettyError)
      result.appendWarningLine('Some supplementary data temporarily unavailable.');
  }

  let celestial = false;

  if (version > 2)
    celestial = checkCelestial(parsed.targetCity, result, svc);

  return { celestial, suggestions: '' };
}

function createCompactLogSummary(result: SearchResult, remoteResults: RemoteSearchResults, dbMatchCount: number,
                                 dbError: string, startTime: number, client: string, version: number,
                                 celestial: boolean, suggestions: string): string {
  const log = [result.originalSearch + ': ' + result.count];

  if (result.limitReached)
    log.push('+');

  if (remoteResults) {
    log.push('(');
    log.push(dbMatchCount.toString());
    log.push(';');

    if (remoteResults.geoNamesMatches)
      log.push(remoteResults.geoNamesMatches.size.toString());
    else
      log.push('-');

    log.push(';');

    if (remoteResults.gettyMatches)
      log.push(remoteResults.gettyMatches.size.toString());
    else
      log.push('-');

    log.push(')');
  }
  else
    log.push('(db)');

  if (dbError || (remoteResults && !remoteResults.noErrors)) {
    log.push('[');

    if (!remoteResults)
      log.push(dbError);
    else {
      if (dbError)
        log.push(dbError);
      else
        log.push('-');

      log.push(';');

      if (remoteResults.geoNamesError)
        log.push(remoteResults.geoNamesError);
      else
        log.push('-');

      log.push(';');

      if (remoteResults.gettyError)
        log.push(remoteResults.gettyError);
      else
        log.push('-');
    }

    log.push(']');
  }

  log.push('[');
  log.push(formatVariablePrecision((processMillis() - startTime) / 1000) + 's');

  if (client === 'sa')
    log.push(';sa');

  if (version >= 3) {
    log.push(';v');
    log.push(version.toString());
  }

  if (celestial)
    log.push(';cele');

  if (suggestions)
    log.push(';sug:' + suggestions);

  log.push(']');

  return log.join('');
}

function checkCelestial(targetCity: string, result: SearchResult, svc: boolean): boolean {
  if (targetCity && celestialNames.has(makePlainASCII_UC(targetCity))) {
    result.appendWarningLine('This search is for geographic locations only.');

    if (svc) {
      result.appendWarningLine('Use Sky → Show Names → One Specific Object... to find celestial objects.');
      result.appendWarningLine('Check the Help page for more details.');
      result.appendWarningLine('');
    }

    return true;
  }

  return false;
}

notFoundForEverythingElse(router);

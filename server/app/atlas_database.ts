import { doubleMetaphone } from './double-metaphone';
import { Pool, PoolConnection } from './mysql-await-async';
import {
  closeMatchForState, code3ToName, countyStateCleanUp, getFlagCode, LocationMap, makeLocationKey,
  ParsedSearchString, simplify, closeMatchForCity
} from './gazetteer';
import { AtlasLocation } from './atlas-location';
import { MIN_EXTERNAL_SOURCE } from './common';
import { svcApiConsole } from './svc-api-logger';
import { toBoolean } from '@tubular/util';

export const pool = new Pool({
  host: (toBoolean(process.env.DB_REMOTE) ? 'skyviewcafe.com' : '127.0.0.1'),
  user: 'skyview',
  password: process.env.DB_PWD,
  database: 'skyviewcafe'
});

enum MatchType { EXACT_MATCH, EXACT_MATCH_ALT, STARTS_WITH, SOUNDS_LIKE }

const NO_RESULTS_YET = -1;
const MAX_MONTHS_BEFORE_REDOING_EXTENDED_SEARCH = 12;
const ZIP_RANK = 9;

pool.on('connection', connection => {
  // noinspection JSIgnoredPromiseFromCall
  connection.query("SET NAMES 'utf8'");
});

export function logMessage(message: string, noTrace = false): void {
  svcApiConsole.info(message);

  if (!noTrace)
    logMessageAux(message, false);
}

export function logWarning(message: string, noTrace = false): void {
  svcApiConsole.warn(message);

  if (!noTrace)
    logMessageAux(message, true);
}

function logMessageAux(message: string, asWarning: boolean): void {
  setTimeout(async () => {
    try {
      await pool.queryResults('INSERT INTO atlas_log (warning, message) VALUES (?, ?)', [asWarning, message]);
    }
    catch (err) {
      console.error('Writing to atlas_log failed.');
    }
  });
}

export async function hasSearchBeenDoneRecently(connection: PoolConnection, searchStr: string, extended: boolean): Promise<boolean> {
  return await logSearchResults(connection, searchStr, extended, NO_RESULTS_YET, false);
}

export async function logSearchResults(connection: PoolConnection, searchStr: string, extended: boolean, matchCount: number, dbUpdate = true): Promise<boolean> {
  let dbHits = 0;
  let ageMonths = -1;
  let found = false;
  let wasExtended = false;
  let matches = 0;

  const results = await connection.queryResults('SELECT extended, hits, matches, TIMESTAMPDIFF(MONTH, time_stamp, NOW()) as months FROM atlas_searches2 WHERE search_string = ?',
    [searchStr]);

  if (results && results.length > 0) {
    wasExtended = results[0].extended;
    dbHits = results[0].hits;
    matches = results[0].matches;
    ageMonths = results[0].months;

    if (ageMonths < MAX_MONTHS_BEFORE_REDOING_EXTENDED_SEARCH && (wasExtended || !extended))
      found = true;
  }

  if (matchCount >= 0 && dbUpdate) {
    if (wasExtended)
      extended = true;

    if (matchCount < matches)
      matchCount = matches;

    let query: string;
    let values: any[];

    if (!found && ageMonths < 0) {
      query = 'INSERT INTO atlas_searches2 (search_string, extended, hits, matches) VALUES (?, ?, 1, ?)';
      values = [searchStr, extended, matchCount];
    }
    else {
      query = 'UPDATE atlas_searches2 SET hits = ?, extended = ? WHERE search_string = ?';
      values = [++dbHits, extended && dbUpdate, searchStr];
    }

    await pool.queryResults(query, values);
  }

  return found;
}

export async function doDataBaseSearch(connection: PoolConnection, parsed: ParsedSearchString, extendedSearch: boolean,
                                       maxMatches: number, canMatchBySound = true, lang?: string): Promise<LocationMap> {
  const simplifiedCity = simplify(parsed.targetCity);
  const examined = new Set<number>();
  const matches = new LocationMap();

  for (let pass = 0; pass < 2; ++pass) {
    const condition = (pass === 0 ? ' AND rank > 0' : '');

    examined.clear();

    for (let matchType: number = MatchType.EXACT_MATCH; matchType <= MatchType.SOUNDS_LIKE; ++matchType) {
      let rankAdjust = 0;
      let query: string;
      let values: any[];
      let fromAlt = false;

      switch (matchType) {
        case MatchType.EXACT_MATCH:
          if (parsed.postalCode) {
            query = 'SELECT gazetteer_id FROM gazetteer_postal WHERE code = ?';
            values = [parsed.postalCode];
            fromAlt = true;
          }
          else {
            rankAdjust = 1;
            values = [simplifiedCity];

            if (lang && lang !== 'en') {
              values.push(lang);
              query = 'SELECT gazetteer_id FROM gazetteer_alt_names WHERE key_name = ? AND lang = ? AND colloquial = 0 AND historic = 0';
              fromAlt = true;
            }
            else
              query = 'SELECT * FROM gazetteer WHERE key_name = ?' + condition;
          }
          break;

        case MatchType.EXACT_MATCH_ALT:
          fromAlt = true;
          query = `SELECT gazetteer_id FROM gazetteer_alt_names WHERE key_name = ? AND (lang = '' OR lang = 'en' OR lang = ?)`;
          values = [simplifiedCity, lang];
          break;

        case MatchType.STARTS_WITH:
          values = [simplifiedCity, simplifiedCity + '~'];

          if (lang && lang !== 'en') {
            values.push(lang);
            query = 'SELECT * FROM gazetteer_alt_names WHERE key_name >= ? AND key_name < ? AND lang = ?';
            fromAlt = true;
          }
          else
            query = 'SELECT * FROM gazetteer WHERE key_name >= ? AND key_name < ? ' + condition;

          break;

        case MatchType.SOUNDS_LIKE:
          if (/\d/.test(parsed.targetCity) || !canMatchBySound)
            continue;

          rankAdjust = -1;
          query = 'SELECT * FROM gazetteer WHERE mphone1 = ? OR mphone2 = ?' + condition;
          values = doubleMetaphone(parsed.targetCity);
          break;
      }

      let results = (await connection.queryResults(query, values)) || [];

      if (fromAlt && results.length > 0) {
        values = [results.map((row: any) => row.gazetteer_id).join(', ')];
        query = `SELECT * FROM gazetteer WHERE id IN (${values[0]})` + condition;
        results = (await connection.queryResults(query)) || [];
      }

      for (const result of results) {
        const id = result.id;

        if (examined.has(id))
          continue;

        examined.add(id);

        const city = result.name;
        const county = result.admin2;
        const state = result.admin1;
        const country = result.country;
        const longCountry = code3ToName[country];
        const latitude: number = result.latitude;
        const longitude: number = result.longitude;
        const elevation: number = result.elevation;
        const zone = result.timezone;
        let zip = '';
        let rank: number = result.rank;
        const placeType = result.feature_code;
        const source = result.source;
        const geonamesID: number = result.geonames_id;

        if (!parsed.postalCode && ((source >= MIN_EXTERNAL_SOURCE && !extendedSearch && pass === 0) ||
            !closeMatchForState(parsed.targetState, state, country)))
          continue;

        if (parsed.postalCode) {
          rank = ZIP_RANK;
          zip = parsed.postalCode;

          if (results.length > 1) {
            rank += parsed.targetCity && closeMatchForCity(parsed.targetCity, city) ? 2 : 0;
            rank += parsed.targetCity && closeMatchForState(parsed.targetCity, state, country) ? 1 : 0;
            rank += parsed.targetState && closeMatchForState(parsed.targetState, state, country) ? 1 : 0;
            rank += parsed.targetState && closeMatchForCity(parsed.targetState, city) ? 1 : 0;
          }
        }
        else {
          rank += rankAdjust;

          if (rank >= ZIP_RANK)
            rank = ZIP_RANK - 1;
          else if (rank < 0)
            rank = 0;
        }

        const location = new AtlasLocation();

        location.city = city;
        location.county = countyStateCleanUp(county);
        location.state = countyStateCleanUp(state);
        location.country = country;
        location.longCountry = longCountry;
        location.flagCode = getFlagCode(country, state);
        location.latitude = latitude;
        location.longitude = longitude;
        location.elevation = elevation;
        location.zone = zone;
        location.zip = zip;
        location.rank = rank;
        location.placeType = placeType;
        location.source = source;
        location.geonamesID = geonamesID;

        if (matchType === MatchType.EXACT_MATCH_ALT)
          location.matchedByAlternateName = true;
        else if (matchType === MatchType.SOUNDS_LIKE)
          location.matchedBySound = true;

        const key = makeLocationKey(city, state, country, matches);

        matches.set(key, location);

        if (matches.size > maxMatches * 4)
          break;
      }

      // Skip SOUNDS_LIKE search step on first pass, or if better matches have already been found. Only one step needed for postal codes.
      if (((pass === 0 || matches.size > 0) && matchType >= MatchType.STARTS_WITH) || parsed.postalCode)
        break;
    }

    if (parsed.postalCode)
      break;
  }

  return matches;
}
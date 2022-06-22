import { abs } from '@tubular/math';
import { doubleMetaphone } from './double-metaphone';
import { Pool, PoolConnection } from './mysql-await-async';
import {
  closeMatchForState, code3ToName, countyStateCleanUp, getFlagCode, LocationMap, makeLocationKey,
  ParsedSearchString, simplify, closeMatchForCity, code3ToNameByLang, admin1ToNameByLang, admin1s, code2ToCode3, admin2s
} from './gazetteer';
import { AtlasLocation } from './atlas-location';
import { MIN_EXTERNAL_SOURCE } from './common';
import { svcApiConsole } from './svc-api-logger';
import { isAllUppercaseWords, toBoolean, toMixedCase } from '@tubular/util';

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
const ZIP_SUPPLEMENT_RANK = 1;

export function logMessage(message: string, lang?: string, ip?: string, noTrace = false): void {
  svcApiConsole.info(message);

  if (!noTrace)
    logMessageAux(message, lang, ip, false);
}

export function logWarning(message: string, noTrace = false): void {
  svcApiConsole.warn(message);

  if (!noTrace)
    logMessageAux(message, null, null, true);
}

function logMessageAux(message: string, lang: string, ip: string, asWarning: boolean): void {
  setTimeout(async () => {
    try {
      await pool.queryResults('INSERT INTO gazetteer_log (warning, message, lang, ip) VALUES (?, ?, ?, ?)',
        [asWarning, message, lang || '', ip || '']);
    }
    catch (err) {
      console.error('Writing to gazetteer_log failed.');
    }
  });
}

export async function hasSearchBeenDoneRecently(connection: PoolConnection, searchStr: string, extended: boolean): Promise<boolean> {
  return await logSearchResults(connection, searchStr, extended, NO_RESULTS_YET, null, null, false);
}

const timersByIp = new Map<string, NodeJS.Timeout>();

export function logSearchResults(connection: PoolConnection, searchStr: string, extended: boolean, matchCount: number,
                                       ip?: string, lang?: string, dbUpdate = true): Promise<boolean> {
  const logIt = (): Promise<boolean> => logSearchResultsImpl(connection, searchStr, extended, matchCount, ip, lang, dbUpdate);

  if (ip) {
    let timer = timersByIp.get(ip);

    if (timer)
      clearTimeout(timer);

    timer = setTimeout(() => { timersByIp.delete(ip); logIt().finally(); }, 3000);
    timer.unref();
    timersByIp.set(ip, timer);

    return Promise.resolve(true);
  }
  else
    return logIt();
}

async function logSearchResultsImpl(connection: PoolConnection, searchStr: string, extended: boolean, matchCount: number,
                                       ip?: string, lang?: string, dbUpdate = true): Promise<boolean> {
  let dbHits = 0;
  let ageMonths = -1;
  let found = false;
  let wasExtended = false;
  let matches = 0;

  const results = await connection.queryResults('SELECT extended, hits, matches, TIMESTAMPDIFF(MONTH, time_stamp, NOW()) as months FROM gazetteer_searches WHERE search_string = ?',
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
      query = 'INSERT INTO gazetteer_searches (search_string, extended, hits, ip, lang, matches) VALUES (?, ?, 1, ?, ?, ?)';
      values = [searchStr, extended, ip || '', lang || '', matchCount];
    }
    else {
      query = 'UPDATE gazetteer_searches SET hits = ?, extended = ?, ip = ?, lang = ? WHERE search_string = ?';
      values = [++dbHits, extended && dbUpdate, ip || '', lang || '', searchStr];
    }

    await pool.queryResults(query, values);
  }

  return found;
}

function ntn(s: string): string { // No trailing number
  return s?.replace(/\b\d+$/, '').trim();
}

export async function doDataBaseSearch(connection: PoolConnection, parsed: ParsedSearchString, extendedSearch: boolean,
                                       maxMatches: number, canMatchBySound = true, lang?: string): Promise<LocationMap> {
  const examined = new Set<number>();
  const matches = new LocationMap();
  const postal = !!parsed.postalCode;
  let altParseMatches = 0;
  let passRankAdj = 0;

  for (let pass = 0; pass < 2; ++pass) {
    const altParse = (pass > 0 && !!parsed.altCity);
    const city = (altParse ? parsed.altCity : parsed.targetCity);
    const targetState = (altParse ? parsed.altState : parsed.targetState);
    const simplifiedCity = simplify(city);
    const condition = (pass === 0 ? ' AND rank > 0' : '');
    let soundMatches = 0;

    examined.clear();

    for (let matchType: number = MatchType.EXACT_MATCH; matchType <= MatchType.SOUNDS_LIKE; ++matchType) {
      if (lang && lang !== 'en' && matchType === MatchType.SOUNDS_LIKE)
        continue;

      let rankAdjust = -passRankAdj;
      let query: string;
      let values: any[];
      let fromAlt = false;

      passRankAdj = 0;

      switch (matchType) {
        case MatchType.EXACT_MATCH:
          if (postal) {
            query = 'SELECT * FROM gazetteer_postal WHERE code = ?';
            values = [parsed.postalCode];
            fromAlt = true;
          }
          else {
            rankAdjust = 1;
            values = [simplifiedCity];

            if (lang && lang !== 'en' && pass === 0) {
              fromAlt = true;
              values.push(lang);
              query = `SELECT * FROM gazetteer_alt_names WHERE key_name = ? AND lang = ? AND type = 'P' AND colloquial = 0 AND historic = 0`;
            }
            else
              query = 'SELECT * FROM gazetteer WHERE key_name = ?' + condition;
          }
          break;

        case MatchType.EXACT_MATCH_ALT:
          fromAlt = true;
          query = `SELECT * FROM gazetteer_alt_names WHERE key_name = ? AND type = 'P' AND (lang = '' OR lang = 'en' OR lang = ?)`;
          values = [simplifiedCity, lang];
          break;

        case MatchType.STARTS_WITH:
          values = [simplifiedCity, simplifiedCity + '~'];

          if (lang && lang !== 'en' && pass === 0) {
            values.push(lang);
            query = `SELECT * FROM gazetteer_alt_names WHERE key_name >= ? AND type = 'P' AND key_name < ? AND lang = ?`;
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
      let postalResults = (postal ? results : undefined);
      let idMap: Map<number, any>;

      if (fromAlt && results.length > 0) {
        idMap = new Map<number, any>();

        for (const row of results)
          idMap.set(row.gazetteer_id, row);

        values = [results.map((row: any) => row.gazetteer_id).filter((id: number) => id !== 0).join(', ')];

        if (values[0]) {
          query = `SELECT * FROM gazetteer WHERE id IN (${values[0]})` + condition;
          results = (await connection.queryResults(query)) || [];
        }
        else
          results = [];
      }

      if (!postalResults && results.find((row: any) => row.source === 'GEOZ')) {
        postalResults = results.filter((row: any) => row.source === 'GEOZ');
        results = results.filter((row: any) => row.source !== 'GEOZ');
        results.forEach((row: any) => row.id = -row.id);
      }

      if (postalResults) {
        const addOns: any[] = [];

        for (const row of postalResults) {
          const name = row.name;
          const gRow = row.gazetteer_id && idMap?.get(row.gazetteer_id);

          if (gRow) {
            gRow.source = row.source;

            if (row.accuracy > 4) {
              gRow.latitude = row.latitude;
              gRow.longitude = row.longitude;
            }
          }
          else {
            if (/[/()]/.test(name) || isAllUppercaseWords(name))
              row.name = toMixedCase(name.replace(/[/()].*$/, '').trim());

            const addOn = {
              admin1: row.admin1?.length > 1 ? row.admin1 : '',
              admin2: '',
              country: code2ToCode3[row.country] || row.country,
              feature_code: 'P.PPL',
              geonames_id: -row.id,
              id: -row.id,
              latitude: row.latitude,
              longitude: row.longitude,
              name: row.name,
              rank: ZIP_SUPPLEMENT_RANK,
              source: row.source,
              timezone: row.timezone
            };

            const match = addOns.find(ao => ao.country === addOn.country && ao.admin1 === addOn.admin1 &&
              ao.timezone === addOn.timezone && abs(ao.latitude - addOn.latitude) < 0.1 &&
              abs(ao.longitude - addOn.longitude) < 0.1 && ntn(ao.name) === ntn(addOn.name));

            if (match)
              match.name = ntn(match.name);
            else
              addOns.push(addOn);
          }
        }

        results.push(...addOns);
      }

      for (const row of results) {
        const id = row.id;

        if (examined.has(id))
          continue;

        examined.add(id);

        const city = idMap ? idMap.get(id)?.name || row.name : row.name;
        const countyKey = `${row.country}.${row.admin1}.${row.admin2}`;
        const county = admin2s[countyKey] || row.admin2;
        const state = row.admin1;
        const country = row.country;
        const longCountry = (code3ToNameByLang[country] || {})[lang || 'en'] || code3ToName[country];
        const latitude: number = row.latitude;
        const longitude: number = row.longitude;
        const elevation: number = row.elevation;
        const zone = row.timezone;
        let zip = row.postalCode || '';
        let rank: number = row.rank;
        const placeType = row.feature_code;
        const source = row.source;
        const geonamesID: number = row.geonames_id;

        if (!postal && ((source >= MIN_EXTERNAL_SOURCE && !extendedSearch && pass === 0) ||
            !closeMatchForState(targetState, state, country, lang)))
          continue;

        if (postal) {
          rank = ZIP_RANK;
          zip = parsed.postalCode;

          if (results.length > 1) {
            rank += parsed.targetCity && closeMatchForCity(parsed.targetCity, city) ? 2 : 0;
            rank += parsed.targetCity && closeMatchForState(parsed.targetCity, state, country) ? 1 : 0;
            rank += targetState && closeMatchForState(targetState, state, country) ? 1 : 0;
            rank += targetState && closeMatchForCity(targetState, city) ? 1 : 0;
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

        if (/^\d+$/.test(location.state) || (country !== 'USA' && country !== 'CAN' && /^[A-Z]{3,}$/.test(location.state))) {
          const key = country + '.' + location.state;

          location.state = (admin1ToNameByLang[key] || {})[lang || 'en'] || (admin1ToNameByLang[key] || {})[''] ||
            admin1s[key] || location.state;
        }

        if (matchType === MatchType.EXACT_MATCH_ALT)
          location.matchedByAlternateName = true;
        else if (matchType === MatchType.SOUNDS_LIKE) {
          ++soundMatches;
          location.matchedBySound = true;
        }

        const key = makeLocationKey(city, state, country, matches);

        matches.set(key, location);
        altParseMatches += (altParse ? 1 : 0);

        if (matches.size > maxMatches * 4)
          break;
      }

      // Skip SOUNDS_LIKE search step on first pass, or if better matches have already been found. Only one step needed for postal codes.
      if (((pass === 0 || matches.size > 0) && matchType >= MatchType.STARTS_WITH) || postal)
        break;
    }

    let postalOnce = postal;

    if (postal && parsed.postalCode.includes(' ')) {
      parsed.postalCode = parsed.postalCode.replace(/\s+\S.*$/, '');
      postalOnce = false;
    }

    if (postalOnce)
      break;
    else if (lang && lang !== 'en') {
      --pass;
      lang = '';
      passRankAdj = (matches.size > 0 ? 2 : 0);
    }
    else if (pass === 0 && (matches.size === 0 || matches.size === soundMatches) &&
             parsed.targetState && simplifiedCity === simplify(parsed.targetState)) {
      --pass;
      parsed.targetState = '';
    }
  }

  if (altParseMatches === 0) {
    delete parsed.altCity;
    delete parsed.altNormalized;
    delete parsed.altState;
  }

  return matches;
}

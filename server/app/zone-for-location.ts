import { Request, Response, Router } from 'express';
import { processMillis, toBoolean, toNumber } from '@tubular/util';
import { asyncHandler } from './common';
import { requestJson } from 'by-request';
import { pool } from './atlas-database';
import { code2ToCode3 } from './gazetteer';
import { PoolConnection } from './mysql-await-async';
import { Timezone } from '@tubular/time';
import { find } from 'geo-tz';

export const router = Router();

export interface TzInfo {
  country?: string;
  dstOffset?: number;
  errorMessage?: string;
  fromDb?: boolean;
  rawOffset?: number;
  status?: string;
  timeZoneId?: string;
  timeZoneName?: string;
}

export async function getTimezoneForLocation(lat: number, lon: number, time = 0): Promise<TzInfo> {
  if (time === 0)
    time = Math.floor(processMillis() / 1000);

  const zoneByGeoTz = find(lat, lon)[0];
  let connection: PoolConnection;
  let data: TzInfo;

  try {
    connection = await pool.getConnection();

    zoneLoop:
    for (const span of [0.05, 0.1, 0.25, 0.5]) {
      const query = 'SELECT timezone, country FROM gazetteer WHERE latitude >= ? AND latitude <= ? AND longitude >= ? AND longitude <= ?';
      const results = (await connection.queryResults(query, [lat - span, lat + span, lon - span, lon + span])) || [];
      let timeZoneId = zoneByGeoTz;
      let country: string;

      for (const result of results) {
        if (!zoneByGeoTz && result.timezone) {
          if (!timeZoneId)
            timeZoneId = result.timezone;
          else if (timeZoneId !== result.timezone)
            break zoneLoop;
        }

        if (!country)
          country = result.country;
        else if (country !== result.country)
          break zoneLoop;
      }

      if (timeZoneId) {
        const zone = Timezone.getTimezone(timeZoneId);

        data = {
          timeZoneId,
          country,
          dstOffset: zone.dstOffset,
          rawOffset: zone.utcOffset,
          status: 'OK',
          fromDb: true
        };

        break;
      }
    }
  }
  catch {}

  connection?.release();

  const key = encodeURIComponent(process.env.GOOGLE_API_KEY);

  if (!data) {
    const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lon}&timestamp=${time}&key=${key}`;

    try {
      data = await requestJson(url);
    }
    catch (err) {
      data = { status: 'ERROR', errorMessage: err.toString() };
    }
  }

  if (data && !data.country) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?key=${key}&result_type=locality|administrative_area_level_3&latlng=${lat},${lon}`;

    try {
      const addr = ((await requestJson(url))?.results || [])[0]?.address_components;

      if (addr) {
        const country = addr?.find((comp: any) => comp.types?.includes('country'))?.short_name;

        if (country)
          data.country = code2ToCode3[country] || country;
      }
    }
    catch (err) {
      data = { status: 'ERROR', errorMessage: err.toString() };
    }
  }

  return data;
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const lat = toNumber(req.query.lat);
  const lon = toNumber(req.query.lon);
  const time = toNumber(req.query.timestamp);
  const plainText = toBoolean(req.query.pt, false, true);
  const data = await getTimezoneForLocation(lat, lon, time);

  if (plainText) {
    res.set('Content-Type', 'text/plain');
    res.send(JSON.stringify(data));
  }
  else if (req.query.callback)
    res.jsonp(data);
  else
    res.send(data);
}));

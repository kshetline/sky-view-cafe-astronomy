import { Request, Response, Router } from 'express';
import { processMillis, toBoolean, toNumber } from '@tubular/util';
import { asyncHandler } from './common';
import { requestJson } from 'by-request';
import { pool } from './atlas-database';
import { code2ToCode3 } from './gazetteer';
import { PoolConnection } from './mysql-await-async';
import { Timezone } from '@tubular/time';
import { find } from 'geo-tz';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

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

// Remove if and when geo-tz is updated with a reduced area for America/Nipigon.
const nipigon = {
  type: 'Feature',
  properties: {
    tzid: 'America/Nipigon'
  },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-88.23448491923624, 48.952994735358004],
        [-88.23487091064453, 48.953041076660156],
        [-88.24162292480469, 48.9555549621582],
        [-88.24617004394531, 48.9595947265625],
        [-88.25310516357422, 48.97331619262696],
        [-88.25745391845703, 48.992679595947266],
        [-88.25802612304688, 48.995201110839844],
        [-88.25543212890625, 49.00632095336914],
        [-88.25821685791016, 49.01075744628906],
        [-88.26227569580078, 49.0076904296875],
        [-88.26441955566406, 48.9979248046875],
        [-88.26039123535156, 48.98247528076172],
        [-88.26238250732422, 48.97911071777344],
        [-88.2685546875, 48.97565841674805],
        [-88.2708740234375, 48.972530364990234],
        [-88.2618408203125, 48.9589729309082],
        [-88.2609177591477, 48.95022140807116],
        [-88.26239687003915, 48.95244384292245],
        [-88.43281365961772, 48.95277603939336],
        [-88.43299780563895, 49.03916948894521],
        [-88.23623908787941, 49.039253898519554],
        [-88.23448491923624, 48.952994735358004]
      ]
    ]
  }
};

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
        if (timeZoneId === 'America/Nipigon' || timeZoneId === 'America/Toronto')
          timeZoneId = booleanPointInPolygon([lon, lat], nipigon as any) ? 'America/Nipigon' : 'America/Toronto';

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
    res.json(data);
}));

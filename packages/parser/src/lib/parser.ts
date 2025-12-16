import { differenceInDays, format, parse, parseISO } from 'date-fns';

export interface TravelRecord {
  date: string; // ISO date string (YYYY-MM-DD)
  direction: 'Inbound' | 'Outbound';
  route: string;
  port?: string;
}

export interface Trip {
  id: number;
  outDate: string | null; // ISO date string (YYYY-MM-DD)
  inDate: string | null; // ISO date string (YYYY-MM-DD)
  outRoute: string;
  inRoute: string;
  calendarDays: number | null;
  fullDays: number | null;
}

export interface ParseResult {
  records: TravelRecord[];
  trips: Trip[];
  summary: {
    totalTrips: number;
    completeTrips: number;
    incompleteTrips: number;
    totalFullDays: number;
  };
}

const portNames: Record<string, string> = {
  LHR: 'London Heathrow',
  LGW: 'London Gatwick',
  STN: 'London Stansted',
  LTN: 'London Luton',
  LCY: 'London City',
  MAN: 'Manchester',
  BHX: 'Birmingham',
  EDI: 'Edinburgh',
  GLA: 'Glasgow',
  AMS: 'Amsterdam',
  CDG: 'Paris CDG',
  FRA: 'Frankfurt',
  MAD: 'Madrid',
  BCN: 'Barcelona',
  FCO: 'Rome Fiumicino',
  CIA: 'Rome Ciampino',
  MXP: 'Milan Malpensa',
  VCE: 'Venice',
  PSA: 'Pisa',
  VNO: 'Vilnius',
  WAW: 'Warsaw',
  WMI: 'Warsaw Modlin',
  PRG: 'Prague',
  VIE: 'Vienna',
  MSQ: 'Minsk',
  HKG: 'Hong Kong',
  FNC: 'Madeira',
  PVK: 'Preveza',
  BGO: 'Bergen',
  NCE: 'Nice',
  EIN: 'Eindhoven',
  HEL: 'Helsinki',
  GBHRW: 'Harwich',
  NLHVH: 'Hook of Holland',
  GBSPX: 'St Pancras/Eurostar',
};

/**
 * Parse date string to ISO format (YYYY-MM-DD)
 * @param dateStr - Date string in various formats
 * @returns ISO date string (YYYY-MM-DD) or null if invalid
 */
export function parseDate(dateStr: string): string | null {
  const patterns = [
    { regex: /(\d{2})\/(\d{2})\/(\d{4})/, format: 'dd/MM/yyyy' }, // DD/MM/YYYY
    { regex: /(\d{4})-(\d{2})-(\d{2})/, format: 'yyyy-MM-dd' }, // YYYY-MM-DD
    { regex: /(\d{2})-(\d{2})-(\d{4})/, format: 'dd-MM-yyyy' }, // DD-MM-YYYY
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern.regex);
    if (match) {
      try {
        const parsed = parse(dateStr, pattern.format, new Date());
        // Validate the parsed date is valid
        if (!isNaN(parsed.getTime())) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function formatRoute(
  embarkPort: string,
  disembarkPort: string,
  direction: string,
): string {
  const from = portNames[embarkPort] || embarkPort;
  const to = portNames[disembarkPort] || disembarkPort;

  if (
    embarkPort &&
    disembarkPort &&
    embarkPort !== '0' &&
    disembarkPort !== '0'
  ) {
    return `${from} → ${to}`;
  } else if (embarkPort && embarkPort !== '0') {
    return from;
  } else if (disembarkPort && disembarkPort !== '0') {
    return to;
  }
  return direction === 'Outbound' ? 'UK departure' : 'UK arrival';
}

export function parseTravelRecords(text: string): TravelRecord[] {
  const records: TravelRecord[] = [];
  const lines = text.split('\n');
  const recordPattern =
    /(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+(Inbound|Outbound)\s+(\S*)\s+(\S*)\s+(\S*)/i;

  for (const line of lines) {
    const match = line.match(recordPattern);
    if (match) {
      const [, dateStr, voyageCode, direction, embarkPort, , disembarkPort] =
        match;
      const date = parseDate(dateStr);

      if (date) {
        const normalizedDirection =
          direction.toLowerCase() === 'inbound' ? 'Inbound' : 'Outbound';
        let route = formatRoute(
          embarkPort || '',
          disembarkPort || '',
          normalizedDirection,
        );

        if (voyageCode.toLowerCase().includes('stenaline')) {
          route =
            normalizedDirection === 'Outbound'
              ? 'Harwich → Hook of Holland (Ferry)'
              : 'Hook of Holland → Harwich (Ferry)';
        } else if (voyageCode.includes('9F1111') || embarkPort === 'GBSPX') {
          route =
            normalizedDirection === 'Outbound'
              ? 'St Pancras (Eurostar/Ferry)'
              : 'St Pancras arrival';
        }

        records.push({
          date,
          direction: normalizedDirection,
          route,
          port: disembarkPort || embarkPort,
        });
      }
    }
  }

  const uniqueRecords: TravelRecord[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    // record.date is already in ISO format (YYYY-MM-DD)
    const key = `${record.date}-${record.direction}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRecords.push(record);
    }
  }

  uniqueRecords.sort((a, b) => a.date.localeCompare(b.date));
  return uniqueRecords;
}

export function pairTrips(records: TravelRecord[]): Trip[] {
  const trips: Trip[] = [];
  let tripId = 1;
  let i = 0;

  while (i < records.length) {
    const record = records[i];

    if (record.direction === 'Outbound') {
      let inboundIndex = -1;
      for (let j = i + 1; j < records.length; j++) {
        if (records[j].direction === 'Inbound') {
          inboundIndex = j;
          break;
        }
      }

      if (inboundIndex !== -1) {
        const inbound = records[inboundIndex];
        // Calculate calendar days between ISO date strings using date-fns
        const calendarDays = differenceInDays(
          parseISO(inbound.date),
          parseISO(record.date),
        );
        // Full days excludes departure and return days (per UK Home Office guidance)
        const fullDays = Math.max(0, calendarDays - 1);

        trips.push({
          id: tripId++,
          outDate: record.date,
          inDate: inbound.date,
          outRoute: record.route,
          inRoute: inbound.route,
          calendarDays,
          fullDays,
        });
        i = inboundIndex + 1;
      } else {
        trips.push({
          id: tripId++,
          outDate: record.date,
          inDate: null,
          outRoute: record.route,
          inRoute: 'No return recorded',
          calendarDays: null,
          fullDays: null,
        });
        i++;
      }
    } else {
      trips.push({
        id: tripId++,
        outDate: null,
        inDate: record.date,
        outRoute: 'No departure recorded',
        inRoute: record.route,
        calendarDays: null,
        fullDays: null,
      });
      i++;
    }
  }

  return trips;
}

export function analyzeTravelHistory(text: string): ParseResult {
  const records = parseTravelRecords(text);
  const trips = pairTrips(records);
  const completeTrips = trips.filter((t) => t.fullDays !== null);
  const totalFullDays = completeTrips.reduce(
    (sum, t) => sum + (t.fullDays || 0),
    0,
  );

  return {
    records,
    trips,
    summary: {
      totalTrips: trips.length,
      completeTrips: completeTrips.length,
      incompleteTrips: trips.length - completeTrips.length,
      totalFullDays,
    },
  };
}

export interface TravelRecord {
  date: Date;
  direction: 'Inbound' | 'Outbound';
  route: string;
  port?: string;
}

export interface Trip {
  id: number;
  outDate: Date | null;
  inDate: Date | null;
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

export function parseDate(dateStr: string): Date | null {
  const patterns = [
    /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      if (pattern === patterns[1]) {
        // YYYY-MM-DD: match[1] = year, match[2] = month, match[3] = day
        return new Date(
          parseInt(match[1]),
          parseInt(match[2]) - 1,
          parseInt(match[3])
        );
      } else {
        // DD/MM/YYYY or DD-MM-YYYY: match[1] = day, match[2] = month, match[3] = year
        return new Date(
          parseInt(match[3]),
          parseInt(match[2]) - 1,
          parseInt(match[1])
        );
      }
    }
  }
  return null;
}

export function formatRoute(
  embarkPort: string,
  disembarkPort: string,
  direction: string
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
          normalizedDirection
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
    const key = `${record.date.toISOString().split('T')[0]}-${
      record.direction
    }`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRecords.push(record);
    }
  }

  uniqueRecords.sort((a, b) => a.date.getTime() - b.date.getTime());
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
        const calendarDays = Math.floor(
          (inbound.date.getTime() - record.date.getTime()) /
            (1000 * 60 * 60 * 24)
        );
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
    0
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

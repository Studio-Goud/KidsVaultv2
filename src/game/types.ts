import type { Vec } from '../util/math';

export type PlaneClass = 'light' | 'medium' | 'heavy' | 'sea' | 'heli' | 'fast';
export type PlaneFamily = 'ga' | 'turboprop' | 'regional' | 'narrow' | 'wide' | 'bizjet' | 'heli' | 'sea' | 'fighter' | 'miltransport';

/** Top-down drawing description, already scaled to world units. */
export interface Shape {
  L: number; w: number; span: number; sweep: number; wingX: number; chord: number;
  tailSpan: number; tailX: number;
  engines: Array<{ x: number; y: number; kind: 'prop' | 'jet' | 'rearjet' }>;
  hump?: boolean; floats?: boolean; rotor?: 'single' | 'tandem'; highWing?: boolean; winglets?: boolean;
  delta?: boolean; twinTail?: boolean; canopy?: boolean; tTail?: boolean; afterburner?: boolean; afterburners?: number;
}
export type RunwayKind = 'short' | 'long' | 'water' | 'helipad';
export type TimeOfDay = 'morning' | 'golden' | 'dusk' | 'night';

export interface PlaneType {
  id: string;
  name: string;          // real aircraft name
  maker: string;
  cls: PlaneClass;
  speed: number;         // world units per second (1 unit = 1 m for distance display)
  turnRate: number;      // rad/s
  hull: number;          // collision radius in units
  windSensitivity: number;
  engines: 'prop1' | 'prop2' | 'prop4' | 'jet2' | 'jet4' | 'rotor' | 'float';
  livery: { body: string; accent: string; wing: string };
  family: PlaneFamily;
  shape: Shape;
  callsign: string;
  military: boolean;
  fuel: number;          // seconds of fuel for urgent (military) arrivals, 0 = no urgency
  crosswindLimit: number; // km/h demonstrated crosswind limit
  ils: boolean;           // can fly an instrument approach (land in fog)
  antiIce: 'none' | 'partial' | 'full';
  minVis: number;         // metres of visibility needed without ILS
  seaLimit: number;       // 0..1 sea state a seaplane accepts (0 = n/a)
  tip: string;           // shown in the post-mortem
  tipEn: string;
}

export interface RunwayDef {
  id: string;
  kind: RunwayKind;
  /** threshold (touchdown start) in normalized coords 0..1 of the world */
  x: number; y: number;
  /** landing heading in radians (0 = east, PI/2 = south on screen) */
  heading: number;
  length: number; // units
}

export interface IslandDef {
  cx: number; cy: number;     // normalized center
  rx: number; ry: number;     // normalized radii
  seed: number;
  style: 'meadow' | 'pine' | 'tropic' | 'polder' | 'rock' | 'desert' | 'urban';
  /** explicit outline (normalised) instead of a noisy ellipse */
  poly?: Array<[number, number]>;
  decor: Array<{ kind: 'lighthouse' | 'windmill' | 'village' | 'tower' | 'castle' | 'hangar' | 'terminal' | 'city' | 'mountain' | 'ridge' | 'beach' | 'forest'; x: number; y: number; rot?: number; w?: number; h?: number }>;
}

export interface WindDef {
  kmh: number;          // mean wind speed
  gust: number;         // +/- variation
  dirDeg: number;       // direction wind blows TOWARD, compass (0 = north/up, 90 = east)
  wander: number;       // degrees of direction wander
}

export interface LevelDef {
  id: string;
  name: string;
  subtitle: string;
  subtitleEn: string;
  time: TimeOfDay;
  goal: number;
  seed: number;
  islands: IslandDef[];
  runways: RunwayDef[];
  planes: Array<{ type: string; weight: number }>;
  spawn: { first: number; base: number; min: number; step: number; maxConcurrent: number; maxConcurrentEnd: number };
  wind: WindDef | null;
  clouds: number;
  weather?: import('./weather').WeatherScript;
  twinRunway?: boolean;
  /** real-world airport level */
  port?: import('./realports').RealPort;
  step?: number;
  /** lakes / bays drawn on top of the land (normalised polygons) */
  water?: Array<Array<[number, number]>>;
  /** ground colour family for real-world fields */
  ground?: 'polder' | 'grass' | 'rock' | 'desert' | 'tropic' | 'urban';
}

export type PlaneState = 'flying' | 'landing' | 'landed' | 'crashed' | 'taxi' | 'parked' | 'pushback' | 'holding' | 'takeoff' | 'departing';

export interface Plane {
  id: number;
  type: PlaneType;
  pos: Vec;
  heading: number;
  speed: number;
  state: PlaneState;
  path: Vec[];
  pathIndex: number;
  lockedRunway: string | null;
  pathDrawnAt: number;    // game time at which the current path was drawn (-1 = none)
  landingT: number;       // progress along runway 0..1
  runway: string | null;  // runway being landed on
  altitude: number;       // 1 = cruise, 0 = ground
  crossTrack: number;     // distance from drawn path (for wind feedback)
  spawnedAt: number;
  trail: Vec[];
  conflictWith: Set<number>;
  bank: number;
  livery: number;
  goArounds: number;
  wanderTimer: number;
  fuel: number;          // remaining seconds when urgent, else -1
  urgent: boolean;
  ice: number;           // 0..1 accumulated ice
  turbSeed: number;
  boost: number;         // speed multiplier from ATC speed commands
  boostUntil: number;
  hold: boolean;         // flying a holding circle
  evadeUntil: number;    // TCAS resolution in progress
  // ground handling
  ground: { path: Vec[]; seg: number; reverse: boolean } | null;
  gateId: number | null;
  parkUntil: number;
  airportId: string | null;
  landedOn?: string;
  departRunway?: string;
  takeoffAlong: number;  // metres rolled during the take-off run
  outbound: boolean;     // taxiing out for departure
}

export interface Snapshot {
  t: number;
  planes: Array<{ id: number; x: number; y: number; h: number; state: PlaneState; alt: number; path: Vec[]; lock: string | null; cross: number }>;
}

export type EventKind = 'path' | 'lock' | 'nearmiss' | 'crash' | 'goaround' | 'landed' | 'spawn' | 'touchdown' | 'mayday' | 'ditch' | 'command' | 'taxi' | 'pushback' | 'takeoff';
export interface GameEvent {
  t: number;
  kind: EventKind;
  planes: number[];
  text: string;
  meta?: Record<string, number | string>;
}

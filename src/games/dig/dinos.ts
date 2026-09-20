/**
 * The dinosaurs of Dino Dig.
 *
 * Each animal is described as a set of parts rather than as a traced outline: a body, a neck, a
 * head of a particular kind, a tail and legs. The same description drives both the skeleton in the
 * rock and the living animal that grows over it, so the two always line up. It is the approach the
 * aircraft in Cloudhopper use, and it holds up far better than hand placed outline points.
 *
 * All coordinates sit in a 0..1 box with y downwards. Every animal faces left.
 */

export type HeadKind = 'jaws' | 'small' | 'frill' | 'bill' | 'beak';
export type Crest = 'plates' | 'spikes' | 'tube' | 'horns' | 'club' | 'wings';
export type Era = 'triassic' | 'jurassic' | 'cretaceous';

export interface Limb {
  /** where the limb meets the body */
  hip: [number, number];
  /** where the foot rests */
  foot: [number, number];
  thick: number;
}

export interface Dino {
  id: string;
  name: string;
  nameNl: string;
  /** main body mass */
  body: { x: number; y: number; rx: number; ry: number; rot: number };
  /** from the front of the body to the base of the head */
  neck: { to: [number, number]; thick: number; curve: number };
  head: { kind: HeadKind; len: number; depth: number; tilt: number };
  /** from the back of the body to the tip of the tail */
  tail: { to: [number, number]; thick: number; sag: number };
  legs: Limb[];
  crest?: Crest;
  skin: string;
  belly: string;
  fact: string;
  factNl: string;
  /** which period it lived in */
  era: Era;
  /** millions of years ago: the older end and the younger end of its range */
  maFrom: number;
  maTo: number;
  /** nose to tail, in metres */
  lengthM: number;
  /** how much of the rock above it is hard, 0 gentle to 1 punishing */
  hardness: number;
}

export const ERAS: Record<Era, { name: string; nameNl: string; from: number; to: number; color: string }> = {
  triassic: { name: 'Triassic', nameNl: 'Trias', from: 252, to: 201, color: '#a4705a' },
  jurassic: { name: 'Jurassic', nameNl: 'Jura', from: 201, to: 145, color: '#5f8d6e' },
  cretaceous: { name: 'Cretaceous', nameNl: 'Krijt', from: 145, to: 66, color: '#7f7ba8' },
};

export const DINOS: Dino[] = [
  {
    id: 'trex', name: 'Tyrannosaurus', nameNl: 'Tyrannosaurus',
    body: { x: 0.52, y: 0.50, rx: 0.165, ry: 0.115, rot: -0.06 },
    neck: { to: [0.26, 0.37], thick: 0.055, curve: -0.05 },
    head: { kind: 'jaws', len: 0.17, depth: 0.095, tilt: 0.06 },
    tail: { to: [0.98, 0.40], thick: 0.085, sag: 0.05 },
    legs: [
      { hip: [0.56, 0.56], foot: [0.52, 0.86], thick: 0.055 },
      { hip: [0.42, 0.50], foot: [0.36, 0.62], thick: 0.022 },
    ],
    skin: '#6f8250', belly: '#c6c08a',
    fact: 'Twelve metres long, with teeth the size of bananas.',
    factNl: 'Twaalf meter lang, met tanden zo groot als bananen.',
    era: 'cretaceous', maFrom: 68, maTo: 66, lengthM: 12, hardness: 0.55,
  },
  {
    id: 'stego', name: 'Stegosaurus', nameNl: 'Stegosaurus',
    body: { x: 0.52, y: 0.52, rx: 0.185, ry: 0.125, rot: 0 },
    neck: { to: [0.26, 0.56], thick: 0.05, curve: 0.06 },
    head: { kind: 'small', len: 0.10, depth: 0.055, tilt: 0.1 },
    tail: { to: [0.97, 0.56], thick: 0.075, sag: -0.03 },
    legs: [
      { hip: [0.63, 0.60], foot: [0.645, 0.86], thick: 0.05 },
      { hip: [0.40, 0.60], foot: [0.385, 0.86], thick: 0.045 },
    ],
    crest: 'plates',
    skin: '#5f8479', belly: '#b9c4ac',
    fact: 'The plates on its back were as tall as a child.',
    factNl: 'De platen op zijn rug waren zo hoog als een kind.',
    era: 'jurassic', maFrom: 155, maTo: 145, lengthM: 9, hardness: 0.35,
  },
  {
    id: 'tricera', name: 'Triceratops', nameNl: 'Triceratops',
    body: { x: 0.58, y: 0.53, rx: 0.17, ry: 0.13, rot: 0 },
    neck: { to: [0.36, 0.50], thick: 0.075, curve: 0 },
    head: { kind: 'frill', len: 0.20, depth: 0.16, tilt: 0.04 },
    tail: { to: [0.94, 0.60], thick: 0.07, sag: 0.02 },
    legs: [
      { hip: [0.68, 0.62], foot: [0.70, 0.86], thick: 0.05 },
      { hip: [0.46, 0.62], foot: [0.44, 0.86], thick: 0.05 },
    ],
    crest: 'horns',
    skin: '#8a7050', belly: '#cfbd93',
    fact: 'Three horns and a bony frill, like a shield for the neck.',
    factNl: 'Drie hoorns en een benen kraag, als een schild voor de nek.',
    era: 'cretaceous', maFrom: 68, maTo: 66, lengthM: 9, hardness: 0.5,
  },
  {
    id: 'diplo', name: 'Diplodocus', nameNl: 'Diplodocus',
    body: { x: 0.52, y: 0.52, rx: 0.145, ry: 0.105, rot: 0 },
    neck: { to: [0.16, 0.34], thick: 0.042, curve: 0.02 },
    head: { kind: 'small', len: 0.075, depth: 0.042, tilt: -0.2 },
    tail: { to: [0.99, 0.60], thick: 0.075, sag: -0.06 },
    legs: [
      { hip: [0.62, 0.60], foot: [0.635, 0.86], thick: 0.048 },
      { hip: [0.42, 0.58], foot: [0.41, 0.86], thick: 0.048 },
    ],
    skin: '#7f8560', belly: '#c8c8a4',
    fact: 'Twenty-six metres long, and most of that was neck and tail.',
    factNl: 'Zesentwintig meter lang, en dat was vooral nek en staart.',
    era: 'jurassic', maFrom: 154, maTo: 152, lengthM: 26, hardness: 0.45,
  },
  {
    id: 'velo', name: 'Velociraptor', nameNl: 'Velociraptor',
    body: { x: 0.48, y: 0.52, rx: 0.125, ry: 0.082, rot: -0.08 },
    neck: { to: [0.27, 0.42], thick: 0.038, curve: -0.07 },
    head: { kind: 'beak', len: 0.115, depth: 0.055, tilt: 0.12 },
    tail: { to: [0.98, 0.46], thick: 0.055, sag: -0.02 },
    legs: [
      { hip: [0.52, 0.57], foot: [0.47, 0.82], thick: 0.038 },
      { hip: [0.40, 0.52], foot: [0.345, 0.63], thick: 0.018 },
    ],
    skin: '#a06e3c', belly: '#ddc089',
    fact: 'Turkey sized, feathered, and quick on two legs.',
    factNl: 'Zo groot als een kalkoen, met veren, en snel op twee poten.',
    era: 'cretaceous', maFrom: 75, maTo: 71, lengthM: 2, hardness: 0.7,
  },
  {
    id: 'para', name: 'Parasaurolophus', nameNl: 'Parasaurolophus',
    body: { x: 0.56, y: 0.55, rx: 0.165, ry: 0.115, rot: -0.07 },
    neck: { to: [0.31, 0.42], thick: 0.05, curve: -0.06 },
    head: { kind: 'bill', len: 0.145, depth: 0.065, tilt: 0.1 },
    tail: { to: [0.97, 0.62], thick: 0.075, sag: 0.03 },
    legs: [
      { hip: [0.62, 0.61], foot: [0.60, 0.86], thick: 0.05 },
      { hip: [0.45, 0.57], foot: [0.42, 0.72], thick: 0.028 },
    ],
    crest: 'tube',
    skin: '#5f7f9e', belly: '#bed0dd',
    fact: 'The crest on its head worked like a trumpet.',
    factNl: 'De kam op zijn kop werkte als een trompet.',
    era: 'cretaceous', maFrom: 76, maTo: 73, lengthM: 10, hardness: 0.6,
  },
  {
    id: 'allo', name: 'Allosaurus', nameNl: 'Allosaurus',
    body: { x: 0.51, y: 0.50, rx: 0.155, ry: 0.10, rot: -0.07 },
    neck: { to: [0.25, 0.36], thick: 0.05, curve: -0.06 },
    head: { kind: 'jaws', len: 0.145, depth: 0.075, tilt: 0.08 },
    tail: { to: [0.98, 0.42], thick: 0.08, sag: 0.04 },
    legs: [
      { hip: [0.55, 0.55], foot: [0.51, 0.85], thick: 0.05 },
      { hip: [0.40, 0.49], foot: [0.33, 0.63], thick: 0.026 },
    ],
    skin: '#8a7a4a', belly: '#d3c68f',
    fact: 'The great hunter of the Jurassic, with three fingers on each hand.',
    factNl: 'De grote jager van de Jura, met drie vingers aan elke hand.',
    era: 'jurassic', maFrom: 155, maTo: 145, lengthM: 9.5, hardness: 0.5,
  },
  {
    id: 'anky', name: 'Ankylosaurus', nameNl: 'Ankylosaurus',
    body: { x: 0.50, y: 0.55, rx: 0.20, ry: 0.115, rot: 0 },
    neck: { to: [0.23, 0.58], thick: 0.06, curve: 0.04 },
    head: { kind: 'small', len: 0.095, depth: 0.06, tilt: 0.06 },
    tail: { to: [0.95, 0.58], thick: 0.07, sag: -0.02 },
    legs: [
      { hip: [0.62, 0.63], foot: [0.635, 0.84], thick: 0.048 },
      { hip: [0.36, 0.63], foot: [0.345, 0.84], thick: 0.046 },
    ],
    crest: 'club',
    skin: '#6d6a52', belly: '#bab48c',
    fact: 'A walking fortress with a club of bone on the end of its tail.',
    factNl: 'Een wandelend fort met een knots van bot aan zijn staart.',
    era: 'cretaceous', maFrom: 68, maTo: 66, lengthM: 8, hardness: 0.75,
  },
  {
    id: 'iguano', name: 'Iguanodon', nameNl: 'Iguanodon',
    body: { x: 0.55, y: 0.54, rx: 0.165, ry: 0.115, rot: -0.06 },
    neck: { to: [0.30, 0.40], thick: 0.05, curve: -0.05 },
    head: { kind: 'bill', len: 0.125, depth: 0.06, tilt: 0.1 },
    tail: { to: [0.97, 0.60], thick: 0.075, sag: 0.02 },
    legs: [
      { hip: [0.61, 0.60], foot: [0.59, 0.85], thick: 0.05 },
      { hip: [0.44, 0.56], foot: [0.40, 0.71], thick: 0.03 },
    ],
    skin: '#7d8a5c', belly: '#c8cea0',
    fact: 'One of the first dinosaurs ever named, with a spike for a thumb.',
    factNl: 'Een van de eerste dinosaurussen die ooit een naam kreeg, met een punt als duim.',
    era: 'cretaceous', maFrom: 125, maTo: 122, lengthM: 10, hardness: 0.4,
  },
  {
    id: 'archaeo', name: 'Archaeopteryx', nameNl: 'Archaeopteryx',
    body: { x: 0.47, y: 0.50, rx: 0.10, ry: 0.07, rot: -0.06 },
    neck: { to: [0.30, 0.41], thick: 0.03, curve: -0.05 },
    head: { kind: 'beak', len: 0.085, depth: 0.042, tilt: 0.1 },
    tail: { to: [0.95, 0.44], thick: 0.04, sag: -0.02 },
    legs: [
      { hip: [0.50, 0.55], foot: [0.46, 0.76], thick: 0.026 },
    ],
    crest: 'wings',
    skin: '#5d6f86', belly: '#c0cbd8',
    fact: 'Feathers, wings and teeth: half dinosaur, half bird.',
    factNl: 'Veren, vleugels en tanden: half dinosaurus, half vogel.',
    era: 'jurassic', maFrom: 150, maTo: 148, lengthM: 0.5, hardness: 0.85,
  },
];

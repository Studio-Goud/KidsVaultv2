/**
 * The checks that can be run without a browser.
 *
 * Most of Bramblewood is canvas and thumbs, and the honest way to test that is `tests/regression.md`
 * plus a phone. But the *rules* underneath - when a runway is clear, how a rocket cuts into stages,
 * what the air makes of a shape - are plain functions over plain data, and those should never be
 * allowed to break quietly.
 *
 * No test framework: esbuild is already here as a Vite dependency, so the leaf modules are bundled
 * to a temp directory and imported. `npm test`.
 *
 * Each check is arrange (the design or situation built just above it), act (the call inside the
 * check) and assert (the expected value beside it). Names follow
 * test_[system]_[scenario]_[expected_result], per .claude/rules/test-standards.md. Nothing here
 * touches the filesystem, the network or shared mutable state, so the order does not matter.
 */

import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = mkdtempSync(join(tmpdir(), 'bramble-test-'));
const bundle = async (src, name) => {
  const file = join(out, name);
  await build({ entryPoints: [src], bundle: true, format: 'esm', outfile: file, logLevel: 'warning' });
  return import(file);
};

// `src/game/progress.ts` reaches the saved game and the language through the browser, so the two
// globals it touches are stubbed here. Nothing else in this file needs them.
const fakeStore = {};
globalThis.localStorage = {
  getItem: k => fakeStore[k] ?? null,
  setItem: (k, v) => { fakeStore[k] = String(v); },
  removeItem: k => { delete fakeStore[k]; },
};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'nl' }, configurable: true });

let failed = 0;
let ran = 0;
const is = (name, got, want) => {
  ran++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) console.log(`  ok   ${name}`);
  else { failed++; console.log(`  FAIL ${name}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`); }
};
const group = name => console.log(`\n${name}`);

// ---------------------------------------------------------------- Cloudhopper: when may the next one land

{
  const { stripBusyFor, CLEAR_BEHIND_AT } = await bundle('src/game/runwayrule.ts', 'runwayrule.mjs');
  group('Cloudhopper — clearing an arrival onto a runway');
  const rolling = (t, rw = '09') => ({ state: 'landing', runway: rw, landingT: t });
  is('test_runway_empty_clears_arrival', stripBusyFor(null, 2, undefined, '09'), false);
  is('test_runway_own_claim_does_not_block', stripBusyFor(2, 2, rolling(0), '09'), false);
  is('test_runway_just_touched_down_blocks', stripBusyFor(1, 2, rolling(0.02), '09'), true);
  is('test_runway_fifth_of_roll_blocks', stripBusyFor(1, 2, rolling(0.2), '09'), true);
  is('test_runway_quarter_of_roll_blocks', stripBusyFor(1, 2, rolling(CLEAR_BEHIND_AT), '09'), true);
  is('test_runway_past_quarter_clears_arrival', stripBusyFor(1, 2, rolling(0.3), '09'), false);
  is('test_runway_most_of_roll_clears_arrival', stripBusyFor(1, 2, rolling(0.8), '09'), false);
  is('test_runway_other_strip_still_blocks', stripBusyFor(1, 2, rolling(0.8, '27'), '09'), true);
  is('test_runway_taxiing_off_blocks', stripBusyFor(1, 2, { state: 'taxi', runway: '09', landingT: 0.9 }, '09'), true);
  is('test_runway_departure_lined_up_blocks', stripBusyFor(1, 2, { state: 'holding', runway: null, landingT: 0 }, '09'), true);
  is('test_runway_vanished_claimant_clears_arrival', stripBusyFor(1, 2, undefined, '09'), false);
}

// ---------------------------------------------------------------- Moonshot: how a design behaves

{
  const d = await bundle('src/games/moonshot/design.ts', 'design.mjs');
  const { partById, stagesByColumn, deadWeight, dudEngines, buildProblem, isOnePiece, canPlace,
    collapse, stillAttached, shapeOf, slipperiness, widthOf, taperSpan, canLift, isFlyable,
    PARTS, padThrust, totalThrust, DELAYS, clampDelay,
    kitOf, missionOf, holdFree, STOWABLE, totalMass, stowedMass, cleanDesign } = d;

  /** a column of parts stacked bottom-first, the way a child builds one */
  const col = (c, ids) => {
    const out = [];
    let row = 0;
    for (const id of ids) { out.push({ id, col: c, row }); row += partById(id).rows; }
    return out;
  };
  const stageParts = design =>
    [...stagesByColumn(design)].map(([c, l]) => `${c}:${l.map(s => s.parts.slice().sort((a, b) => a - b).join('+')).join('|')}`).join(' ');

  group('Moonshot — the parts themselves');
  is('test_parts_there_are_at_least_a_hundred', PARTS.length >= 100, true);
  is('test_parts_ids_are_unique', new Set(PARTS.map(p => p.id)).size, PARTS.length);
  is('test_parts_all_have_both_languages',
    PARTS.every(p => p.name && p.nameNl && p.note && p.noteNl), true);
  is('test_parts_all_fit_on_the_grid', PARTS.every(p => p.rows >= 1 && p.rows <= 6 && p.w > 0), true);
  is('test_parts_nothing_weighs_nothing', PARTS.every(p => p.dry > 0 || p.fuel > 0), true);
  is('test_parts_every_engine_has_thrust',
    PARTS.filter(p => p.kind === 'engine').every(p => p.burn > 0 && p.exhaust > 0), true);
  is('test_parts_every_booster_carries_its_own_fuel',
    PARTS.filter(p => p.kind === 'solid').every(p => p.fuel > 0 && p.burn > 0), true);
  is('test_parts_tank_fuel_follows_volume', PARTS.filter(p => p.kind === 'tank' && p.art === undefined)
    .every(p => Math.abs(p.fuel - 2.75 * p.w * p.w * p.rows) < 0.06), true);

  group('Moonshot — every part has a job');
  // "een ruim, waar je niks in kan stoppen" - the hold takes two things now, and what is inside
  // is carried but never meets the air
  const bay = () => [{ id: 'cargo', col: 4, row: 0 }];
  is('test_hold_empty_bay_offers_two_slots', kitOf(bay()).holdSlots, 2);
  is('test_hold_empty_bay_carries_nothing', kitOf(bay()).stowed, []);
  is('test_hold_free_slots_on_an_empty_bay', holdFree(bay()), 2);
  is('test_hold_free_slots_with_one_thing_inside',
    holdFree([{ id: 'cargo', col: 4, row: 0, hold: ['rover'] }]), 1);
  is('test_hold_a_full_bay_has_no_room',
    holdFree([{ id: 'cargo', col: 4, row: 0, hold: ['rover', 'sat'] }]), 0);
  is('test_hold_stowed_mass_is_carried',
    Math.round(totalMass([{ id: 'cargo', col: 4, row: 0, hold: ['rover'] }]) * 100) / 100,
    Math.round((partById('cargo').dry + partById('rover').dry) * 100) / 100);
  is('test_hold_stowed_mass_of_an_empty_bay_is_zero', stowedMass({ id: 'cargo', col: 4, row: 0 }), 0);
  is('test_hold_stowed_parts_stay_out_of_the_shape',
    shapeOf([{ id: 'cargo', col: 4, row: 0, hold: ['rover'] }]).drag,
    shapeOf([{ id: 'cargo', col: 4, row: 0 }]).drag);
  is('test_hold_what_is_inside_still_does_its_job',
    kitOf([{ id: 'cargo', col: 4, row: 0, hold: ['camera'] }]).cameras, 1);
  is('test_hold_everything_stowable_is_a_real_part',
    STOWABLE.every(id => PARTS.some(p => p.id === id)), true);
  is('test_hold_a_saved_bay_keeps_what_is_in_it',
    cleanDesign([{ id: 'cargo', col: 4, row: 0, hold: ['rover'] }])?.[0].hold, ['rover']);
  is('test_hold_a_saved_bay_drops_things_that_do_not_fit_in_one',
    cleanDesign([{ id: 'cargo', col: 4, row: 0, hold: ['tank-m'] }])?.[0].hold, undefined);

  // the kit used to fall into the sea with the empty tank it was bolted to, which is why a
  // parachute, a camera and a flag all appeared to do nothing at all
  const geared = col(4, ['engine-s', 'tank-s', 'chute', 'camera', 'antenna', 'solar', 'flag', 'capsule']);
  const firstStage = [...stagesByColumn(geared).values()][0][0];
  is('test_gear_does_not_fall_away_with_the_spent_stage',
    firstStage.parts.map(i => geared[i].id), ['engine-s', 'tank-s']);
  is('test_gear_still_works_after_the_stage_has_gone',
    kitOf(geared, new Set(firstStage.parts)).cameras, 1);
  is('test_gear_is_not_dead_weight', deadWeight(geared).length, 0);
  is('test_gear_a_nose_still_rides_with_its_booster',
    [...stagesByColumn([...col(3, ['srb-s', 'nose'])]).values()][0][0].parts.length, 2);

  group('Moonshot — what a flight managed');
  const kit = ids => kitOf(ids.map((id, i) => ({ id, col: i, row: 0 })));
  is('test_mission_a_camera_alone_takes_no_picture', missionOf(kit(['camera']), 6, 1).photo, false);
  is('test_mission_a_camera_alone_says_it_has_no_power',
    missionOf(kit(['camera']), 6, 1).photoMiss, 'power');
  is('test_mission_a_powered_camera_still_needs_an_aerial',
    missionOf(kit(['camera', 'solar']), 6, 1).photoMiss, 'radio');
  is('test_mission_camera_power_and_aerial_bring_a_picture_home',
    missionOf(kit(['camera', 'solar', 'antenna']), 6, 1).photo, true);
  is('test_mission_no_picture_from_a_flight_that_never_left_the_pad',
    missionOf(kit(['camera', 'solar', 'antenna']), 0, 1).photo, false);
  is('test_mission_a_capsule_brings_its_own_power_and_aerial',
    missionOf(kit(['capsule', 'camera']), 6, 1).photo, true);
  is('test_mission_a_light_payload_comes_down_under_a_parachute',
    missionOf(kit(['chute']), 6, 1).landed, true);
  is('test_mission_too_heavy_for_the_parachute_does_not',
    missionOf(kit(['chute']), 6, 9).landed, false);
  is('test_mission_the_big_parachute_carries_more',
    missionOf(kit(['chute-l']), 6, 9).landed, true);
  is('test_mission_legs_make_it_land_upright',
    missionOf(kit(['chute', 'leg']), 6, 1).upright, true);
  is('test_mission_without_legs_it_lands_on_its_side',
    missionOf(kit(['chute']), 6, 1).upright, false);
  is('test_mission_a_flag_needs_something_to_stand_on',
    missionOf(kit(['flag']), 6, 1).flag, false);
  is('test_mission_a_flag_with_legs_gets_planted',
    missionOf(kit(['flag', 'leg']), 6, 1).flag, true);
  is('test_mission_a_satellite_is_left_behind_once_you_get_round_the_earth',
    missionOf(kit(['sat']), 5, 1).deployed, ['sat']);
  is('test_mission_a_satellite_stays_aboard_on_a_short_hop',
    missionOf(kit(['sat']), 2, 1).deployed, []);
  is('test_mission_a_cabin_counts_its_crew', missionOf(kit(['cabin']), 6, 1).crew, 4);
  is('test_mission_a_telescope_does_science', missionOf(kit(['telescope']), 6, 1).science > 0, true);
  is('test_kit_air_brakes_are_counted', kit(['airbrake']).brake, 1);
  is('test_kit_girders_steady_the_rocket', kit(['truss-l']).struts, 2);

  group('Moonshot — holding an engine back');
  const held = [...col(4, ['engine-s', 'tank-s', 'capsule'])];
  held[0] = { ...held[0], delay: 10 };
  is('test_delay_engine_set_to_wait_is_not_pad_thrust', padThrust(held), 0);
  is('test_delay_engine_set_to_wait_still_counts_as_thrust', totalThrust(held) > 0, true);
  is('test_delay_all_engines_waiting_is_a_problem', buildProblem(held, false),
    'Every engine is set to wait. One of them has to light at zero.');
  const mixed = [...col(4, ['engine-s', 'tank-s', 'capsule']), ...col(3, ['srb-s'])];
  mixed[3] = { ...mixed[3], delay: 15 };
  is('test_delay_a_waiting_booster_leaves_the_rest_on_the_pad',
    Math.round(padThrust(mixed)), Math.round(totalThrust(mixed) - partById('srb-s').burn * partById('srb-s').exhaust));
  is('test_delay_snaps_to_one_of_the_offered_values', DELAYS.includes(clampDelay(13)), true);
  is('test_delay_zero_stays_zero', clampDelay(0), 0);

  group('Moonshot — cutting a design into stages');
  const twoStage = col(4, ['engine-s', 'tank-s', 'engine-v', 'tank-s', 'capsule']);
  is('test_stages_engine_owns_tanks_until_next_engine', stageParts(twoStage), '4:0+1|2+3');
  const withBoosters = [...col(4, ['engine-s', 'tank-s', 'capsule']), ...col(3, ['srb-s', 'nose']), ...col(5, ['srb-s'])];
  is('test_stages_each_column_stages_separately', stageParts(withBoosters), '4:0+1 3:3+4 5:5');
  const withFins = [...col(4, ['engine-s', 'tank-s', 'capsule']), ...col(3, ['fin-s'])];
  is('test_stages_fin_rides_with_bolted_stage', stageParts(withFins), '4:0+1+3 3:');
  is('test_deadweight_fin_is_not_dead_weight', deadWeight(withFins).length, 0);
  is('test_stages_capsule_never_drops', stagesByColumn(twoStage).get(4).every(s => !s.parts.includes(4)), true);

  group('Moonshot — what is wrong with it');
  is('test_problem_sound_rocket_reports_nothing', buildProblem(col(4, ['engine-s', 'tank-s', 'capsule']), false), null);
  is('test_problem_no_payload_reports_nothing_riding', buildProblem(col(4, ['engine-s', 'tank-s']), false),
    'Nothing is riding along. Put a capsule or a probe on it.');
  is('test_problem_no_engine_reports_no_engine', buildProblem(col(4, ['tank-s', 'capsule']), false),
    'No engine can fire. Put an engine under a tank.');
  is('test_duds_stacked_engines_reports_lower_one', dudEngines(col(4, ['engine-s', 'engine-l', 'tank-s', 'capsule'])).length, 1);
  is('test_deadweight_lone_tank_column_reports_one',
    deadWeight([...col(4, ['engine-s', 'tank-s', 'capsule']), ...col(3, ['tank-l'])]).length, 1);
  is('test_lift_tiny_engine_under_wide_tank_cannot_lift', canLift(col(4, ['engine-xs', 'tank-w', 'cabin'])), false);
  is('test_flyable_rocket_that_cannot_lift_is_not_flyable', isFlyable(col(4, ['engine-xs', 'tank-w', 'cabin'])), false);

  group('Moonshot — putting parts on the grid');
  const base = col(4, ['engine-s', 'tank-s', 'capsule']);
  is('test_place_occupied_cell_is_refused', canPlace(base, { id: 'tank-s', col: 4, row: 1 }), false);
  is('test_place_beside_rocket_is_allowed', canPlace(base, { id: 'srb-s', col: 3, row: 0 }), true);
  is('test_place_out_of_reach_is_refused', canPlace(base, { id: 'srb-s', col: 1, row: 0 }), false);
  is('test_place_on_top_of_stack_is_allowed', canPlace(base, { id: 'nose', col: 4, row: 5 }), true);
  is('test_onepiece_intact_rocket_is_one_piece', isOnePiece(base), true);
  is('test_onepiece_detached_part_is_not_one_piece', isOnePiece([...base, { id: 'nose', col: 1, row: 0 }]), false);

  group('Moonshot — gravity in the workshop');
  const gap = [{ id: 'engine-s', col: 4, row: 0 }, { id: 'capsule', col: 4, row: 3 }];
  collapse(gap);
  is('test_collapse_hanging_part_falls_onto_support', gap[1].row, 1);

  group('Moonshot — what comes off when a stage goes');
  const strapped = [...col(4, ['engine-x', 'tank-s', 'engine-s', 'tank-s', 'capsule']), ...col(3, ['srb-l']), ...col(5, ['srb-l'])];
  const afterCore = stillAttached(strapped, new Set([0, 1]));
  is('test_attached_boosters_holding_nothing_come_off', [...afterCore].sort((a, b) => a - b), [2, 3, 4]);
  const afterBoosters = stillAttached(strapped, new Set([5, 6]));
  is('test_attached_dropping_boosters_leaves_rocket_whole', [...afterBoosters].sort((a, b) => a - b), [0, 1, 2, 3, 4]);

  group('Moonshot — what the air sees');
  const flat = col(4, ['engine-s', 'tank-l', 'tank-l', 'probe']);
  const capped = col(4, ['engine-s', 'tank-l', 'tank-l', 'nose']);
  is('test_shape_nose_cone_lowers_drag', shapeOf(capped).drag < shapeOf(flat).drag, true);
  const slim = col(4, ['engine-s', 'tank-l', 'tank-l', 'nose']);
  const fat = col(4, ['engine-s', 'tank-w', 'nose']);
  is('test_shape_fat_rocket_has_larger_frontal_area', shapeOf(fat).area > shapeOf(slim).area, true);
  is('test_shape_fat_rocket_is_less_slippery', slipperiness(shapeOf(fat)) < slipperiness(shapeOf(slim)), true);
  const onBooster = [...col(4, ['engine-s', 'tank-s', 'capsule']), ...col(3, ['srb-s', 'nose'])];
  is('test_shape_nose_cone_adopts_width_below', widthOf(onBooster, 4), partById('srb-s').w);
  const triple = [...col(4, ['engine-l', 'tank-l', 'capsule']), ...col(3, ['srb-t'])];
  const singles = [...col(4, ['engine-l', 'tank-l', 'capsule']), ...col(3, ['srb-s'])];
  is('test_shape_triple_booster_is_three_tubes_not_one_disc',
    shapeOf(triple).area < shapeOf(singles).area * 4, true);
  is('test_shape_triple_booster_still_costs_more_than_one',
    shapeOf(triple).area > shapeOf(singles).area, true);
  const tapered = col(4, ['engine-w', 'tank-w', 'adapter', 'tank-thin', 'capsule']);
  const stepped = col(4, ['engine-w', 'tank-w', 'tank-thin', 'capsule']);
  is('test_taper_takes_the_width_below_and_above', taperSpan(tapered, 2),
    { bottom: partById('tank-w').w, top: partById('tank-thin').w });
  is('test_shape_taper_lowers_drag_against_a_step', shapeOf(tapered).drag < shapeOf(stepped).drag, true);
  const orbiter = [...col(4, ['engine-x', 'tank-w', 'tank-w', 'nose']), ...col(5, ['shuttle'])];
  is('test_stages_shuttle_is_payload_and_never_drops',
    [...stagesByColumn(orbiter).values()].flat().every(st => !st.parts.includes(4)), true);
  is('test_deadweight_shuttle_is_not_dead_weight', deadWeight(orbiter).length, 0);
  is('test_flyable_shuttle_stack_flies', isFlyable(orbiter), true);
  is('test_shape_side_boosters_widen_frontal_area',
    shapeOf([...col(4, ['engine-l', 'tank-l', 'capsule']), ...col(3, ['srb-l']), ...col(5, ['srb-l'])]).area
    > shapeOf(col(4, ['engine-l', 'tank-l', 'capsule'])).area, true);
}

// ---------------------------------------------------------------- Puffball: who carries on walking

{
  const { stepDirections } = await bundle('src/games/puffball/walkrule.ts', 'walkrule.mjs');
  group('Puffball — which way a walker tries to go');
  const none = { x: 0, y: 0 };
  const right = { x: 1, y: 0 };
  const left = { x: -1, y: 0 };
  // the bug this is here for: letting go of the arrow used to leave the hedgehog running on
  is('test_walk_player_released_key_stops', stepDirections(true, none, right), []);
  is('test_walk_player_held_key_keeps_walking', stepDirections(true, right, right), [right]);
  is('test_walk_player_new_direction_turns', stepDirections(true, left, right), [left]);
  is('test_walk_mole_left_alone_carries_on', stepDirections(false, none, right), [right]);
  is('test_walk_mole_given_a_direction_prefers_it', stepDirections(false, left, right), [left, right]);
}

// ---------------------------------------------------------------- Moonshot: where it can get to

{
  const { LADDER, rungFor, coastHeight, kmLabel, G0, EARTH_R } = await bundle('src/games/moonshot/design.ts', 'ladder.mjs');
  group('Moonshot — the ladder of places');
  is('test_ladder_speeds_only_ever_rise',
    LADDER.every((m, i) => i === 0 || m.speed > LADDER[i - 1].speed), true);
  const escape = Math.sqrt(2 * G0 * EARTH_R);
  const away = LADDER.find(m => m.name === 'Away from the Earth');
  is('test_ladder_escape_rung_is_real_escape_velocity', Math.abs(away.speed - escape) < 40, true);
  // near escape velocity the height runs away with you - a metre a second is thousands of
  // kilometres - so what matters is that the rung reaches the Moon and does not wildly overshoot
  const moonReach = coastHeight(LADDER.find(m => m.name === 'The Moon').speed, 0);
  is('test_ladder_moon_rung_coasts_at_least_to_the_moon', moonReach >= 384400, true);
  is('test_ladder_moon_rung_does_not_wildly_overshoot', moonReach < 384400 * 1.05, true);
  is('test_ladder_every_world_has_a_photo_and_a_fact',
    LADDER.filter(m => m.photo).every(m => m.fact && m.factNl), true);
  is('test_rung_for_speed_takes_the_highest_reached', rungFor(11600).rung.name, 'Mars');
  is('test_rung_for_speed_below_the_first_is_the_pad', rungFor(10).rung.name, 'The pad');
  is('test_rung_for_speed_above_the_last_is_the_last',
    rungFor(99999).rung.name, LADDER[LADDER.length - 1].name);
  // a height of 1400 km used to print as "1.000 km": rounded to whole thousands, and the Dutch
  // separator was used in English too
  is('test_km_label_metres_below_a_kilometre', kmLabel(0.4, false), '400 m');
  is('test_km_label_one_decimal_below_ten_kilometres', kmLabel(5.25, false), '5.3 km');
  is('test_km_label_whole_kilometres_below_a_thousand', kmLabel(120.4, false), '120 km');
  is('test_km_label_groups_thousands_in_english', kmLabel(1400, false), '1,400 km');
  is('test_km_label_groups_thousands_in_dutch', kmLabel(1400, true), '1.400 km');
  is('test_km_label_keeps_the_moon_exact', kmLabel(384400, false), '384,400 km');
  is('test_km_label_millions_above_a_million', kmLabel(1234567, false), '1.2 million km');
  is('test_km_label_infinity_says_so', kmLabel(Infinity, false), 'further than we can count');
}

// ---------------------------------------------------------------- Cloudhopper: one road, not two menus

{
  const { route, routeNow, stopOpen, stopShort, WORLDS } = await bundle('src/game/progress.ts', 'progress.mjs');
  const { REAL_PORTS } = await bundle('src/game/realports.ts', 'realports.mjs');
  group('Cloudhopper — the journey');
  const stops = route();
  const needs = stops.map(s => s.needs);
  is('test_route_holds_every_island_and_every_field',
    stops.length, WORLDS.length + REAL_PORTS.length);
  is('test_route_lists_each_island_once',
    stops.filter(s => s.kind === 'island').map(s => s.world), WORLDS.map((_, i) => i));
  is('test_route_lists_each_field_once',
    new Set(stops.filter(s => s.kind === 'port').map(s => s.port.id)).size, REAL_PORTS.length);
  is('test_route_never_asks_for_fewer_stars_than_the_stop_before',
    needs.every((n, i) => i === 0 || n >= needs[i - 1]), true);
  const tie = stops[0].needs === undefined ? -1 : needs.findIndex((n, i) => i > 0 && n === needs[i - 1]);
  is('test_route_puts_the_island_first_when_two_stops_ask_the_same',
    tie < 0 || stops[tie - 1].kind === 'island', true);
  is('test_route_opens_with_the_first_island', stops[0].kind === 'island' && stops[0].world === 0, true);
  is('test_route_first_stop_is_open_on_a_fresh_save', stopOpen(stops[0]), true);
  is('test_route_first_stop_asks_for_no_stars', stopShort(stops[0]), 0);
  is('test_route_second_stop_is_shut_on_a_fresh_save', stopOpen(stops[1]), false);
  is('test_route_now_is_the_first_island_on_a_fresh_save', routeNow(), 0);
}

// ---------------------------------------------------------------- Klokkijken: how a clock is said out loud

{
  const { spokenTime, spokenTimeEn, hourNameNl, digitalLabel, handAngles, minuteFromAngle,
    hourFromAngle, minutesBetween, plusMinutes, dayPartNl, durationLabel } =
    await bundle('src/games/clock/dutchtime.ts', 'dutchtime.mjs');

  group('Klokkijken — de klok hardop, in het Nederlands');
  // the hour, and the two ends of the day that are both called twelve
  is('test_dutchtime_whole_hour_says_uur', spokenTime(3, 0), 'drie uur');
  is('test_dutchtime_noon_is_twelve_uur', spokenTime(12, 0), 'twaalf uur');
  is('test_dutchtime_midnight_is_twelve_uur', spokenTime(0, 0), 'twaalf uur');
  is('test_dutchtime_afternoon_hour_uses_the_face_name', spokenTime(15, 0), 'drie uur');
  is('test_dutchtime_twentythree_hundred_is_elf_uur', spokenTime(23, 0), 'elf uur');

  // the quarters
  is('test_dutchtime_quarter_past_counts_from_this_hour', spokenTime(3, 15), 'kwart over drie');
  is('test_dutchtime_quarter_to_counts_to_the_next_hour', spokenTime(3, 45), 'kwart voor vier');
  is('test_dutchtime_quarter_past_twelve_is_over_twaalf', spokenTime(12, 15), 'kwart over twaalf');
  is('test_dutchtime_quarter_to_one_after_midnight', spokenTime(0, 45), 'kwart voor een');
  is('test_dutchtime_quarter_to_midnight_is_voor_twaalf', spokenTime(23, 45), 'kwart voor twaalf');

  // the half hour, which belongs to the hour that is coming, not the one just gone
  is('test_dutchtime_half_past_three_is_half_vier', spokenTime(3, 30), 'half vier');
  is('test_dutchtime_half_past_twelve_is_half_een', spokenTime(12, 30), 'half een');
  is('test_dutchtime_half_past_midnight_is_half_een', spokenTime(0, 30), 'half een');
  is('test_dutchtime_half_past_eleven_is_half_twaalf', spokenTime(11, 30), 'half twaalf');
  is('test_dutchtime_half_past_twentythree_is_half_twaalf', spokenTime(23, 30), 'half twaalf');

  // before the half and after the half, which is where Dutch children come unstuck
  is('test_dutchtime_twenty_past_is_tien_voor_half', spokenTime(3, 20), 'tien voor half vier');
  is('test_dutchtime_twentyfive_past_is_vijf_voor_half', spokenTime(3, 25), 'vijf voor half vier');
  is('test_dutchtime_sixteen_past_is_veertien_voor_half', spokenTime(3, 16), 'veertien voor half vier');
  is('test_dutchtime_twentynine_past_is_een_voor_half', spokenTime(3, 29), 'een voor half vier');
  is('test_dutchtime_twentyfive_to_is_vijf_over_half', spokenTime(3, 35), 'vijf over half vier');
  is('test_dutchtime_twenty_to_is_tien_over_half', spokenTime(3, 40), 'tien over half vier');
  is('test_dutchtime_thirtyone_past_is_een_over_half', spokenTime(3, 31), 'een over half vier');
  is('test_dutchtime_fortyfour_past_is_veertien_over_half', spokenTime(3, 44), 'veertien over half vier');
  is('test_dutchtime_twenty_past_twelve_is_voor_half_een', spokenTime(12, 20), 'tien voor half een');
  is('test_dutchtime_twentyfive_to_one_is_over_half_een', spokenTime(0, 35), 'vijf over half een');

  // plain over and voor, either side of the hour
  is('test_dutchtime_five_past_is_vijf_over', spokenTime(3, 5), 'vijf over drie');
  is('test_dutchtime_one_past_is_een_over', spokenTime(3, 1), 'een over drie');
  is('test_dutchtime_ten_past_is_tien_over', spokenTime(3, 10), 'tien over drie');
  is('test_dutchtime_fourteen_past_is_veertien_over', spokenTime(3, 14), 'veertien over drie');
  is('test_dutchtime_ten_to_is_tien_voor_the_next_hour', spokenTime(3, 50), 'tien voor vier');
  is('test_dutchtime_one_to_is_een_voor_the_next_hour', spokenTime(3, 59), 'een voor vier');
  is('test_dutchtime_ten_to_twelve_is_voor_twaalf', spokenTime(11, 50), 'tien voor twaalf');
  is('test_dutchtime_five_to_one_wraps_to_een', spokenTime(12, 55), 'vijf voor een');
  is('test_dutchtime_five_past_midnight_is_over_twaalf', spokenTime(0, 5), 'vijf over twaalf');
  is('test_dutchtime_hour_thirteen_names_the_face_hour', hourNameNl(13), 'een');
  // a time that ran over the end of the hour is wrapped, not printed as 3:65
  is('test_dutchtime_minutes_past_sixty_roll_into_the_next_hour', spokenTime(3, 65), 'vijf over vier');

  group('Klokkijken — the same clock in English');
  is('test_entime_whole_hour_says_oclock', spokenTimeEn(3, 0), "three o'clock");
  is('test_entime_half_past_stays_on_this_hour', spokenTimeEn(3, 30), 'half past three');
  is('test_entime_quarter_past', spokenTimeEn(3, 15), 'quarter past three');
  is('test_entime_quarter_to_counts_to_the_next_hour', spokenTimeEn(3, 45), 'quarter to four');
  is('test_entime_twenty_past', spokenTimeEn(3, 20), 'twenty past three');
  is('test_entime_twenty_to', spokenTimeEn(3, 40), 'twenty to four');
  is('test_entime_odd_minute_says_minutes', spokenTimeEn(3, 7), 'seven minutes past three');
  is('test_entime_one_minute_is_singular', spokenTimeEn(3, 1), 'one minute past three');
  is('test_entime_odd_minute_to_says_minutes', spokenTimeEn(3, 52), 'eight minutes to four');
  is('test_entime_noon_is_twelve_oclock', spokenTimeEn(12, 0), "twelve o'clock");
  is('test_entime_afternoon_uses_the_face_hour', spokenTimeEn(15, 20), 'twenty past three');

  group('Klokkijken — figures, hands and arithmetic');
  is('test_digital_twentyfour_hour_pads_both_halves', digitalLabel(9, 5, true), '09:05');
  is('test_digital_twelve_hour_drops_the_leading_zero', digitalLabel(9, 5, false), '9:05');
  is('test_digital_afternoon_on_a_twelve_hour_clock', digitalLabel(15, 40, false), '3:40');
  is('test_digital_midnight_on_a_twelve_hour_clock_is_twelve', digitalLabel(0, 30, false), '12:30');
  // the whole point of the face: the hour hand is between the numbers as the minutes pass
  is('test_hands_hour_hand_sits_on_the_numeral_on_the_hour',
    handAngles(3, 0).hour, Math.PI / 2);
  is('test_hands_hour_hand_is_halfway_to_the_next_numeral_at_half_past',
    Math.round(handAngles(3, 30).hour * 1e6) / 1e6, Math.round((Math.PI / 2 + Math.PI / 12) * 1e6) / 1e6);
  is('test_hands_minute_hand_points_straight_up_on_the_hour', handAngles(3, 0).minute, 0);
  is('test_hands_minute_hand_points_straight_down_at_half_past',
    Math.round(handAngles(3, 30).minute * 1e6) / 1e6, Math.round(Math.PI * 1e6) / 1e6);
  is('test_hands_afternoon_hour_lands_on_the_same_angle_as_the_morning',
    handAngles(15, 20).hour, handAngles(3, 20).hour);
  is('test_angle_to_minute_snaps_to_five', minuteFromAngle(Math.PI / 2 + 0.05, 5), 15);
  is('test_angle_to_minute_snaps_to_one', minuteFromAngle((Math.PI * 2 * 17) / 60, 1), 17);
  is('test_angle_to_minute_wraps_at_the_top', minuteFromAngle(Math.PI * 2 - 0.001, 5), 0);
  is('test_angle_to_hour_between_two_numerals_reads_the_lower',
    hourFromAngle(handAngles(3, 30).hour), 3);
  is('test_minutes_between_counts_forwards_over_the_hour', minutesBetween(14, 20, 14, 45), 25);
  is('test_minutes_between_counts_forwards_over_midnight', minutesBetween(23, 50, 0, 10), 20);
  is('test_plus_minutes_crosses_the_hour', plusMinutes(14, 50, 25), { h: 15, m: 15 });
  is('test_plus_minutes_crosses_midnight', plusMinutes(23, 45, 30), { h: 0, m: 15 });
  is('test_daypart_after_midday_is_smiddags', dayPartNl(13), "'s middags");
  is('test_daypart_before_six_is_snachts', dayPartNl(5), "'s nachts");
  is('test_duration_label_an_hour_is_said_as_an_hour', durationLabel(60, true), 'een uur');
  is('test_duration_label_minutes_stay_minutes', durationLabel(25, true), '25 minuten');
}

// ---------------------------------------------------------------- Klokkijken: the ladder and its traps

{
  const { LEVELS, distractors, makeQuestion, isRight, starsFor, rngFor } =
    await bundle('src/games/clock/model.ts', 'clockmodel.mjs');
  const level = id => LEVELS.find(l => l.id === id);

  group('Klokkijken — the ladder of levels');
  is('test_ladder_opens_on_whole_hours_only', level('hours').steps, [0]);
  is('test_ladder_second_level_adds_the_half_hour', level('half').steps, [0, 30]);
  is('test_ladder_snap_gets_finer_only_at_single_minutes',
    LEVELS.map(l => l.snap), [5, 5, 5, 5, 5, 1, 5, 5, 5]);
  is('test_ladder_every_level_has_both_languages',
    LEVELS.every(l => l.name && l.nameNl && l.hint && l.hintNl), true);
  is('test_ladder_covers_all_four_question_kinds',
    [...new Set(LEVELS.flatMap(l => l.kinds))].sort(), ['elapsed', 'match', 'read', 'set']);
  is('test_ladder_only_the_last_two_levels_use_the_whole_day',
    LEVELS.filter(l => l.h24).map(l => l.id), ['day', 'later']);

  group('Klokkijken — the wrong answers are the mistakes children make');
  const rng = rngFor(level('half'), 1);
  // half past three is "half vier", so four o'clock-thirty must be on offer
  is('test_distractors_half_past_offers_the_next_hour',
    distractors({ h: 3, m: 30 }, level('half'), rng).some(d => d.h === 4 && d.m === 30), true);
  // a quarter-to question must offer the quarter-past that a child mixes it up with
  is('test_distractors_quarter_to_offers_quarter_past',
    distractors({ h: 3, m: 45 }, level('quarters'), rngFor(level('quarters'), 1))
      .some(d => d.h === 3 && d.m === 15), true);
  // on a whole-hours level nothing but whole hours may be offered
  is('test_distractors_whole_hours_level_offers_only_whole_hours',
    distractors({ h: 3, m: 0 }, level('hours'), rngFor(level('hours'), 1)).every(d => d.m === 0), true);
  is('test_distractors_twelve_hour_level_never_offers_an_afternoon',
    distractors({ h: 3, m: 30 }, level('half'), rngFor(level('half'), 2)).every(d => d.h >= 1 && d.h <= 12), true);
  // the twenty-four hour level must offer the same hands read as the other half of the day
  is('test_distractors_day_level_offers_the_other_half_of_the_day',
    distractors({ h: 15, m: 40 }, level('day'), rngFor(level('day'), 1)).some(d => d.h === 3 && d.m === 40), true);
  is('test_distractors_never_include_the_answer',
    distractors({ h: 7, m: 15 }, level('fives'), rngFor(level('fives'), 3))
      .every(d => !(d.h === 7 && d.m === 15)), true);
  is('test_distractors_are_all_different',
    (() => { const d = distractors({ h: 7, m: 15 }, level('fives'), rngFor(level('fives'), 3));
      return new Set(d.map(x => `${x.h}:${x.m}`)).size === d.length; })(), true);

  group('Klokkijken — the questions a level asks');
  // every level, every round: one right answer, present exactly once, and enough to choose between
  const wellFormed = LEVELS.every(l => {
    const r = rngFor(l, 1);
    for (let i = 0; i < l.rounds; i++) {
      const q = makeQuestion(l, r, i);
      if (q.kind === 'set') { if (!q.start || isRight(q, q.start)) return false; continue; }
      if (q.options.length < 2) return false;
      if (q.answer < 0) return false;
      if (q.options.filter(o => o.h === q.t.h && o.m === q.t.m).length !== 1) return false;
      if (!isRight(q, q.options[q.answer])) return false;
      if (!l.steps.includes(q.t.m)) return false;
    }
    return true;
  });
  is('test_questions_every_level_asks_well_formed_questions', wellFormed, true);
  const elapsed = makeQuestion(level('later'), rngFor(level('later'), 1), 0);
  is('test_questions_elapsed_answer_is_the_start_plus_the_wait',
    (elapsed.from.h * 60 + elapsed.from.m + elapsed.plus) % 1440, elapsed.t.h * 60 + elapsed.t.m);
  is('test_questions_setting_the_clock_only_cares_about_the_face',
    isRight({ kind: 'set', t: { h: 15, m: 40 }, options: [], answer: 0 }, { h: 3, m: 40 }), true);
  is('test_questions_setting_the_clock_rejects_the_wrong_minutes',
    isRight({ kind: 'set', t: { h: 3, m: 40 }, options: [], answer: 0 }, { h: 3, m: 35 }), false);
  // a level that asks half past nine three times in seven rounds feels broken, even though it is
  // only chance, so the last few times asked are passed back in and rolled again
  const noRepeats = LEVELS.every(l => {
    const r = rngFor(l, 5);
    const recent = [];
    for (let i = 0; i < l.rounds; i++) {
      const q = makeQuestion(l, r, i, recent);
      const asked = q.kind === 'elapsed' ? q.from : q.t;
      if (recent.some(a => a.h === asked.h && a.m === asked.m)) return false;
      recent.push(asked);
      if (recent.length > 4) recent.shift();
    }
    return true;
  });
  is('test_questions_a_level_never_asks_the_same_time_twice_running', noRepeats, true);

  group('Klokkijken — stars for what was read first time');
  is('test_stars_all_read_first_time_is_three', starsFor(8, 8), 3);
  is('test_stars_three_quarters_first_time_is_two', starsFor(6, 8), 2);
  is('test_stars_half_first_time_is_one', starsFor(4, 8), 1);
  is('test_stars_less_than_half_is_none', starsFor(3, 8), 0);
  is('test_stars_no_rounds_is_none', starsFor(0, 0), 0);
}

// ---------------------------------------------------------------- Dierenboek: finding it, and how big it is

{
  const { fold, search, scaleBar, sizeLabel, compareToChild, facts, shelf, joinNames, GROUPS } =
    await bundle('src/games/animals/rules.ts', 'animalrules.mjs');

  const animal = (over) => ({
    i: 1, n: '', e: '', s: '', g: 'mam', f: '', fe: '', fs: '', p: '', c: '', l: '',
    w: [], h: '', t: '', z: 0, x: 0, r: '', o: 0, ...over,
  });
  const leeuw = animal({ i: 1, n: 'Leeuw', e: 'Lion', s: 'Panthera leo', f: 'Katachtigen', fe: 'Cats', g: 'mam', z: 200, x: 1, t: 'meat', h: 'grass', w: ['af'], o: 900 });
  const zeehond = animal({ i: 2, n: 'Gewone zeehond', e: 'Harbour seal', s: 'Phoca vitulina', g: 'mam', z: 160, o: 800 });
  const zeester = animal({ i: 3, n: 'Zeester', e: 'Common starfish', s: 'Asterias rubens', g: 'sea', z: 25, o: 700 });
  const lieveheer = animal({ i: 4, n: 'Lieveheersbeestje', e: 'Seven-spot ladybird', s: 'Coccinella septempunctata', g: 'ins', z: 0.7, o: 600 });
  const blauwevinvis = animal({ i: 5, n: 'Blauwe vinvis', e: 'Blue whale', s: 'Balaenoptera musculus', g: 'mam', z: 2500, o: 100 });
  const book = [leeuw, zeehond, zeester, lieveheer, blauwevinvis];

  group('Dierenboek — a child typing');
  is('test_fold_drops_accents_and_capitals', fold('Amfibieën'), 'amfibieen');
  is('test_fold_drops_punctuation_and_double_spaces', fold("Sint-Jacobs  vlinder"), 'sint jacobs vlinder');
  is('test_search_empty_query_finds_nothing', search(book, '').length, 0);
  is('test_search_three_letters_find_the_dutch_name', search(book, 'leeu').map(a => a.s), ['Panthera leo']);
  is('test_search_finds_the_english_name_too', search(book, 'lion').map(a => a.s), ['Panthera leo']);
  is('test_search_finds_the_scientific_name_too', search(book, 'panthera').map(a => a.s), ['Panthera leo']);
  is('test_search_ignores_case_and_accents', search(book, 'LEEUW').map(a => a.s), ['Panthera leo']);
  is('test_search_a_prefix_beats_a_hit_inside_a_word', search(book, 'zee').map(a => a.n), ['Zeester', 'Gewone zeehond']);
  is('test_search_unknown_letters_find_nothing', search(book, 'qqq').length, 0);
  is('test_search_stops_at_the_limit', search(book, 'e', 2).length, 2);

  group('Dierenboek — the animal beside a child');
  const lion = scaleBar(200, 120, 100);
  is('test_scale_the_larger_one_fills_the_box', Math.round(lion.animalPx), 100);
  is('test_scale_both_share_one_ruler', Math.round(lion.childPx), 60);
  is('test_scale_a_big_animal_is_not_magnified', lion.magnified, false);
  const kid = scaleBar(60, 120, 100);
  is('test_scale_a_small_animal_leaves_the_child_filling_the_box', Math.round(kid.childPx), 100);
  is('test_scale_a_small_animal_is_drawn_half_the_child', Math.round(kid.animalPx), 50);
  const bug = scaleBar(0.7, 120, 100);
  is('test_scale_a_tiny_animal_is_magnified_to_stay_visible', bug.magnified, true);
  is('test_scale_a_magnified_animal_says_how_much_bigger', bug.times > 1, true);
  is('test_scale_a_magnified_animal_is_never_smaller_than_the_floor', bug.animalPx >= 6, true);
  const whale = scaleBar(2500, 120, 200);
  is('test_scale_a_whale_squeezes_the_child_to_a_sliver', Math.round(whale.childPx), 10);
  // the animal is measured along its length and the child up her height, and a phone has far more
  // width than height to spare, so each gets its own limit
  const wide = scaleBar(300, 120, 240, 90);
  is('test_scale_a_wide_box_lets_a_long_animal_use_it', Math.round(wide.animalPx), 225);
  is('test_scale_the_child_still_fits_her_own_limit', Math.round(wide.childPx), 90);
  const tall = scaleBar(60, 120, 240, 90);
  is('test_scale_a_small_animal_never_pushes_the_child_past_her_limit', Math.round(tall.childPx), 90);
  is('test_scale_one_ruler_holds_across_both_limits', Math.round(tall.animalPx), 45);

  group('Dierenboek — saying how long something is');
  is('test_size_label_under_a_centimetre_is_millimetres', sizeLabel(0.7, true), '7 mm');
  is('test_size_label_a_few_centimetres_keeps_one_decimal', sizeLabel(4.5, false), '4.5 cm');
  is('test_size_label_dutch_uses_a_comma', sizeLabel(4.5, true), '4,5 cm');
  is('test_size_label_tens_of_centimetres_are_whole', sizeLabel(25.4, true), '25 cm');
  is('test_size_label_a_metre_or_more_is_metres', sizeLabel(200, false), '2 m');
  is('test_size_label_a_whale_is_whole_metres', sizeLabel(2500, true), '25 m');
  is('test_size_label_no_number_says_so', sizeLabel(0, true), 'onbekend');

  group('Dierenboek — how big is that, really');
  is('test_compare_the_same_size_says_so', compareToChild(125, 120, true), 'Ongeveer even groot als jij.');
  is('test_compare_twice_as_long_counts_in_children', compareToChild(240, 120, true), 'Ongeveer 2 keer zo lang als jij groot bent.');
  is('test_compare_half_again_as_long_keeps_the_half', compareToChild(200, 120, true), 'Ongeveer 1,7 keer zo lang als jij groot bent.');
  is('test_compare_a_whale_rounds_to_whole_children', compareToChild(2500, 120, false), 'About 21 times as long as you are tall.');
  is('test_compare_much_smaller_counts_the_other_way', compareToChild(24, 120, true), 'Er passen er ongeveer 5 naast elkaar over jouw lengte.');
  is('test_compare_no_size_admits_it', compareToChild(0, 120, true), 'We weten niet hoe groot hij wordt.');

  group('Dierenboek — the sentences the book writes itself');
  const said = facts(leeuw, true, 120);
  is('test_facts_name_the_family', said[0], 'Hoort bij de familie van de katachtigen.');
  is('test_facts_say_where_and_on_which_continent', said[1], 'Leeft in grasland en open veld, in Afrika.');
  is('test_facts_say_what_it_eats', said[2], 'Eet vooral vlees.');
  is('test_facts_end_with_the_size', said[3], 'Ongeveer 1,7 keer zo lang als jij groot bent.');
  is('test_facts_leave_out_what_is_not_known', facts(zeehond, true, 120).length, 1);
  is('test_facts_are_english_in_english', facts(leeuw, false, 120)[2], 'Eats mostly meat.');
  is('test_join_names_two_are_joined_with_and', joinNames(['Europa', 'Azië'], true), 'Europa en Azië');
  is('test_join_names_three_take_commas_then_and', joinNames(['a', 'b', 'c'], false), 'a, b and c');

  group('Dierenboek — the shelves');
  is('test_shelf_holds_only_its_own_group', shelf(book, 'mam').map(a => a.i), [1, 2, 5]);
  is('test_shelf_of_an_empty_group_is_empty', shelf(book, 'amp').length, 0);
  is('test_shelves_cover_every_group_in_the_book',
    book.every(a => GROUPS.some(g => g.id === a.g)), true);
  is('test_shelves_have_no_duplicate_ids', new Set(GROUPS.map(g => g.id)).size, GROUPS.length);
}

rmSync(out, { recursive: true, force: true });
console.log(`\n${ran - failed}/${ran} checks passed`);
process.exit(failed ? 1 : 0);

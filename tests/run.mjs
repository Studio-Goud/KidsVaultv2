/**
 * The checks that can be run without a browser.
 *
 * Most of Suri is canvas and thumbs, and the honest way to test that is `tests/regression.md`
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
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

// ---------------------------------------------------------------- Moonshot: the three example rockets

{
  const { EXAMPLES, buildOrder } = await bundle('src/games/moonshot/examples.ts', 'examples.mjs');
  const d = await bundle('src/games/moonshot/design.ts', 'exdesign.mjs');
  group('Moonshot — rockets that explain themselves');

  is('test_examples_there_are_three', EXAMPLES.length, 3);
  is('test_examples_every_one_is_named_in_both_languages',
    EXAMPLES.every(e => e.name && e.nameNl && e.why && e.whyNl), true);

  // Every example has to survive the same rules a child's own rocket does: each part legal where
  // it stands, the whole thing in one piece, and something the launch button will accept.
  const placeable = e => {
    const built = [];
    for (const p of e.parts) { if (!d.canPlace(built, p)) return false; built.push(p); }
    return true;
  };
  is('test_examples_every_part_is_legally_placed', EXAMPLES.every(placeable), true);
  is('test_examples_every_one_is_a_single_piece', EXAMPLES.every(e => d.isOnePiece(e.parts)), true);
  is('test_examples_every_one_will_fly', EXAMPLES.every(e => d.isFlyable(e.parts)), true);
  is('test_examples_none_has_anything_wrong_with_it',
    EXAMPLES.every(e => d.buildProblem(e.parts, false) === null), true);
  is('test_examples_every_one_lifts_off_the_pad', EXAMPLES.every(e => d.canLift(e.parts)), true);

  // and they have to be three different lessons, not three sizes of the same one
  const tops = EXAMPLES.map(e => d.forecast(e.parts).topKm);
  is('test_examples_every_one_actually_leaves_the_ground',
    EXAMPLES.every(e => !d.forecast(e.parts).stuck), true);
  is('test_examples_the_little_one_still_gets_past_the_air', tops[0] > 100, true);
  is('test_examples_dropping_a_stage_beats_carrying_it', tops[1] > tops[0] * 3, true);
  is('test_examples_the_boosters_push_hardest_off_the_pad',
    d.padThrust(EXAMPLES[2].parts) > d.padThrust(EXAMPLES[0].parts) * 3, true);

  // the order it goes on is the order a person builds one: middle column first, from the ground up
  const order = buildOrder(EXAMPLES[2]);
  is('test_build_order_starts_at_the_bottom_of_the_middle', [order[0].col, order[0].row], [4, 0]);
  is('test_build_order_never_puts_a_part_under_one_already_placed',
    order.every((p, i) => i === 0 || p.col !== order[i - 1].col || p.row > order[i - 1].row), true);
  is('test_build_order_keeps_every_part', order.length, EXAMPLES[2].parts.length);
  is('test_build_order_does_the_middle_before_the_sides',
    order.findIndex(p => p.col !== 4) > order.findLastIndex(p => p.col === 4), true);

  // each step of the build has to stand on its own, or the rocket falls over halfway through
  is('test_build_order_each_step_is_still_one_piece',
    EXAMPLES.every(e => {
      const so_far = [];
      for (const p of buildOrder(e)) { so_far.push(p); if (!d.isOnePiece(so_far)) return false; }
      return true;
    }), true);
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
  const { fold, search, scaleBar, sizeLabel, compareToChild, facts, shelf, shapeOf, joinNames, clipBox, GROUPS } =
    await bundle('src/games/animals/rules.ts', 'animalrules.mjs');

  const animal = (over) => ({
    i: 1, n: '', e: '', s: '', g: 'mam', f: '', fe: '', fs: '', p: '', c: '', l: '',
    w: [], h: '', t: '', z: 0, x: 0, r: '', o: 0, ...over,
  });
  const leeuw = animal({ i: 1, n: 'Leeuw', e: 'Lion', s: 'Panthera leo', f: 'Katachtigen', fe: 'Cats', g: 'mam', z: 200, x: 1, t: 'meat', h: 'grass', w: ['af'], o: 900 });
  const zeehond = animal({ i: 2, n: 'Gewone zeehond', e: 'Harbour seal', s: 'Phoca vitulina', g: 'mam', z: 160, o: 800 });
  const zeester = animal({ i: 3, n: 'Zeester', e: 'Common starfish', s: 'Asterias rubens', g: 'sea', z: 25, o: 700 });
  const lieveheer = animal({ i: 4, n: 'Lieveheersbeestje', e: 'Seven-spot ladybird', s: 'Coccinella septempunctata', g: 'ins', z: 0.7, o: 600 });
  const blauwevinvis = animal({ i: 5, n: 'Blauwe vinvis', e: 'Blue whale', s: 'Balaenoptera musculus', g: 'mam', h: 'sea', z: 2500, o: 100 });
  const book = [leeuw, zeehond, zeester, lieveheer, blauwevinvis];

  group('Dierenboek — what a tap can reach');
  // a search result half hidden behind the keyboard still took the tap meant for the letter A,
  // because the canvas clips the drawing and nothing clipped the hit boxes
  is('test_cliptap_a_box_well_inside_the_band_is_whole', clipBox(100, 54, 80, 400), { y: 100, h: 54 });
  is('test_cliptap_a_box_hanging_below_the_band_is_cut',
    clipBox(380, 54, 80, 400), { y: 380, h: 20 });
  is('test_cliptap_a_box_scrolled_above_the_band_is_cut',
    clipBox(60, 54, 80, 400), { y: 80, h: 34 });
  is('test_cliptap_a_box_entirely_below_the_band_is_gone', clipBox(420, 54, 80, 400), null);
  is('test_cliptap_a_box_entirely_above_the_band_is_gone', clipBox(10, 40, 80, 400), null);
  is('test_cliptap_a_sliver_too_thin_to_mean_anything_is_gone', clipBox(396, 54, 80, 400), null);
  is('test_cliptap_a_band_taller_than_the_box_keeps_it_all', clipBox(100, 54, 0, 1000), { y: 100, h: 54 });

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
  is('test_search_finds_a_two_word_name_typed_without_the_space',
    search(book, 'gewonezeehond').map(a => a.s), ['Phoca vitulina']);
  is('test_search_finds_a_two_word_name_typed_with_the_space',
    search(book, 'gewone zee').map(a => a.s), ['Phoca vitulina']);
  is('test_search_a_whole_word_match_beats_a_squashed_one',
    search(book, 'zeester')[0].n, 'Zeester');

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
  const said = facts(leeuw, true);
  is('test_facts_name_the_family', said[0], 'Hoort bij de familie van de katachtigen.');
  is('test_facts_say_where_and_on_which_continent', said[1], 'Leeft in grasland en open veld, in Afrika.');
  is('test_facts_say_what_it_eats', said[2], 'Eet vooral vlees.');
  is('test_facts_no_longer_compare_with_a_height_nobody_set', said.length, 3);
  is('test_facts_leave_out_what_is_not_known', facts(zeehond, true).length, 0);
  is('test_facts_are_english_in_english', facts(leeuw, false)[2], 'Eats mostly meat.');

  group('Dierenboek — de meetlat');
  const { rulerFor } = await bundle('src/games/animals/rules.ts', 'rules-ruler.mjs');
  const beetleR = rulerFor(0.7, 300), catR = rulerFor(46, 300), whaleR = rulerFor(2500, 300);
  is('test_ruler_is_always_longer_than_the_animal', [0.7, 12, 46, 180, 2500].every(cm => rulerFor(cm, 300).span > cm), true);
  is('test_ruler_a_beetle_is_measured_in_millimetres', beetleR.minor, 0.1);
  is('test_ruler_a_beetle_ruler_is_one_centimetre', beetleR.span, 1);
  is('test_ruler_a_cat_is_measured_in_centimetres', catR.unit, 'cm');
  is('test_ruler_a_whale_is_measured_in_metres', whaleR.unit, 'm');
  is('test_ruler_marks_never_smear_together', [0.3, 5, 46, 300, 2500].every(cm => { const r = rulerFor(cm, 300); return r.minor * 300 / r.span >= 5; }), true);
  is('test_ruler_numbers_never_touch', [0.3, 5, 46, 300, 2500].every(cm => { const r = rulerFor(cm, 300); return r.major * 300 / r.span >= 42; }), true);
  is('test_ruler_numbers_sit_on_a_mark', [0.3, 5, 46, 300, 2500].every(cm => { const r = rulerFor(cm, 300); return Math.abs(r.major / r.minor - Math.round(r.major / r.minor)) < 1e-9; }), true);
  is('test_join_names_two_are_joined_with_and', joinNames(['Europa', 'Azië'], true), 'Europa en Azië');
  is('test_join_names_three_take_commas_then_and', joinNames(['a', 'b', 'c'], false), 'a, b and c');

  group('Dierenboek — which drawn animal stands in');
  is('test_shape_a_land_mammal_gets_the_four_legged_drawing', shapeOf(leeuw), 'mam');
  is('test_shape_a_whale_is_not_drawn_as_a_deer', shapeOf(blauwevinvis), 'whale');
  is('test_shape_a_seal_gets_its_own_drawing', shapeOf(animal({ g: 'mam', h: 'coast' })), 'seal');
  is('test_shape_everything_else_falls_back_to_its_shelf', shapeOf(zeester), 'sea');

  group('Dierenboek — the shelves');
  is('test_shelf_holds_only_its_own_group', shelf(book, 'mam').map(a => a.i), [1, 2, 5]);
  is('test_shelf_of_an_empty_group_is_empty', shelf(book, 'amp').length, 0);
  is('test_shelves_cover_every_group_in_the_book',
    book.every(a => GROUPS.some(g => g.id === a.g)), true);
  is('test_shelves_have_no_duplicate_ids', new Set(GROUPS.map(g => g.id)).size, GROUPS.length);
}

// ---------------------------------------------------------------- Rekenrijk: the sums themselves

{
  const {
    LEVELS, distractors, inRule, keyOf, makeQuestion, rngFor, starsFor, stepOverTen, targetOf,
  } = await bundle('src/games/numbers/model.ts', 'numbers-model.mjs');
  const { numberWord, sumSymbols, sumWords } = await bundle('src/games/numbers/numberwords.ts', 'numberwords.mjs');
  const level = id => LEVELS.find(l => l.id === id);

  /** A whole level played through, the way the game plays it: a fresh rng and no repeats. */
  const runLevel = (l, attempts = 30) => {
    const out = [];
    for (let a = 1; a <= attempts; a++) {
      const rng = rngFor(l, a);
      const recent = [];
      for (let i = 0; i < l.rounds; i++) {
        const q = makeQuestion(l, rng, i, recent);
        recent.push(keyOf(q));
        if (recent.length > 4) recent.shift();
        out.push(q);
      }
    }
    return out;
  };
  const everyQuestion = LEVELS.flatMap(l => runLevel(l).map(q => ({ l, q })));

  group('Rekenrijk — getallen in woorden');
  is('test_numberword_zero_is_nul', numberWord(0, true), 'nul');
  is('test_numberword_the_teens_are_irregular_in_dutch', numberWord(13, true), 'dertien');
  is('test_numberword_units_come_before_tens_in_dutch', numberWord(21, true), 'eenentwintig');
  is('test_numberword_a_word_ending_in_e_takes_a_diaeresis', numberWord(22, true), 'tweeëntwintig');
  is('test_numberword_drie_takes_the_diaeresis_too', numberWord(33, true), 'drieëndertig');
  is('test_numberword_vier_does_not_take_a_diaeresis', numberWord(44, true), 'vierenveertig');
  is('test_numberword_eighty_is_tachtig_not_achttig', numberWord(80, true), 'tachtig');
  is('test_numberword_a_round_hundred_is_honderd', numberWord(100, true), 'honderd');
  is('test_numberword_the_side_by_side_mistake_is_sayable', numberWord(215, true), 'tweehonderdvijftien');
  is('test_numberword_english_hyphenates_the_twenties', numberWord(21, false), 'twenty-one');
  is('test_numberword_english_teens_are_one_word', numberWord(13, false), 'thirteen');
  is('test_numberword_english_hundred_reads_as_one_hundred', numberWord(100, false), 'one hundred');

  group('Rekenrijk — de som opgeschreven en uitgesproken');
  is('test_sumsymbols_adding_reads_left_to_right', sumSymbols('add', 8, 5, 13), '8 + 5 = 13');
  is('test_sumsymbols_splitting_puts_the_whole_first', sumSymbols('split', 7, 3, 4), '7 = 3 + 4');
  is('test_sumsymbols_taking_away_uses_a_real_minus_sign', sumSymbols('sub', 9, 3, 6), '9 − 3 = 6');
  is('test_sumsymbols_times_uses_a_real_multiplication_sign', sumSymbols('times', 4, 6, 24), '4 × 6 = 24');
  is('test_sumsymbols_a_difference_is_written_as_a_subtraction', sumSymbols('diff', 23, 30, 7), '30 − 23 = 7');
  is('test_sumwords_adding_is_said_with_plus', sumWords('add', 8, 5, 13, true), 'acht plus vijf is dertien');
  is('test_sumwords_splitting_is_said_with_en', sumWords('split', 7, 3, 4, true), 'zeven is drie en vier');
  is('test_sumwords_times_is_said_with_keer', sumWords('times', 4, 6, 24, true), 'vier keer zes is vierentwintig');
  is('test_sumwords_a_difference_is_said_as_a_walk', sumWords('diff', 23, 30, 7, true),
    'van drieëntwintig naar dertig is zeven erbij');
  is('test_sumwords_english_takes_away_rather_than_minus', sumWords('sub', 9, 3, 6, false), 'nine take away three is six');

  group('Rekenrijk — de stap over het tiental');
  is('test_step_eight_plus_five_fills_the_ten_with_two', stepOverTen(8, 5), { to: 10, first: 2, rest: 3 });
  is('test_step_twentyseven_plus_eight_jumps_to_thirty_first', stepOverTen(27, 8), { to: 30, first: 3, rest: 5 });
  is('test_step_nine_plus_nine_needs_only_one_to_reach_ten', stepOverTen(9, 9), { to: 10, first: 1, rest: 8 });
  is('test_step_fortyfive_plus_seven_jumps_to_fifty_first', stepOverTen(45, 7), { to: 50, first: 5, rest: 2 });
  is('test_step_the_two_halves_always_add_back_to_b',
    [[8, 5], [27, 8], [45, 7], [19, 6]].every(([a, b]) => {
      const s = stepOverTen(a, b);
      return s.first + s.rest === b && s.to === a + s.first;
    }), true);

  group('Rekenrijk — elke som blijft binnen de regel van zijn eigen niveau');
  for (const l of LEVELS) {
    is(`test_generator_${l.id}_only_ever_makes_sums_inside_its_rule`,
      runLevel(l).every(q => inRule(l, q)), true);
  }
  is('test_generator_every_answer_is_arithmetically_right', everyQuestion.every(({ q }) => {
    if (q.op === 'split' || q.op === 'sub') return q.answer === q.a - q.b;
    if (q.op === 'diff') return q.answer === q.b - q.a;
    if (q.op === 'times') return q.answer === q.a * q.b;
    return q.answer === q.a + q.b;
  }), true);
  // "Rekenrijk begint me iets te moeilijk": the first rung has to be one a five-year-old can stand on
  is('test_ladder_starts_with_adding_to_five', LEVELS[0].id, 'tot5');
  is('test_generator_adding_to_five_never_passes_five',
    runLevel(level('tot5')).every(q => q.a + q.b <= 5 && q.a >= 1 && q.b >= 1), true);
  is('test_generator_adding_to_five_opens_on_sums_you_can_see_at_a_glance',
    runLevel(level('tot5')).filter((_, i) => i % level('tot5').rounds < 3).every(q => q.answer <= 3), true);
  is('test_generator_splitting_opens_on_a_whole_of_five_or_less',
    runLevel(level('splitsen')).filter((_, i) => i % level('splitsen').rounds < 3).every(q => q.a <= 5), true);
  is('test_generator_splitting_still_reaches_ten',
    runLevel(level('splitsen')).some(q => q.a === 10), true);
  is('test_generator_adding_to_ten_never_passes_ten',
    runLevel(level('erbij')).every(q => q.a + q.b <= 10 && q.a >= 1 && q.b >= 1), true);
  is('test_generator_taking_away_never_goes_below_one',
    runLevel(level('eraf')).every(q => q.answer >= 1 && q.answer < q.a), true);
  is('test_generator_splitting_never_offers_a_part_of_nothing',
    runLevel(level('splitsen')).every(q => q.b >= 1 && q.answer >= 1), true);
  is('test_generator_filling_the_ten_always_crosses_the_ten',
    runLevel(level('tienvol')).every(q => q.a + q.b > 10 && q.a < 10), true);
  is('test_generator_filling_the_ten_always_carries_the_right_step',
    runLevel(level('tienvol')).every(q => q.step.to === 10 && q.step.first === 10 - q.a && q.step.rest === q.b - q.step.first), true);
  is('test_generator_tens_and_ones_never_crosses_a_ten',
    runLevel(level('tientallen')).every(q => (q.a % 10) + (q.b % 10) <= 9), true);
  is('test_generator_tens_and_ones_stays_under_a_hundred',
    runLevel(level('tientallen')).every(q => q.answer <= 99), true);
  is('test_generator_over_the_ten_always_actually_crosses_one',
    runLevel(level('overtiental')).every(q => (q.a % 10) + q.b > 10), true);
  is('test_generator_over_the_ten_carries_the_jump_to_the_next_ten',
    runLevel(level('overtiental')).every(q => q.step.to === (Math.floor(q.a / 10) + 1) * 10
      && q.step.first >= 1 && q.step.rest >= 1 && q.step.first + q.step.rest === q.b), true);
  is('test_generator_a_difference_always_runs_forwards',
    runLevel(level('verschil')).every(q => q.b > q.a && q.answer >= 2 && q.answer <= 30), true);
  is('test_generator_a_difference_is_short_enough_to_walk',
    runLevel(level('verschil')).every(q => q.answer <= 12), true);
  is('test_generator_a_difference_that_stays_inside_its_ten_really_does',
    runLevel(level('verschil')).filter(q => Math.floor(q.a / 10) === Math.floor(q.b / 10))
      .every(q => (q.a % 10) + q.answer <= 9), true);
  is('test_generator_the_easy_tables_are_only_one_two_five_and_ten',
    [...new Set(runLevel(level('keer')).map(q => q.b))].sort((x, y) => x - y), [1, 2, 5, 10]);
  is('test_generator_the_hard_tables_leave_out_the_easy_ones',
    [...new Set(runLevel(level('tafels')).map(q => q.b))].sort((x, y) => x - y), [3, 4, 6, 7, 8, 9]);
  is('test_generator_a_table_never_goes_past_ten_rows',
    runLevel(level('tafels')).every(q => q.a >= 2 && q.a <= 10), true);
  is('test_generator_every_number_line_holds_the_whole_sum',
    everyQuestion.filter(({ q }) => q.line).every(({ q }) => q.line.lo <= q.a && q.answer <= q.line.hi), true);

  group('Rekenrijk — de afleiders zijn de fouten die kinderen echt maken');
  is('test_options_hold_the_answer_exactly_once',
    everyQuestion.every(({ q }) => q.options.filter(o => o === q.answer).length === 1), true);
  is('test_options_point_at_the_answer_they_hold',
    everyQuestion.every(({ q }) => q.options[q.correct] === q.answer), true);
  is('test_options_never_repeat_a_number',
    everyQuestion.every(({ q }) => new Set(q.options).size === q.options.length), true);
  is('test_options_are_never_negative',
    everyQuestion.every(({ q }) => q.options.every(o => o >= 0)), true);
  is('test_options_are_always_as_many_as_the_level_asks_for',
    everyQuestion.every(({ l, q }) => q.options.length === l.options), true);
  is('test_options_the_way_in_never_offers_more_than_three', level('tot5').options, 3);
  is('test_options_never_offer_the_answer_twice_under_another_name',
    everyQuestion.every(({ q }) => q.options.filter(o => o === q.answer).length === 1), true);

  const rng = rngFor(level('overtiental'), 3);
  const cross = { op: 'cross', stage: 'line', a: 27, b: 8, answer: 35, step: stepOverTen(27, 8), line: { lo: 20, hi: 40 } };
  const crossWrong = distractors(cross, rng);
  is('test_distractor_over_the_ten_offers_the_dropped_carry', crossWrong.includes(25), true);
  is('test_distractor_over_the_ten_offers_the_digits_side_by_side', crossWrong.includes(215), true);
  is('test_distractor_over_the_ten_never_offers_the_answer', crossWrong.includes(35), false);
  is('test_distractor_over_the_ten_puts_the_carry_mistake_first', crossWrong[0], 25);

  const bridge = { op: 'bridge', stage: 'frame', a: 8, b: 5, answer: 13, step: stepOverTen(8, 5), line: { lo: 0, hi: 20 } };
  const bridgeWrong = distractors(bridge, rngFor(level('tienvol'), 2));
  is('test_distractor_filling_the_ten_offers_stopping_at_the_ten', bridgeWrong[0], 10);
  is('test_distractor_filling_the_ten_offers_the_ten_dropped', bridgeWrong.includes(3), true);
  is('test_distractor_filling_the_ten_never_offers_the_answer', bridgeWrong.includes(13), false);

  const table = { op: 'times', stage: 'array', a: 6, b: 7, answer: 42, step: null, line: null };
  const tableWrong = distractors(table, rngFor(level('tafels'), 2));
  is('test_distractor_a_table_fact_offers_the_row_below', tableWrong.includes(35), true);
  is('test_distractor_a_table_fact_offers_the_row_above', tableWrong.includes(49), true);
  is('test_distractor_a_table_fact_offers_the_table_next_door', tableWrong.includes(36), true);
  is('test_distractor_a_table_fact_never_offers_the_answer', tableWrong.includes(42), false);
  is('test_distractor_a_table_fact_never_offers_nought',
    distractors({ op: 'times', stage: 'array', a: 10, b: 1, answer: 10, step: null, line: null },
      rngFor(level('keer'), 4)).includes(0), false);
  is('test_distractor_every_times_option_is_a_real_count', LEVELS.filter(l => l.op === 'times')
    .every(l => runLevel(l).every(q => q.options.every(o => o > 0))), true);

  const splitQ = { op: 'split', stage: 'rack', a: 7, b: 3, answer: 4, step: null, line: null };
  const splitWrong = distractors(splitQ, rngFor(level('splitsen'), 2));
  is('test_distractor_splitting_offers_the_whole_left_alone', splitWrong.includes(7), true);
  is('test_distractor_splitting_offers_the_part_read_back', splitWrong.includes(3), true);

  const addQ = { op: 'add', stage: 'crates', a: 3, b: 4, answer: 7, step: null, line: null };
  is('test_distractor_adding_offers_the_difference_instead',
    distractors(addQ, rngFor(level('erbij'), 2)).includes(1), true);
  const diffQ = { op: 'diff', stage: 'line', a: 23, b: 30, answer: 7, step: null, line: { lo: 20, hi: 40 } };
  is('test_distractor_a_difference_offers_the_units_taken_alone',
    distractors(diffQ, rngFor(level('verschil'), 2)).includes(3), true);
  is('test_distractor_a_difference_offers_the_fencepost_mistake',
    distractors(diffQ, rngFor(level('verschil'), 2)).includes(8), true);

  group('Rekenrijk — herhaling, sterren en wat er verschoven moet worden');
  is('test_rounds_never_ask_the_same_sum_twice_in_a_row', LEVELS.every(l => {
    for (let a = 1; a <= 40; a++) {
      const r = rngFor(l, a);
      const recent = [];
      let last = null;
      for (let i = 0; i < l.rounds; i++) {
        const q = makeQuestion(l, r, i, recent);
        if (last != null && keyOf(q) === last) return false;
        last = keyOf(q);
        recent.push(last);
        if (recent.length > 4) recent.shift();
      }
    }
    return true;
  }), true);
  is('test_stars_everything_first_time_earns_three', starsFor(8, 8), 3);
  is('test_stars_most_of_it_first_time_earns_two', starsFor(6, 8), 2);
  is('test_stars_half_of_it_earns_one', starsFor(4, 8), 1);
  is('test_stars_a_level_that_was_shown_every_time_earns_none', starsFor(2, 8), 0);
  is('test_stars_an_empty_level_earns_none', starsFor(0, 0), 0);
  is('test_target_a_rack_must_be_split_where_the_question_says', targetOf(splitQ), 3);
  is('test_target_a_ten_frame_must_be_filled_to_ten', targetOf(bridge), 2);
  is('test_target_a_number_line_must_reach_the_next_ten', targetOf(cross), 30);
  is('test_target_an_array_must_hold_the_whole_product', targetOf(table), 42);
  is('test_target_taking_away_must_move_every_apple_asked_for',
    targetOf({ op: 'sub', stage: 'crates', a: 9, b: 3, answer: 6, step: null, line: null }), 3);
}

// ---------------------------------------------------------------- Klankhuis: the music itself

{
  const m = await bundle('src/games/rhythm/music.ts', 'rhythmmusic.mjs');
  const {
    noteFreq, midiOf, freqOfMidi, nameOfMidi, letterOfMidi, colourIndexOfMidi,
    noteSeconds, beatSeconds, valueOfBeats, VALUE_BEATS,
    barBeats, beatsPerBar, beatInBar,
    tapGrade, tapTightness, tapSide, TAP_WINDOWS,
    CHIME_MIDI, CHIME_LOW, CHIME_HIGH, chimeIndexOf,
    TUNES, tuneBeats, tuneInRange, tuneFillsBars, tuneEvents, tuneById,
    SEQ_STEPS, SEQ_PITCHES, emptyGrid, encodeGrid, decodeGrid, sanitiseSteps, gridNoteCount, stepNotes,
  } = m;

  /** to five decimals, because a frequency is never going to be exactly anything */
  const hz = f => Math.round(f * 100000) / 100000;

  group('Klankhuis — a note name is a frequency');
  is('test_pitch_a4_is_the_tuning_fork', noteFreq('A4'), 440);
  is('test_pitch_a3_is_an_octave_below_a4', noteFreq('A3'), 220);
  is('test_pitch_a5_is_an_octave_above_a4', noteFreq('A5'), 880);
  is('test_pitch_middle_c_is_two_six_one_point_six', Math.round(noteFreq('C4') * 100) / 100, 261.63);
  is('test_pitch_one_semitone_is_the_twelfth_root_of_two',
    hz(noteFreq('A#4') / noteFreq('A4')), hz(Math.pow(2, 1 / 12)));
  is('test_pitch_twelve_semitones_make_exactly_an_octave', hz(freqOfMidi(81) / freqOfMidi(69)), 2);
  is('test_pitch_a_flat_and_its_sharp_are_the_same_note', noteFreq('Bb3'), noteFreq('A#3'));
  is('test_midi_middle_c_is_sixty', midiOf('C4'), 60);
  is('test_midi_a4_is_sixty_nine', midiOf('A4'), 69);
  is('test_midi_the_name_comes_back_out_again', nameOfMidi(midiOf('F#5')), 'F#5');
  is('test_midi_a_bad_name_is_refused', (() => { try { midiOf('H4'); return 'no'; } catch { return 'threw'; } })(), 'threw');
  is('test_letter_drops_the_octave', letterOfMidi(67), 'G');
  is('test_colour_index_is_the_same_for_both_cs', colourIndexOfMidi(60), colourIndexOfMidi(72));
  is('test_colour_index_of_c_is_the_first_colour', colourIndexOfMidi(60), 0);
  is('test_colour_index_of_b_is_the_last_colour', colourIndexOfMidi(71), 6);

  group('Klankhuis — how long a note lasts against a tempo');
  is('test_duration_a_beat_at_sixty_is_a_second', beatSeconds(60), 1);
  is('test_duration_a_quarter_at_one_twenty_is_half_a_second', noteSeconds('quarter', 120), 0.5);
  is('test_duration_a_half_at_sixty_lasts_two_seconds', noteSeconds('half', 60), 2);
  is('test_duration_an_eighth_is_half_a_quarter',
    noteSeconds('eighth', 90) * 2, noteSeconds('quarter', 90));
  is('test_duration_a_whole_note_is_four_beats', VALUE_BEATS.whole, 4);
  is('test_duration_a_dotted_half_is_half_again', VALUE_BEATS.dottedHalf, 3);
  is('test_duration_twice_the_tempo_is_half_the_time',
    noteSeconds('quarter', 180) * 3, noteSeconds('quarter', 60));
  is('test_duration_three_beats_is_written_as_a_dotted_half', valueOfBeats(3), 'dottedHalf');
  is('test_duration_a_length_with_no_name_says_so', valueOfBeats(1.75), null);

  group('Klankhuis — the beats of a bar');
  is('test_bar_two_four_has_two_beats', beatsPerBar('2/4'), 2);
  is('test_bar_three_four_has_three_beats', beatsPerBar('3/4'), 3);
  is('test_bar_four_four_has_four_beats', beatsPerBar('4/4'), 4);
  is('test_bar_two_four_leans_on_the_one',
    barBeats('2/4').map(b => b.stress), ['strong', 'weak']);
  is('test_bar_a_waltz_leans_only_on_the_one',
    barBeats('3/4').map(b => b.stress), ['strong', 'weak', 'weak']);
  is('test_bar_four_four_has_a_second_lighter_stress_on_the_three',
    barBeats('4/4').map(b => b.stress), ['strong', 'weak', 'medium', 'weak']);
  is('test_bar_beats_are_numbered_from_one', barBeats('4/4').map(b => b.n), [1, 2, 3, 4]);
  is('test_bar_the_count_starts_again_after_four', beatInBar(4, '4/4'), 1);
  is('test_bar_the_count_starts_again_after_three', beatInBar(3, '3/4'), 1);
  is('test_bar_the_sixth_beat_of_four_four_is_a_two', beatInBar(5, '4/4'), 2);

  group('Klankhuis — how close a tap was');
  is('test_tap_dead_on_the_beat_is_perfect', tapGrade(0), 'perfect');
  is('test_tap_inside_sixty_milliseconds_is_perfect', tapGrade(59), 'perfect');
  is('test_tap_at_the_edge_of_the_window_is_still_perfect', tapGrade(TAP_WINDOWS.perfect), 'perfect');
  is('test_tap_a_hair_past_it_is_only_good', tapGrade(TAP_WINDOWS.perfect + 1), 'good');
  is('test_tap_early_is_judged_the_same_as_late', tapGrade(-100), tapGrade(100));
  is('test_tap_a_fifth_of_a_second_out_is_the_last_that_counts', tapGrade(TAP_WINDOWS.ok), 'ok');
  is('test_tap_past_the_window_belongs_to_no_beat', tapGrade(TAP_WINDOWS.ok + 1), 'miss');
  is('test_tap_tightness_is_one_on_the_beat', tapTightness(0), 1);
  is('test_tap_tightness_is_nothing_at_the_edge', tapTightness(TAP_WINDOWS.ok), 0);
  is('test_tap_tightness_halves_halfway_out', tapTightness(TAP_WINDOWS.ok / 2), 0.5);
  is('test_tap_side_on_the_beat_is_neither', tapSide(20), 'on');
  is('test_tap_side_behind_the_beat_is_late', tapSide(150), 'late');
  is('test_tap_side_ahead_of_the_beat_is_early', tapSide(-150), 'early');

  group('Klankhuis — the instrument');
  is('test_chimes_are_nine_bars', CHIME_MIDI.length, 9);
  is('test_chimes_run_low_to_high', CHIME_MIDI.every((m, i) => i === 0 || m > CHIME_MIDI[i - 1]), true);
  is('test_chimes_are_a_c_major_scale_from_g_to_a',
    CHIME_MIDI.map(nameOfMidi), ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4']);
  is('test_chimes_have_no_black_notes', CHIME_MIDI.every(m => !nameOfMidi(m).includes('#')), true);
  is('test_chimes_span_an_octave_and_a_step', CHIME_HIGH - CHIME_LOW, 14);
  is('test_chimes_know_where_a_pitch_sits', chimeIndexOf(60), 3);
  is('test_chimes_admit_a_pitch_they_have_not_got', chimeIndexOf(61), -1);

  group('Klankhuis — the songs');
  is('test_tunes_there_are_three_of_them', TUNES.length, 3);
  for (const t of TUNES) {
    is(`test_tune_${t.id}_fits_the_chimes_with_nothing_moved`, tuneInRange(t), true);
    is(`test_tune_${t.id}_ends_where_a_bar_ends`, tuneFillsBars(t), true);
    is(`test_tune_${t.id}_has_no_note_of_no_length`, t.notes.every(n => n.beats > 0), true);
  }
  is('test_tune_vader_jacob_is_eight_bars', tuneBeats(tuneById('jacob')), 32);
  is('test_tune_vader_jacob_opens_do_re_mi_do',
    tuneById('jacob').notes.slice(0, 4).map(n => nameOfMidi(n.midi)), ['C4', 'D4', 'E4', 'C4']);
  is('test_tune_vader_jacob_drops_to_the_sol_below_at_the_end',
    nameOfMidi(tuneById('jacob').notes[tuneById('jacob').notes.length - 2].midi), 'G3');
  is('test_tune_kortjakje_is_twelve_bars', tuneBeats(tuneById('kortjakje')), 48);
  is('test_tune_kortjakje_opens_do_do_sol_sol_la_la_sol',
    tuneById('kortjakje').notes.slice(0, 7).map(n => nameOfMidi(n.midi)),
    ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4']);
  is('test_tune_maneschijn_stays_inside_three_notes',
    new Set(tuneById('maneschijn').notes.map(n => n.midi)).size, 3);
  is('test_tune_events_start_at_beat_zero', tuneEvents(tuneById('kortjakje'))[0].beat, 0);
  is('test_tune_events_are_laid_out_from_the_start_not_added_up',
    tuneEvents(tuneById('kortjakje'))[7].beat, 8);
  is('test_tune_events_never_go_backwards',
    tuneEvents(tuneById('jacob')).every((e, i, a) => i === 0 || e.beat > a[i - 1].beat), true);
  is('test_tune_a_tempo_a_child_can_follow', TUNES.every(t => t.bpm >= 80 && t.bpm <= 110), true);

  group('Klankhuis — the sequencer, and what survives in the save');
  const blank = emptyGrid();
  is('test_grid_starts_with_eight_steps', blank.length, SEQ_STEPS);
  is('test_grid_has_a_row_per_chime', blank[0].length, SEQ_PITCHES);
  is('test_grid_starts_empty', gridNoteCount(blank), 0);
  const made = emptyGrid();
  made[0][3] = true; made[0][5] = true; made[2][7] = true; made[7][0] = true;
  is('test_grid_counts_what_was_written', gridNoteCount(made), 4);
  const saved = encodeGrid(made);
  is('test_save_a_step_is_one_number_per_step', saved.length, SEQ_STEPS);
  is('test_save_a_step_is_a_bit_per_chime', saved[0], (1 << 3) | (1 << 5));
  is('test_save_an_untouched_step_is_zero', saved[1], 0);
  is('test_save_the_grid_comes_back_exactly_as_it_went_in', encodeGrid(decodeGrid(saved)), saved);
  is('test_save_the_round_trip_keeps_every_note', gridNoteCount(decodeGrid(saved)), 4);
  is('test_save_the_round_trip_keeps_the_right_squares',
    decodeGrid(saved)[0].map(Boolean), made[0].map(Boolean));
  is('test_save_a_missing_grid_opens_empty', sanitiseSteps(undefined), [0, 0, 0, 0, 0, 0, 0, 0]);
  is('test_save_a_grid_of_the_wrong_shape_is_padded', sanitiseSteps([7, 3]), [7, 3, 0, 0, 0, 0, 0, 0]);
  is('test_save_a_grid_that_is_too_long_is_cut', sanitiseSteps([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]).length, 8);
  is('test_save_a_step_with_too_many_bits_is_clamped', sanitiseSteps([99999])[0], (1 << SEQ_PITCHES) - 1);
  is('test_save_a_negative_step_is_refused', sanitiseSteps([-4])[0], 0);
  is('test_save_a_step_that_is_not_a_number_is_refused', sanitiseSteps(['x', null, 1.7])[0], 0);
  is('test_save_a_fractional_step_is_made_whole', sanitiseSteps([1.7])[0], 1);
  is('test_save_rubbish_never_throws', sanitiseSteps({ a: 1 }), [0, 0, 0, 0, 0, 0, 0, 0]);
  is('test_step_notes_come_back_low_to_high', stepNotes(made, 0), [CHIME_MIDI[3], CHIME_MIDI[5]]);
  is('test_step_notes_of_an_empty_step_are_none', stepNotes(made, 1), []);
  is('test_step_notes_wrap_round_the_loop', stepNotes(made, SEQ_STEPS + 2), stepNotes(made, 2));
  is('test_step_notes_are_all_playable_on_the_chimes',
    stepNotes(made, 0).every(n => CHIME_MIDI.includes(n)), true);
}

// ---------------------------------------------------------------- Klankhuis: the ladder

{
  const r = await bundle('src/games/rhythm/model.ts', 'rhythmmodel.mjs');
  const { LEVELS, makeRound, rngFor, roundBeats, starsFor } = r;
  const mm = await bundle('src/games/rhythm/music.ts', 'rhythmmusic2.mjs');
  const { CHIME_MIDI, beatsPerBar } = mm;

  group('Klankhuis — the ladder');
  is('test_ladder_has_nine_levels', LEVELS.length, 9);
  is('test_ladder_every_level_has_a_dutch_name', LEVELS.every(l => l.nameNl.length > 0), true);
  is('test_ladder_every_level_has_a_hint_in_both_languages',
    LEVELS.every(l => l.hint.length > 0 && l.hintNl.length > 0), true);
  is('test_ladder_no_two_levels_share_an_id', new Set(LEVELS.map(l => l.id)).size, LEVELS.length);
  is('test_ladder_starts_with_the_pulse', LEVELS[0].id, 'pulse');
  is('test_ladder_ends_with_making_something', LEVELS[LEVELS.length - 1].kind, 'make');
  is('test_ladder_the_waltz_is_the_only_level_in_three', LEVELS.filter(l => l.sig === '3/4').map(l => l.id), ['three']);
  is('test_ladder_tempos_are_all_walkable', LEVELS.every(l => l.bpm >= 70 && l.bpm <= 120), true);

  group('Klankhuis — the rounds a level makes');
  for (const level of LEVELS) {
    if (level.kind === 'make') continue;
    const rng = rngFor(level, 1);
    let ok = true, asksInRange = true, notesPlayable = true, ordered = true;
    for (let i = 0; i < level.rounds; i++) {
      const round = makeRound(level, rng, i);
      const total = roundBeats(round);
      if (total <= 0 || round.sounds.length === 0) ok = false;
      if (!round.asks.every(b => b >= 0 && b < total)) asksInRange = false;
      if (!round.sounds.every(s => s.midi === null || CHIME_MIDI.includes(s.midi))) notesPlayable = false;
      if (!round.sounds.every((s, k) => k === 0 || s.beat >= round.sounds[k - 1].beat)) ordered = false;
      if (!round.sounds.every(s => s.beat >= 0 && s.beat < total)) ok = false;
    }
    is(`test_round_${level.id}_always_has_something_to_play`, ok, true);
    is(`test_round_${level.id}_never_asks_for_a_beat_outside_the_bar`, asksInRange, true);
    is(`test_round_${level.id}_only_uses_notes_the_chimes_have`, notesPlayable, true);
    is(`test_round_${level.id}_lays_its_notes_out_in_order`, ordered, true);
  }
  const pulse = makeRound(LEVELS[0], rngFor(LEVELS[0], 1), 0);
  is('test_round_pulse_asks_for_every_beat_of_two_bars', pulse.asks, [0, 1, 2, 3, 4, 5, 6, 7]);
  is('test_round_pulse_sounds_something_on_every_beat', pulse.sounds.length, 8);
  const ls = makeRound(LEVELS[1], rngFor(LEVELS[1], 1), 0);
  is('test_round_long_and_short_fills_the_bars_exactly',
    ls.sounds.reduce((a, s) => a + s.beats, 0), roundBeats(ls));
  is('test_round_long_and_short_has_a_long_and_a_short_in_it',
    new Set(ls.sounds.map(s => s.beats)).size > 1, true);
  const waltz = makeRound(LEVELS[3], rngFor(LEVELS[3], 1), 0);
  is('test_round_the_waltz_counts_to_three', beatsPerBar(waltz.sig), 3);
  is('test_round_the_waltz_leans_on_every_third_beat',
    waltz.sounds.filter(s => s.stress === 'strong').map(s => s.beat), [0, 3]);
  const four = makeRound(LEVELS[2], rngFor(LEVELS[2], 1), 5);
  is('test_round_the_late_rounds_of_four_ask_only_for_the_one',
    four.asks.every(b => b % 4 === 0), true);
  const echo = makeRound(LEVELS[4], rngFor(LEVELS[4], 1), 0);
  is('test_round_echo_gives_a_phrase_to_play_back', echo.answer.length > 0, true);
  is('test_round_echo_never_repeats_a_note_straight_away',
    echo.answer.every((n, i) => i === 0 || n !== echo.answer[i - 1]), true);
  is('test_round_echo_opens_with_only_three_chimes_in_play', echo.pool.length, 3);
  is('test_round_echo_never_plays_a_note_outside_its_own_pool',
    echo.answer.every(n => echo.pool.includes(n)), true);
  is('test_round_echo_opens_out_to_more_chimes_later',
    makeRound(LEVELS[4], rngFor(LEVELS[4], 1), 5).pool.length, 7);
  is('test_round_echo_notes_are_one_beat_or_two',
    echo.sounds.every(s => s.beats === 1 || s.beats === 2), true);
  is('test_round_echo_never_runs_past_its_own_bars',
    echo.sounds.every(s => s.beat + s.beats <= roundBeats(echo)), true);
  is('test_round_a_level_that_is_not_echo_greys_nothing_out',
    makeRound(LEVELS[0], rngFor(LEVELS[0], 1), 0).pool.length, 0);
  const pair = makeRound(LEVELS[5], rngFor(LEVELS[5], 1), 0);
  is('test_round_high_and_low_gives_two_different_notes', pair.pair.a !== pair.pair.b, true);
  is('test_round_high_and_low_starts_with_the_easy_question', pair.pair.exact, false);
  is('test_round_high_and_low_asks_which_bar_later_on',
    makeRound(LEVELS[5], rngFor(LEVELS[5], 1), 4).pair.exact, true);
  const song = makeRound(LEVELS[6], rngFor(LEVELS[6], 1), 0);
  is('test_round_the_song_takes_a_note_out', song.blanks.length > 0, true);
  is('test_round_the_song_never_takes_the_first_note_out', song.blanks.includes(0), false);
  is('test_round_the_song_knows_what_belongs_in_the_gap',
    song.answer.length, song.blanks.length);
  is('test_round_the_song_gap_is_a_note_the_chimes_have',
    song.answer.every(n => CHIME_MIDI.includes(n)), true);
  const tog = makeRound(LEVELS[7], rngFor(LEVELS[7], 1), 0);
  is('test_round_together_asks_for_the_one_and_the_three', tog.asks, [0, 2, 4, 6]);
  is('test_round_together_plays_a_tune_over_the_top', tog.sounds.length > 0, true);

  group('Klankhuis — the stars');
  is('test_stars_everything_first_time_is_three', starsFor(6, 6), 3);
  is('test_stars_one_slip_in_six_is_two', starsFor(5, 6), 2);
  is('test_stars_three_quarters_is_two', starsFor(6, 8), 2);
  is('test_stars_half_is_one', starsFor(3, 6), 1);
  is('test_stars_a_third_is_none', starsFor(2, 6), 0);
  is('test_stars_nothing_right_is_none', starsFor(0, 6), 0);
  is('test_stars_a_level_with_no_rounds_earns_none', starsFor(0, 0), 0);
}

// ---------------------------------------------------------------- Letterbos: Dutch phonics

{
  const {
    sayOf, phonemeOf, sameSound, isDigraph, isVowelUnit, splitWord, spellingName, exampleLine,
    pickDistractor, CONFUSED, knownUnit,
  } = await bundle('src/games/letters/phonics.ts', 'phonics.mjs');

  group('Letterbos — hoe een letter klinkt, niet hoe hij heet');
  // a sound that can be held is written held, so a voice says /m/ and not "em"
  is('test_phonics_m_is_the_sound_not_the_letter_name', sayOf('m'), 'mmm');
  is('test_phonics_s_is_stretched', sayOf('s'), 'sss');
  is('test_phonics_r_is_stretched', sayOf('r'), 'rrr');
  is('test_phonics_z_is_stretched', sayOf('z'), 'zzz');
  // a plosive cannot be said alone, so it gets the smallest vowel there is
  is('test_phonics_p_gets_the_smallest_vowel', sayOf('p'), 'puh');
  is('test_phonics_b_gets_the_smallest_vowel', sayOf('b'), 'buh');
  is('test_phonics_p_and_b_are_still_two_sounds', sameSound('p', 'b'), false);
  // a bare short vowel cannot be written in Dutch, so the interjection spelling stands in
  is('test_phonics_short_a_is_not_the_long_a', sayOf('a') === sayOf('aa'), false);
  is('test_phonics_short_a_is_written_as_the_interjection', sayOf('a'), 'ah');
  is('test_phonics_short_u_is_written_as_the_interjection', sayOf('u'), 'uh');
  is('test_phonics_long_aa_is_read_straight', sayOf('aa'), 'aa');
  is('test_phonics_long_uu_is_read_straight', sayOf('uu'), 'uu');

  group('Letterbos — twee spellingen, één klank');
  is('test_phonics_ei_and_ij_sound_the_same', sameSound('ei', 'ij'), true);
  is('test_phonics_ei_and_ij_are_said_the_same', sayOf('ij'), sayOf('ei'));
  is('test_phonics_ij_is_never_spelled_out_as_i_j', sayOf('ij'), 'ei');
  is('test_phonics_au_and_ou_sound_the_same', sameSound('au', 'ou'), true);
  is('test_phonics_auw_and_ouw_sound_the_same', sameSound('auw', 'ouw'), true);
  is('test_phonics_g_and_ch_are_one_sound_in_dutch', sameSound('g', 'ch'), true);
  is('test_phonics_ei_and_ie_are_two_sounds', sameSound('ei', 'ie'), false);
  is('test_phonics_ou_and_oe_are_two_sounds', sameSound('ou', 'oe'), false);
  is('test_phonics_ui_and_eu_are_two_sounds', sameSound('ui', 'eu'), false);
  is('test_phonics_ij_is_called_the_long_ij', spellingName('ij', true), 'de lange ij');
  is('test_phonics_ei_is_called_the_short_ei', spellingName('ei', true), 'de korte ei');
  is('test_phonics_the_long_ij_is_named_in_english_too', spellingName('ij', false), 'the long ij');
  is('test_phonics_a_plain_letter_has_no_special_name', spellingName('m', true), 'm');

  group('Letterbos — wat is één klank en wat zijn er twee');
  is('test_phonics_aa_is_one_sound_of_two_letters', isDigraph('aa'), true);
  is('test_phonics_a_single_letter_is_not_a_digraph', isDigraph('a'), false);
  is('test_phonics_eeuw_is_one_sound_of_four_letters', isDigraph('eeuw'), true);
  is('test_phonics_ui_is_a_vowel', isVowelUnit('ui'), true);
  is('test_phonics_s_is_not_a_vowel', isVowelUnit('s'), false);
  is('test_phonics_ng_is_a_consonant', isVowelUnit('ng'), false);
  is('test_phonics_ng_and_nk_are_two_sounds', sameSound('ng', 'nk'), false);
  is('test_phonics_an_unknown_spelling_falls_back_to_itself', sayOf('qx'), 'qx');
  is('test_phonics_an_unknown_spelling_is_not_known', knownUnit('qx'), false);
  is('test_phonics_example_names_a_word_the_child_knows', exampleLine('aa', true), 'de aa van maan');
  is('test_phonics_example_is_english_in_english', exampleLine('ui', false), 'the ui in huis');
  is('test_phonics_every_sound_has_a_phoneme', phonemeOf('oe') !== 'oe', true);

  group('Letterbos — een woord in klanken hakken');
  is('test_split_short_word_is_letter_by_letter', splitWord('kat'), ['k', 'a', 't']);
  is('test_split_doubled_vowel_stays_together', splitWord('maan'), ['m', 'aa', 'n']);
  is('test_split_oe_is_one_sound', splitWord('boek'), ['b', 'oe', 'k']);
  is('test_split_ui_is_one_sound', splitWord('huis'), ['h', 'ui', 's']);
  is('test_split_eu_is_one_sound', splitWord('deur'), ['d', 'eu', 'r']);
  is('test_split_ie_is_one_sound', splitWord('fiets'), ['f', 'ie', 't', 's']);
  is('test_split_ei_is_one_sound', splitWord('trein'), ['t', 'r', 'ei', 'n']);
  is('test_split_ij_is_one_sound', splitWord('ijs'), ['ij', 's']);
  is('test_split_ij_at_the_end_of_a_word', splitWord('bij'), ['b', 'ij']);
  is('test_split_ou_is_one_sound', splitWord('koud'), ['k', 'ou', 'd']);
  is('test_split_auw_beats_au', splitWord('blauw'), ['b', 'l', 'auw']);
  is('test_split_ouw_beats_ou', splitWord('touw'), ['t', 'ouw']);
  is('test_split_eeuw_beats_ee', splitWord('leeuw'), ['l', 'eeuw']);
  is('test_split_sch_is_s_plus_ch', splitWord('schaap'), ['s', 'ch', 'aa', 'p']);
  is('test_split_three_consonants_in_front', splitWord('straat'), ['s', 't', 'r', 'aa', 't']);
  is('test_split_ng_is_one_sound', splitWord('angst'), ['a', 'ng', 's', 't']);
  is('test_split_nk_is_one_sound', splitWord('bank'), ['b', 'a', 'nk']);
  is('test_split_four_consonants_at_the_end', splitWord('herfst'), ['h', 'e', 'r', 'f', 's', 't']);
  is('test_split_a_word_that_starts_with_its_vowel', splitWord('eik'), ['ei', 'k']);
  is('test_split_two_syllables_still_works', splitWord('augurk'), ['au', 'g', 'u', 'r', 'k']);

  group('Letterbos — de verkeerde tegel op het rek');
  const fixedRng = () => 0.4;
  const d1 = pickDistractor(['k', 'a', 't'], fixedRng);
  is('test_distractor_is_confusable_with_a_sound_in_the_word',
    ['k', 'a', 't'].some(p => (CONFUSED[p] ?? []).includes(d1)), true);
  is('test_distractor_is_never_a_sound_the_word_needs', ['k', 'a', 't'].includes(d1), false);
  const d2 = pickDistractor(['b', 'u', 's'], fixedRng, ['d']);
  is('test_distractor_avoids_a_tile_already_on_the_rack', d2 === 'd', false);
  is('test_confusion_pairs_b_with_d', (CONFUSED.b ?? []).includes('d'), true);
  is('test_confusion_pairs_ei_with_ij', (CONFUSED.ei ?? []).includes('ij'), true);
}

// ---------------------------------------------------------------- Letterbos: the word list

{
  const { WORDS, LADDERS, SENTENCES, stepBetween, byWord, wordsIn } =
    await bundle('src/games/letters/words.ts', 'letterwords.mjs');
  const { knownUnit } = await bundle('src/games/letters/phonics.ts', 'phonics2.mjs');
  const { PICTURES, SCENES } = await bundle('src/games/letters/pictures.ts', 'pictures.mjs');

  group('Letterbos — de woordenlijst');
  is('test_wordlist_holds_at_least_a_hundred_and_twenty_words', WORDS.length >= 120, true);
  is('test_wordlist_every_breakdown_spells_its_own_word',
    WORDS.filter(w => w.parts.join('') !== w.w).map(w => w.w), []);
  is('test_wordlist_every_sound_is_in_the_table',
    WORDS.flatMap(w => w.parts).filter(p => !knownUnit(p)), []);
  is('test_wordlist_every_word_has_a_drawing',
    WORDS.filter(w => !PICTURES[w.pic]).map(w => w.w), []);
  is('test_wordlist_has_no_word_twice',
    new Set(WORDS.map(w => w.w)).size, WORDS.length);
  is('test_wordlist_first_level_words_are_three_sounds_long',
    wordsIn('kort').filter(w => w.parts.length !== 3).map(w => w.w), []);
  is('test_wordlist_first_level_vowels_are_all_short',
    wordsIn('kort').filter(w => w.parts[1].length !== 1).map(w => w.w), []);
  is('test_wordlist_long_level_words_all_have_a_doubled_vowel',
    wordsIn('lang').filter(w => !w.parts.some(p => p.length === 2 && p[0] === p[1])).map(w => w.w), []);
  is('test_wordlist_ei_words_all_contain_ei',
    wordsIn('ei').filter(w => !w.parts.includes('ei')).map(w => w.w), []);
  is('test_wordlist_ij_words_all_contain_ij',
    wordsIn('ij').filter(w => !w.parts.includes('ij')).map(w => w.w), []);
  is('test_wordlist_au_words_all_contain_au_or_auw',
    wordsIn('au').filter(w => !w.parts.includes('au') && !w.parts.includes('auw')).map(w => w.w), []);
  is('test_wordlist_ou_words_all_contain_ou_or_ouw',
    wordsIn('ou').filter(w => !w.parts.includes('ou') && !w.parts.includes('ouw')).map(w => w.w), []);
  // every word on the cluster level earns its place: either two consonants land next to each
  // other, or the word carries the ng/nk that the level is also there to teach
  const consonant = p => !'aeiou'.includes(p[0]);
  is('test_wordlist_cluster_words_really_stack_consonants',
    wordsIn('cluster').filter(w => {
      const stacked = w.parts.some((p, i) => i > 0 && consonant(p) && consonant(w.parts[i - 1]));
      return !stacked && !w.parts.includes('ng') && !w.parts.includes('nk');
    }).map(w => w.w), []);

  group('Letterbos — de woordtrap');
  is('test_ladder_every_word_is_in_the_list',
    LADDERS.flat().filter(w => !byWord(w)), []);
  is('test_ladder_every_step_changes_exactly_one_sound',
    LADDERS.flatMap(chain => chain.slice(1).map((w, i) => {
      const a = byWord(chain[i]).parts, b = byWord(w).parts;
      return stepBetween(a, b) < 0 ? `${chain[i]}->${w}` : null;
    })).filter(Boolean), []);
  is('test_step_between_poot_and_pot_is_the_vowel',
    stepBetween(byWord('poot').parts, byWord('pot').parts), 1);
  is('test_step_between_maan_and_man_is_the_vowel',
    stepBetween(byWord('maan').parts, byWord('man').parts), 1);
  is('test_step_between_kat_and_kam_is_the_last_sound',
    stepBetween(byWord('kat').parts, byWord('kam').parts), 2);
  is('test_step_between_the_same_word_is_no_step',
    stepBetween(['k', 'a', 't'], ['k', 'a', 't']), -1);
  is('test_step_between_two_changes_is_no_step',
    stepBetween(['k', 'a', 't'], ['p', 'a', 'p']), -1);
  is('test_step_between_words_of_different_length_is_no_step',
    stepBetween(['k', 'a', 't'], ['k', 'a']), -1);

  group('Letterbos — de zinnetjes');
  is('test_sentences_are_three_or_four_words',
    SENTENCES.filter(s => s.nl.length < 3 || s.nl.length > 4).map(s => s.nl.join(' ')), []);
  is('test_sentences_all_have_a_scene_to_draw',
    SENTENCES.filter(s => !SCENES[s.scene]).map(s => s.scene), []);
}

// ---------------------------------------------------------------- Letterbos: the photographs

/**
 * Two halves that have to agree. `scripts/letterwords.mjs` decides which word gets a photograph
 * and refuses anything that is not free to show; `src/games/letters/photos.ts` reads the file it
 * wrote and refuses it a second time before drawing. The checks below hold both to the same rule,
 * and hold the file that was actually shipped to it. `public/letters/photos.json` is checked into
 * the repository and read here as a fixture rather than as outside state, because a photograph
 * nobody may use is not the sort of thing to find out about on a phone.
 */
{
  const { PLAN, isFreeLicence: freeInScript, isUsablePhoto } = await import('../scripts/letterwords.mjs');
  const { WORDS } = await bundle('src/games/letters/words.ts', 'letterwords3.mjs');
  const { PICTURES } = await bundle('src/games/letters/pictures.ts', 'pictures2.mjs');
  const {
    isFreeLicence: freeInGame, usableRow, creditLine, urlOf, loadPhotos, photoFor, photosState,
    WIDTHS,
  } = await bundle('src/games/letters/photos.ts', 'letterphotos.mjs');
  const shipped = JSON.parse(readFileSync('public/letters/photos.json', 'utf8'));
  const rowOf = w => shipped.words.find(r => r.w === w);
  const licenceOf = r => shipped.licences[r.l];

  group('Letterbos — foto of tekening, per woord');
  is('test_photoplan_every_word_in_the_list_has_a_choice',
    WORDS.filter(w => !PLAN[w.w]).map(w => w.w), []);
  is('test_photoplan_holds_no_word_the_game_does_not_have',
    Object.keys(PLAN).filter(w => !WORDS.some(x => x.w === w)), []);
  is('test_photoplan_every_choice_is_photo_or_drawn',
    Object.entries(PLAN).filter(([, p]) => p.art !== 'photo' && p.art !== 'drawn').map(([w]) => w), []);
  // a word that keeps its drawing has to say why, because "we never got round to it" and "a
  // photograph would be worse" are different answers and only one of them is finished
  is('test_photoplan_every_drawn_word_says_why',
    Object.entries(PLAN).filter(([, p]) => p.art === 'drawn' && !p.why).map(([w]) => w), []);
  is('test_photoplan_every_photo_word_says_where_to_look',
    Object.entries(PLAN).filter(([, p]) => p.art === 'photo' && !(p.src ?? []).length).map(([w]) => w), []);

  group('Letterbos — geen woord zonder plaatje');
  is('test_photodata_holds_a_row_for_every_word',
    WORDS.filter(w => !rowOf(w.w)).map(w => w.w), []);
  // the point of the whole thing: a word is either a photograph or a drawing and never neither,
  // and the ones that are a photograph keep their drawing underneath to fall back to
  is('test_photodata_every_word_has_a_photograph_or_a_drawing',
    WORDS.filter(w => {
      const r = rowOf(w.w);
      const hasPhoto = r && r.a === 'photo' && isUsablePhoto({ p: r.p, c: r.c, l: licenceOf(r) });
      return !hasPhoto && !PICTURES[w.pic];
    }).map(w => w.w), []);
  is('test_photodata_every_photographed_word_still_has_its_drawing',
    shipped.words.filter(r => r.a === 'photo' && !PICTURES[r.w]).map(r => r.w), []);
  is('test_photodata_at_least_forty_words_got_a_photograph',
    shipped.words.filter(r => r.a === 'photo').length >= 40, true);

  group('Letterbos — wie de foto maakte, en onder welke licentie');
  is('test_photodata_every_photograph_names_a_photographer',
    shipped.words.filter(r => r.a === 'photo' && !(r.c ?? '').trim()).map(r => r.w), []);
  is('test_photodata_every_photograph_names_a_licence',
    shipped.words.filter(r => r.a === 'photo' && !licenceOf(r)).map(r => r.w), []);
  is('test_photodata_every_licence_is_one_we_may_show',
    shipped.licences.filter(l => !freeInScript(l)), []);
  is('test_photodata_every_path_leaves_room_for_a_width',
    shipped.words.filter(r => r.a === 'photo' && !/^(thumb\/)?[0-9a-f]\//.test(r.p)).map(r => r.w), []);
  is('test_photodata_a_drawn_row_carries_no_photograph',
    shipped.words.filter(r => r.a === 'drawn' && (r.p || r.c)).map(r => r.w), []);

  group('Letterbos — welke licentie mag, en welke niet');
  const cases = [
    ['CC0', true], ['Public domain', true], ['CC BY 4.0', true], ['CC BY-SA 3.0', true],
    ['CC BY-SA 2.0 de', true], ['Attribution', true],
    ['CC BY-NC 4.0', false], ['CC BY-NC-SA 3.0', false], ['CC BY-ND 4.0', false],
    ['CC BY-NC-ND 2.0', false], ['GFDL', false], ['Fair use', false], ['', false],
  ];
  is('test_licence_cc_zero_is_free', freeInGame('CC0'), true);
  is('test_licence_public_domain_is_free', freeInGame('Public domain'), true);
  is('test_licence_cc_by_sa_is_free', freeInGame('CC BY-SA 4.0'), true);
  is('test_licence_noncommercial_is_refused', freeInGame('CC BY-NC 4.0'), false);
  is('test_licence_no_derivatives_is_refused', freeInGame('CC BY-ND 4.0'), false);
  is('test_licence_noncommercial_no_derivatives_is_refused', freeInGame('CC BY-NC-ND 2.0'), false);
  is('test_licence_nothing_at_all_is_refused', freeInGame(''), false);
  // the script writes the file and the game reads it; if the two ever disagree about a licence,
  // one of them is shipping something the other would have refused
  is('test_licence_the_script_and_the_game_agree',
    cases.filter(([name, want]) => freeInScript(name) !== want || freeInGame(name) !== want).map(([n]) => n), []);

  group('Letterbos — terugvallen op de tekening');
  const LIC = ['CC BY-SA 4.0', 'CC BY-NC 2.0'];
  is('test_fallback_a_complete_row_is_shown',
    usableRow({ w: 'koe', a: 'photo', p: 'thumb/a/ab/Koe.jpg/{w}px-Koe.jpg', c: 'Jan', l: 0 }, LIC), true);
  is('test_fallback_a_row_with_no_photographer_falls_back',
    usableRow({ w: 'koe', a: 'photo', p: 'thumb/a/ab/Koe.jpg/{w}px-Koe.jpg', c: '  ', l: 0 }, LIC), false);
  is('test_fallback_a_row_with_an_unfree_licence_falls_back',
    usableRow({ w: 'koe', a: 'photo', p: 'thumb/a/ab/Koe.jpg/{w}px-Koe.jpg', c: 'Jan', l: 1 }, LIC), false);
  is('test_fallback_a_row_with_no_licence_falls_back',
    usableRow({ w: 'koe', a: 'photo', p: 'thumb/a/ab/Koe.jpg/{w}px-Koe.jpg', c: 'Jan' }, LIC), false);
  is('test_fallback_a_row_with_no_path_falls_back',
    usableRow({ w: 'koe', a: 'photo', p: '', c: 'Jan', l: 0 }, LIC), false);
  is('test_fallback_a_word_marked_drawn_is_never_shown',
    usableRow({ w: 'pen', a: 'drawn', p: 'thumb/a/ab/Pen.jpg/{w}px-Pen.jpg', c: 'Jan', l: 0 }, LIC), false);
  is('test_fallback_nothing_at_all_falls_back', usableRow(null, LIC), false);
  // the same row asked twice has to give the same answer, whatever else is going on: the choice
  // between a photograph and a drawing may not depend on how often it is asked
  const twice = r => [usableRow(r, LIC), usableRow(r, LIC)];
  is('test_fallback_is_the_same_answer_every_time',
    twice({ w: 'koe', a: 'photo', p: 'x/y/Koe.jpg', c: 'Jan', l: 1 }), [false, false]);

  group('Letterbos — de foto in het spel');
  const bundleFile = {
    v: 1, base: 'https://example.org/commons/', source: 'Wikimedia Commons',
    licences: ['CC BY-SA 4.0', 'CC BY-NC 2.0'],
    words: [
      { w: 'koe', a: 'photo', p: 'thumb/a/ab/Koe.jpg/{w}px-Koe.jpg', c: 'Jan Bakker', l: 0 },
      { w: 'pen', a: 'drawn' },
      { w: 'vos', a: 'photo', p: 'thumb/c/cd/Vos.jpg/{w}px-Vos.jpg', c: 'Ann', l: 1 },
      { w: 'kam', a: 'photo', p: 'thumb/e/ef/Kam.jpg/{w}px-Kam.jpg', c: '', l: 0 },
    ],
  };
  is('test_photos_load_reads_the_file',
    await loadPhotos(async () => ({ ok: true, json: async () => bundleFile })), 'ready');
  is('test_photos_a_free_and_credited_word_gets_its_photograph', photoFor('koe')?.credit, 'Jan Bakker');
  is('test_photos_a_drawn_word_gets_none', photoFor('pen'), null);
  is('test_photos_an_unfree_word_gets_none', photoFor('vos'), null);
  is('test_photos_an_uncredited_word_gets_none', photoFor('kam'), null);
  is('test_photos_a_word_nobody_asked_about_gets_none', photoFor('maan'), null);
  is('test_photos_the_address_carries_the_width_asked_for',
    urlOf(photoFor('koe'), WIDTHS.card), 'https://example.org/commons/thumb/a/ab/Koe.jpg/330px-Koe.jpg');
  is('test_photos_only_widths_wikimedia_renders_are_asked_for', [WIDTHS.card, WIDTHS.page], [330, 960]);
  is('test_photos_the_credit_names_the_photographer_and_the_licence',
    creditLine(photoFor('koe'), 'Foto'), 'Foto: Jan Bakker · CC BY-SA 4.0');

  const offline = await bundle('src/games/letters/photos.ts', 'letterphotos2.mjs');
  is('test_photos_no_network_leaves_every_word_drawn',
    await offline.loadPhotos(async () => { throw new Error('offline'); }), 'failed');
  is('test_photos_no_network_still_answers_for_every_word',
    WORDS.filter(w => offline.photoFor(w.w) !== null).map(w => w.w), []);
  is('test_photos_a_second_load_does_not_start_over',
    await offline.loadPhotos(async () => ({ ok: true, json: async () => bundleFile })), 'failed');
  is('test_photos_the_state_is_readable_from_outside', photosState(), 'ready');
}

// ---------------------------------------------------------------- Letterbos: the ladder of levels

{
  const {
    LEVELS, makeQuestion, rngFor, rackFor, cutsOf, tileFits, isSolved, firstEmpty, starsFor,
    teachFor, chooseQuestion, ladderQuestion, sentenceQuestion,
  } = await bundle('src/games/letters/model.ts', 'lettermodel.mjs');
  const { byWord } = await bundle('src/games/letters/words.ts', 'letterwords2.mjs');
  const level = id => LEVELS.find(l => l.id === id);

  group('Letterbos — het rek tegels');
  const kort = level('klanken');
  const rack1 = rackFor(byWord('bus'), kort, rngFor(kort, 1));
  is('test_rack_holds_every_sound_the_word_needs',
    ['b', 'u', 's'].every(p => rack1.includes(p)), true);
  is('test_rack_holds_exactly_one_tile_too_many', rack1.length, 4);
  const lang2 = level('lange');
  const rack2 = rackFor(byWord('maan'), lang2, rngFor(lang2, 1));
  is('test_long_level_offers_the_double_vowel_as_one_tile', rack2.includes('aa'), true);
  is('test_long_level_offers_the_single_vowel_beside_it', rack2.includes('a'), true);
  const rack3 = rackFor(byWord('schaap'), level('cluster'), rngFor(level('cluster'), 1));
  is('test_cluster_rack_holds_sch_as_s_and_ch', rack3.includes('ch') && rack3.includes('s'), true);
  is('test_cluster_rack_has_two_tiles_too_many', rack3.length, 6);

  group('Letterbos — ei of ij, au of ou');
  const qEi = chooseQuestion(byWord('trein'), () => 0.3);
  is('test_choose_question_leaves_only_the_trap_open', qEi.filled, ['t', 'r', null, 'n']);
  is('test_choose_question_points_at_the_open_slot', qEi.focus, 2);
  is('test_choose_question_offers_both_spellings', qEi.rack.slice().sort(), ['ei', 'ij']);
  const qIj = chooseQuestion(byWord('ijs'), () => 0.3);
  is('test_choose_question_works_when_the_trap_is_first', qIj.filled, [null, 's']);
  const qOu = chooseQuestion(byWord('hout'), () => 0.3);
  is('test_choose_question_offers_au_beside_ou', qOu.rack.slice().sort(), ['au', 'ou']);
  const qAuw = chooseQuestion(byWord('blauw'), () => 0.3);
  is('test_choose_question_offers_ouw_beside_auw', qAuw.rack.slice().sort(), ['auw', 'ouw']);
  is('test_teach_says_the_two_spellings_sound_the_same',
    teachFor(qEi, 2, 'ij', true), 'ei en ij klinken hetzelfde. In dit woord is het de korte ei.');
  is('test_teach_says_a_double_vowel_is_one_sound',
    teachFor({ kind: 'build', parts: ['m', 'aa', 'n'] }, 1, 'a', true),
    'aa is één klank: twee letters, samen /aa/.');
  is('test_teach_names_the_sound_that_belongs_there',
    teachFor({ kind: 'build', parts: ['k', 'a', 't'] }, 2, 's', true), 'Hier hoort de t.');

  group('Letterbos — woorden hakken');
  is('test_cuts_fall_between_the_sounds', cutsOf(['m', 'aa', 'n']), [1, 3]);
  is('test_cuts_of_a_three_letter_word', cutsOf(['k', 'a', 't']), [1, 2]);
  is('test_cuts_count_the_letters_not_the_sounds', cutsOf(['s', 'ch', 'aa', 'p']), [1, 3, 5]);
  is('test_cuts_of_a_single_sound_word_are_none', cutsOf(['ei']), []);
  const qChop = makeQuestion(level('hakken'), rngFor(level('hakken'), 2), 0);
  is('test_chop_question_writes_the_word_out_letter_by_letter',
    qChop.letters.join(''), qChop.word);
  is('test_chop_question_has_one_cut_fewer_than_it_has_sounds',
    qChop.gaps.length, qChop.parts.length - 1);
  is('test_chop_question_has_no_rack', qChop.rack.length, 0);

  group('Letterbos — van woord naar woord, en de zin');
  const qLad = ladderQuestion(() => 0.1, 0);
  is('test_ladder_question_keeps_the_rest_of_the_word',
    qLad.filled.filter(x => x == null).length, 1);
  is('test_ladder_question_offers_the_sound_that_changes',
    qLad.rack.includes(qLad.parts[qLad.focus]), true);
  is('test_ladder_question_says_where_it_came_from', typeof qLad.from, 'string');
  is('test_ladder_question_comes_from_a_different_word', qLad.from === qLad.word, false);
  const qSen = sentenceQuestion(() => 0.5);
  is('test_sentence_question_has_one_word_too_many', qSen.rack.length, qSen.parts.length + 1);
  is('test_sentence_question_offers_every_word_of_the_sentence',
    qSen.parts.every(p => qSen.rack.includes(p)), true);

  group('Letterbos — wat telt als goed');
  is('test_tile_fits_its_own_slot', tileFits({ parts: ['m', 'aa', 'n'] }, 1, 'aa'), true);
  is('test_tile_does_not_fit_another_slot', tileFits({ parts: ['m', 'aa', 'n'] }, 0, 'aa'), false);
  is('test_a_repeated_sound_fits_either_of_its_places',
    tileFits({ parts: ['p', 'o', 'p'] }, 2, 'p'), true);
  is('test_tile_outside_the_word_never_fits', tileFits({ parts: ['k', 'a', 't'] }, 7, 'k'), false);
  is('test_word_is_solved_when_every_slot_is_right',
    isSolved({ parts: ['k', 'a', 't'] }, ['k', 'a', 't']), true);
  is('test_word_is_not_solved_with_a_hole_in_it',
    isSolved({ parts: ['k', 'a', 't'] }, ['k', null, 't']), false);
  is('test_first_empty_slot_is_where_the_help_goes', firstEmpty(['k', null, 't']), 1);
  is('test_first_empty_of_a_finished_word_is_none', firstEmpty(['k', 'a', 't']), -1);
  is('test_stars_all_six_without_help_is_three', starsFor(6, 6), 3);
  is('test_stars_most_without_help_is_two', starsFor(5, 6), 2);
  is('test_stars_half_without_help_is_one', starsFor(3, 6), 1);
  is('test_stars_none_without_help_is_none', starsFor(0, 6), 0);

  group('Letterbos — de ladder zelf');
  is('test_ladder_has_nine_levels', LEVELS.length, 9);
  is('test_ladder_level_ids_are_all_different',
    new Set(LEVELS.map(l => l.id)).size, LEVELS.length);
  is('test_ladder_every_level_has_a_dutch_name_and_hint',
    LEVELS.filter(l => !l.nameNl || !l.hintNl).map(l => l.id), []);
  is('test_ladder_every_level_asks_at_least_five_questions',
    LEVELS.filter(l => l.rounds < 5).map(l => l.id), []);
  is('test_question_never_repeats_a_word_it_was_told_to_avoid', (() => {
    const l = level('klanken'), rng = rngFor(l, 3);
    const asked = [];
    for (let i = 0; i < 6; i++) { const q = makeQuestion(l, rng, i, asked); asked.push(q.word); }
    return new Set(asked).size;
  })(), 6);
  is('test_every_level_can_be_played_through_without_throwing', (() => {
    let made = 0;
    for (const l of LEVELS) {
      const rng = rngFor(l, 1);
      const asked = [];
      for (let i = 0; i < l.rounds; i++) {
        const q = makeQuestion(l, rng, i, asked);
        asked.push(q.word);
        if (q.parts.length && q.filled.length === q.parts.length) made++;
      }
    }
    return made;
  })(), LEVELS.reduce((a, l) => a + l.rounds, 0));
}

// ---------------------------------------------------------------- Wereldatlas: the map and its rules

{
  const geo = await bundle('src/games/atlas/geo.ts', 'atlasgeo.mjs');
  const mod = await bundle('src/games/atlas/model.ts', 'atlasmodel.mjs');
  const {
    ALL_FEATURES, CONTINENTS, EU_COUNTRIES, FLAG_COUNTRIES, NL_CITIES, NL_WATERS, OCEANS,
    PROVINCES, WORLD_COUNTRIES, EU_VIEW, NL_VIEW, anchorOf, bounds, capitalOf, centroid,
    distanceToPath, featureById, fit, floodedAt, heightAt, hits, innerPoint, missDistance, nameOf,
    pointInRing, pointInRings, project, spanOf, unproject,
  } = geo;
  const {
    LEVELS, MIN_SPAN, NEAR, VIEWS, boardFor, dropTarget, isRight, levelById, nextLevel, outlinable,
    placeable, poolFor, rngFor, runFor, starsFor, teachLine,
  } = mod;

  const byId = id => ALL_FEATURES.find(f => f.id === id);
  const box = { x: 0, y: 0, w: 300, h: 300 };
  const square = [[[0, 0], [0, 2], [2, 2], [2, 0]]];

  group('Wereldatlas — the twelve provinces');
  is('test_provinces_all_twelve_are_present', PROVINCES.length, 12);
  is('test_provinces_have_no_duplicate_ids', new Set(PROVINCES.map(p => p.id)).size, 12);
  is('test_provinces_have_twelve_distinct_dutch_names', new Set(PROVINCES.map(p => p.nl)).size, 12);
  is('test_provinces_have_twelve_distinct_english_names', new Set(PROVINCES.map(p => p.en)).size, 12);
  is('test_provinces_each_name_their_own_capital',
    PROVINCES.every(p => !!p.capNl && !!p.capEn), true);
  is('test_provinces_capitals_are_all_different', new Set(PROVINCES.map(p => p.capNl)).size, 12);
  is('test_provinces_friesland_is_named_for_its_language',
    byId('friesland').factNl.includes('eigen taal'), true);
  is('test_provinces_limburg_knows_the_highest_point',
    byId('limburg').factNl.includes('322'), true);
  is('test_provinces_zeeland_is_drawn_as_more_than_one_island',
    byId('zeeland').rings.length, 2);
  is('test_provinces_every_shape_is_a_closed_ring_of_points',
    PROVINCES.every(p => p.rings.every(r => r.length >= 5)), true);

  group('Wereldatlas — hitting a shape with a finger');
  // arrange: a two by two degree square, and three points
  is('test_point_in_ring_a_point_in_the_middle_is_inside', pointInRing([1, 1], square[0]), true);
  is('test_point_in_ring_a_point_outside_is_outside', pointInRing([3, 1], square[0]), false);
  is('test_point_in_rings_finds_the_second_island',
    pointInRings([3.6, 51.5], byId('zeeland').rings), true);
  is('test_point_in_rings_the_sea_between_the_islands_is_not_zeeland',
    pointInRings([3.2, 51.9], byId('zeeland').rings), false);
  is('test_miss_distance_inside_a_shape_is_nought', missDistance(byId('drenthe'), [6.6, 52.8]), 0);
  is('test_miss_distance_outside_a_shape_is_the_distance_to_its_coast',
    missDistance({ rings: square }, [4, 1]) > 1.9, true);
  is('test_miss_distance_a_city_is_measured_to_its_spot',
    Math.round(missDistance(byId('amsterdam'), [4.89, 52.37]) * 1000), 0);
  is('test_miss_distance_a_river_is_measured_to_the_line',
    Math.round(distanceToPath([5.2, 51.95], byId('rijn').path) * 100) <= 1, true);
  is('test_hits_a_finger_near_a_city_counts', hits(byId('amsterdam'), [4.95, 52.4], 0.22), true);
  is('test_hits_a_finger_far_from_a_city_does_not', hits(byId('amsterdam'), [6.5, 53.2], 0.22), false);

  group('Wereldatlas — where a piece flies home to');
  // the anchor is what a piece is dragged by and flown to, so it must be inside its own shape
  is('test_anchor_of_a_city_is_its_own_spot', anchorOf(byId('groningenstad')), [6.57, 53.22]);
  is('test_anchor_of_every_shape_lies_inside_that_shape',
    ALL_FEATURES.filter(f => f.rings?.length).every(f => pointInRings(anchorOf(f), f.rings)), true);
  is('test_anchor_of_norway_is_not_in_sweden',
    pointInRings(anchorOf(byId('noorwegen')), byId('zweden').rings), false);
  is('test_inner_point_of_a_square_is_its_middle',
    innerPoint(square).map(v => Math.round(v)), [1, 1]);
  is('test_centroid_of_a_square_is_its_middle', centroid(square).map(v => Math.round(v)), [1, 1]);
  is('test_bounds_of_a_square_are_its_corners', bounds(square), { lon0: 0, lat0: 0, lon1: 2, lat1: 2 });

  group('Wereldatlas — the map on the screen');
  is('test_project_the_top_left_corner_lands_on_the_box_corner',
    project([NL_VIEW.lon0, NL_VIEW.lat1], NL_VIEW, box).y, 0);
  is('test_project_and_back_again_returns_the_same_place', (() => {
    const p = project([5.2, 52.1], NL_VIEW, box);
    const back = unproject(p.x, p.y, NL_VIEW, box);
    return [Math.round(back[0] * 100) / 100, Math.round(back[1] * 100) / 100];
  })(), [5.2, 52.1]);
  is('test_fit_uses_one_scale_for_both_directions',
    fit(NL_VIEW, box).s > 0 && Number.isFinite(fit(NL_VIEW, box).s), true);
  is('test_span_of_the_netherlands_is_about_three_degrees',
    Math.round(spanOf(byId('nederland'), 0.62) * 10) / 10, 2.7);

  group('Wereldatlas — how low the land is');
  // arrange: the Haarlemmermeer polder, the dunes in front of it, and the hills of south Limburg
  is('test_height_the_haarlemmermeer_is_metres_below_the_sea', heightAt([4.68, 52.24]) < 0, true);
  is('test_height_south_limburg_is_the_only_high_ground', heightAt([5.85, 50.85]), 200);
  is('test_height_the_dune_ridge_stands_above_the_land_behind_it',
    heightAt([4.45, 52.25]) > heightAt([4.68, 52.24]), true);
  is('test_flood_with_the_dykes_off_the_deep_polder_goes_under', floodedAt([4.68, 52.24], 0), true);
  is('test_flood_with_the_dykes_off_the_dunes_stay_dry', floodedAt([4.45, 52.25], 0), false);
  is('test_flood_a_storm_surge_of_five_metres_takes_the_low_west',
    floodedAt([4.75, 52.6], 5), true);
  is('test_flood_a_storm_surge_never_reaches_limburg', floodedAt([5.85, 50.85], 5), false);

  group('Wereldatlas — the names and the facts are complete');
  is('test_names_every_feature_has_a_dutch_and_an_english_name',
    ALL_FEATURES.every(f => f.nl.length > 1 && f.en.length > 1), true);
  is('test_facts_every_feature_has_a_dutch_and_an_english_fact',
    ALL_FEATURES.every(f => f.factNl.length > 20 && f.factEn.length > 20), true);
  is('test_facts_the_two_languages_are_not_the_same_sentence',
    ALL_FEATURES.every(f => f.factNl !== f.factEn), true);
  is('test_names_dutch_and_english_are_told_apart', nameOf(byId('noordholland'), true), 'Noord-Holland');
  is('test_names_english_is_english', nameOf(byId('noordholland'), false), 'North Holland');
  is('test_feature_by_id_finds_a_place', featureById('maas').nl, 'De Maas');
  is('test_feature_by_id_of_nothing_finds_nothing', featureById('atlantis'), undefined);
  is('test_ids_are_unique_across_the_whole_atlas',
    new Set(ALL_FEATURES.map(f => f.id)).size, ALL_FEATURES.length);

  group('Wereldatlas — Europe and its capitals');
  is('test_europe_has_at_least_thirty_five_countries', EU_COUNTRIES.length >= 35, true);
  is('test_europe_every_country_names_a_capital',
    EU_COUNTRIES.every(c => !!c.capNl && !!c.capEn), true);
  is('test_europe_no_two_countries_share_a_capital',
    new Set(EU_COUNTRIES.map(c => c.capNl)).size, EU_COUNTRIES.length);
  is('test_europe_no_two_countries_share_a_name',
    new Set(EU_COUNTRIES.map(c => c.nl)).size, EU_COUNTRIES.length);
  is('test_europe_the_capital_of_france_is_paris', capitalOf(byId('frankrijk'), false), 'Paris');
  is('test_europe_the_capital_of_the_netherlands_is_amsterdam', capitalOf(byId('nederland'), true), 'Amsterdam');
  is('test_europe_the_capital_of_switzerland_is_bern_not_zurich', capitalOf(byId('zwitserland'), true), 'Bern');
  is('test_europe_the_capital_of_turkey_is_ankara_not_istanbul', capitalOf(byId('turkije'), true), 'Ankara');
  is('test_europe_every_country_sits_in_europe', EU_COUNTRIES.every(c => c.cont === 'eu'), true);
  is('test_europe_every_capital_falls_inside_its_own_country_on_the_map',
    EU_COUNTRIES.every(c => pointInRings(anchorOf(c), c.rings)), true);

  group('Wereldatlas — the world');
  is('test_continents_there_are_seven', CONTINENTS.length, 7);
  is('test_continents_use_the_animal_books_own_codes',
    CONTINENTS.map(c => c.id).sort().join(','), 'af,an,as,eu,na,oc,sa');
  is('test_continents_every_one_has_an_outline', CONTINENTS.every(c => c.rings.length >= 1), true);
  is('test_oceans_there_are_five', OCEANS.length, 5);
  is('test_oceans_have_no_duplicate_names', new Set(OCEANS.map(o => o.nl)).size, 5);
  is('test_world_has_about_forty_countries', WORLD_COUNTRIES.length >= 40, true);
  is('test_world_every_country_names_a_capital',
    WORLD_COUNTRIES.every(c => !!c.capNl && !!c.capEn), true);
  is('test_world_every_country_sits_on_one_of_the_seven_continents',
    WORLD_COUNTRIES.every(c => CONTINENTS.some(k => k.id === c.cont)), true);
  is('test_world_japan_is_filed_under_asia', byId('japan').cont, 'as');
  is('test_world_a_european_country_reuses_the_very_same_outline',
    byId('frankrijk_w').rings, byId('frankrijk').rings);
  is('test_cities_there_are_twenty_or_more', NL_CITIES.length >= 20, true);
  is('test_cities_have_no_duplicate_names', new Set(NL_CITIES.map(c => c.nl)).size, NL_CITIES.length);
  is('test_waters_cover_the_rivers_and_the_works', NL_WATERS.length, 10);

  group('Wereldatlas — the flags');
  is('test_flags_every_one_belongs_to_a_country_in_the_atlas',
    FLAG_COUNTRIES.every(id => !!byId(id)), true);
  is('test_flags_every_named_country_really_has_a_flag_drawn',
    FLAG_COUNTRIES.every(id => !!byId(id).flag), true);
  is('test_flags_are_only_stripes_crosses_and_discs',
    FLAG_COUNTRIES.every(id => ['bands', 'cross', 'disc'].includes(byId(id).flag.kind)), true);
  is('test_flags_every_colour_is_a_hex_colour',
    FLAG_COUNTRIES.every(id => {
      const f = byId(id).flag;
      const cols = f.kind === 'bands' ? f.colours : f.kind === 'cross' ? [f.field, f.cross, f.inner] : [f.field, f.disc];
      return cols.filter(Boolean).every(c => /^#[0-9a-f]{6}$/i.test(c));
    }), true);
  is('test_flags_the_dutch_flag_is_red_white_blue_from_the_top',
    byId('nederland').flag.colours, ['#ae1c28', '#ffffff', '#21468b']);
  is('test_flags_the_french_flag_stands_up_rather_than_lying_down', byId('frankrijk').flag.dir, 'v');
  is('test_flags_the_danish_flag_is_a_cross', byId('denemarken').flag.kind, 'cross');
  is('test_flags_the_norwegian_cross_has_a_cross_inside_it', byId('noorwegen').flag.inner, '#00205b');

  group('Wereldatlas — the ladder');
  is('test_levels_there_are_nine', LEVELS.length, 9);
  is('test_levels_have_no_duplicate_ids', new Set(LEVELS.map(l => l.id)).size, 9);
  is('test_levels_start_at_home_and_end_at_the_flags',
    [LEVELS[0].id, LEVELS[8].id], ['provincies', 'vlaggen']);
  is('test_levels_every_one_has_both_a_dutch_and_an_english_name',
    LEVELS.every(l => l.name.length > 2 && l.nameNl.length > 2 && l.name !== l.nameNl), true);
  is('test_levels_every_one_has_a_hint_in_both_languages',
    LEVELS.every(l => l.hint.length > 10 && l.hintNl.length > 10), true);
  is('test_level_by_id_finds_the_water_level', levelById('water').board, 'nl');
  is('test_next_level_after_the_provinces_is_the_water', nextLevel('provincies').id, 'water');
  is('test_next_level_after_the_last_one_is_nothing', nextLevel('vlaggen'), null);
  is('test_levels_only_the_water_level_has_the_dyke_switch',
    LEVELS.filter(l => l.dykes).map(l => l.id), ['water']);
  is('test_levels_the_first_one_is_the_twelve_provinces',
    poolFor(LEVELS[0]).length, 12);

  group('Wereldatlas — dealing out the pieces');
  is('test_pool_never_hands_out_a_target_too_small_to_hit',
    LEVELS.every(l => poolFor(l).every(f => placeable(l, f))), true);
  is('test_pool_leaves_luxembourg_off_the_map_of_europe',
    poolFor(levelById('europa')).some(f => f.id === 'luxemburg'), false);
  is('test_pool_keeps_luxembourg_as_a_neighbour_where_it_is_big_enough',
    poolFor(levelById('buren')).some(f => f.id === 'luxemburg_buur'), true);
  is('test_pool_keeps_belgium_on_the_map_of_europe',
    poolFor(levelById('europa')).some(f => f.id === 'belgie'), true);
  is('test_pool_of_every_level_is_at_least_as_long_as_its_rounds',
    LEVELS.every(l => poolFor(l).length >= l.rounds), true);
  is('test_run_hands_out_exactly_as_many_pieces_as_there_are_rounds',
    LEVELS.map(l => runFor(l, rngFor(l, 1)).length), LEVELS.map(l => l.rounds));
  is('test_run_never_hands_out_the_same_piece_twice',
    LEVELS.every(l => {
      const r = runFor(l, rngFor(l, 1));
      return new Set(r.map(f => f.id)).size === r.length;
    }), true);
  is('test_run_stays_inside_its_own_levels_pool',
    LEVELS.every(l => {
      const ids = new Set(poolFor(l).map(f => f.id));
      return runFor(l, rngFor(l, 3)).every(f => ids.has(f.id));
    }), true);
  is('test_run_a_second_go_at_europe_is_not_the_same_twelve_countries',
    runFor(levelById('europa'), rngFor(levelById('europa'), 1)).map(f => f.id).join() ===
    runFor(levelById('europa'), rngFor(levelById('europa'), 2)).map(f => f.id).join(), false);
  is('test_run_is_the_same_every_time_for_the_same_attempt',
    runFor(levelById('steden'), rngFor(levelById('steden'), 4)).map(f => f.id).join(),
    runFor(levelById('steden'), rngFor(levelById('steden'), 4)).map(f => f.id).join());
  is('test_board_of_a_dutch_level_is_the_twelve_provinces', boardFor(levelById('steden')).length, 12);
  is('test_board_of_the_neighbours_puts_the_netherlands_first',
    boardFor(levelById('buren'))[0].id, 'nederland_buur');
  is('test_board_the_netherlands_is_a_piece_on_the_neighbours_level_too',
    poolFor(levelById('buren')).some(f => f.id === 'nederland_buur'), true);
  is('test_board_every_piece_of_every_level_has_its_home_on_the_board',
    LEVELS.every(l => {
      const v = VIEWS[l.board];
      return poolFor(l).every(f => {
        const a = anchorOf(f);
        return a[0] >= v.lon0 && a[0] <= v.lon1 && a[1] >= v.lat0 && a[1] <= v.lat1;
      });
    }), true);

  group('Wereldatlas — dropping a piece');
  const prov = levelById('provincies');
  const cities = levelById('steden');
  is('test_drop_a_province_on_its_own_ground_is_right',
    isRight(prov, byId('friesland'), anchorOf(byId('friesland'))), true);
  is('test_drop_a_province_on_the_wrong_one_is_wrong',
    isRight(prov, byId('friesland'), anchorOf(byId('drenthe'))), false);
  is('test_drop_names_what_was_hit_instead',
    dropTarget(prov, anchorOf(byId('drenthe'))).id, 'drenthe');
  is('test_drop_in_the_sea_hits_nothing_at_all', dropTarget(prov, [2.0, 51.0]), null);
  is('test_drop_every_piece_of_every_level_is_right_at_its_own_place',
    LEVELS.every(l => poolFor(l).every(f => isRight(l, f, anchorOf(f)))), true);
  is('test_drop_a_city_pin_a_little_off_still_counts',
    isRight(cities, byId('amsterdam'), [4.95, 52.40]), true);
  is('test_drop_a_city_pin_on_the_neighbouring_city_does_not',
    isRight(cities, byId('amsterdam'), anchorOf(byId('haarlem'))), false);
  is('test_drop_the_nearer_of_two_cities_wins',
    dropTarget(cities, anchorOf(byId('nijmegen'))).id, 'nijmegen');
  is('test_drop_the_nearer_of_two_rivers_wins',
    dropTarget(levelById('water'), anchorOf(byId('waal'))).id, 'waal');
  is('test_drop_a_continent_on_the_right_part_of_the_world',
    isRight(levelById('werelddelen'), byId('af'), [20, 5]), true);
  is('test_drop_a_continent_on_the_wrong_part_of_the_world',
    isRight(levelById('werelddelen'), byId('af'), [100, 40]), false);
  is('test_near_is_tighter_on_the_map_of_the_netherlands_than_on_the_world',
    NEAR.nl < NEAR.world, true);
  is('test_min_span_is_nought_at_home_where_everything_is_big_enough', MIN_SPAN.nl, 0);

  group('Wereldatlas — what a wrong drop teaches');
  is('test_teach_names_what_was_hit_and_says_where_the_right_one_is',
    teachLine(byId('friesland'), byId('drenthe'), true), 'Dat is Drenthe. Friesland ligt hier.');
  is('test_teach_in_english_says_the_same_thing',
    teachLine(byId('friesland'), byId('drenthe'), false), 'That is Drenthe. Friesland is here.');
  is('test_teach_a_drop_in_open_sea_just_points_at_the_place',
    teachLine(byId('friesland'), null, true), 'Friesland ligt hier.');
  is('test_teach_never_says_a_place_missed_itself',
    teachLine(byId('friesland'), byId('friesland'), true), 'Friesland ligt hier.');
  is('test_teach_the_rhine_comes_out_of_switzerland',
    byId('rijn').factNl.includes('Zwitserland'), true);

  group('Wereldatlas — the stars');
  is('test_stars_every_piece_first_time_is_three', starsFor(12, 12), 3);
  is('test_stars_nine_in_ten_is_two', starsFor(9, 10), 2);
  is('test_stars_two_thirds_is_one', starsFor(8, 12), 1);
  is('test_stars_exactly_half_is_still_one', starsFor(6, 12), 1);
  is('test_stars_fewer_than_half_is_none', starsFor(5, 12), 0);
  is('test_stars_a_level_with_no_rounds_earns_none', starsFor(0, 0), 0);
  is('test_views_every_board_has_a_window_onto_the_globe',
    LEVELS.every(l => !!VIEWS[l.board] && VIEWS[l.board].lon1 > VIEWS[l.board].lon0), true);
  is('test_views_europe_is_drawn_with_the_longitudes_squashed', EU_VIEW.kx < 1, true);

  group('Wereldatlas — big enough to hit with a finger');
  // arrange: the map as it comes out on the narrowest phone the house supports, 320 across, where
  // the board gets the width less its margins and rather more height than that
  const phone = { x: 0, y: 0, w: 294, h: 240 };
  const pxPerDegree = l => fit(VIEWS[l.board], phone).s;
  const widthOnScreen = (l, f) => spanOf(f, VIEWS[l.board].kx) * pxPerDegree(l);
  is('test_reach_every_dealt_shape_is_at_least_nine_pixels_across_on_a_320_phone',
    LEVELS.every(l => poolFor(l).every(f => !f.rings?.length || widthOnScreen(l, f) >= 9)), true);
  // the slop around a target is never meaner than the target itself: a shape a finger can only
  // just see is a shape a finger gets a wide berth on
  is('test_reach_no_dealt_shape_is_narrower_than_three_quarters_of_its_boards_forgiveness',
    LEVELS.every(l => poolFor(l).every(f =>
      !f.rings?.length || widthOnScreen(l, f) >= NEAR[l.board] * pxPerDegree(l) * 0.75)), true);
  is('test_reach_the_forgiveness_on_every_board_is_at_least_ten_pixels_wide',
    LEVELS.every(l => NEAR[l.board] * pxPerDegree(l) >= 10), true);
  is('test_reach_the_world_no_longer_deals_out_kenya_at_seven_pixels',
    poolFor(levelById('wereldlanden')).some(f => f.id === 'kenia'), false);
  is('test_reach_the_world_still_deals_out_the_big_ones',
    ['rusland_w', 'china', 'brazilie', 'australie', 'india'].every(id =>
      poolFor(levelById('wereldlanden')).some(f => f.id === id)), true);
  is('test_reach_the_world_pool_is_still_far_longer_than_the_level_it_feeds',
    poolFor(levelById('wereldlanden')).length >= levelById('wereldlanden').rounds * 2, true);
  is('test_reach_the_world_pool_still_reaches_every_continent_that_has_countries_on_it',
    new Set(poolFor(levelById('wereldlanden')).map(f => f.cont)).size >= 5, true);
  is('test_reach_the_world_is_more_forgiving_in_degrees_than_europe', NEAR.world > NEAR.eu, true);

  group('Wereldatlas — the outline switch');
  is('test_outlines_the_provinces_can_be_outlined', outlinable(levelById('provincies')), true);
  is('test_outlines_the_cities_can_be_outlined', outlinable(levelById('steden')), true);
  is('test_outlines_the_rivers_have_nothing_to_outline', outlinable(levelById('water')), false);
  is('test_outlines_the_capitals_have_nothing_to_outline', outlinable(levelById('hoofdsteden')), false);
  is('test_outlines_the_flags_have_nothing_to_outline', outlinable(levelById('vlaggen')), false);
  is('test_outlines_every_level_that_can_be_outlined_hands_out_a_shape_or_a_spot',
    LEVELS.filter(outlinable).every(l => poolFor(l).every(f => !!f.rings?.length || !!f.at)), true);

  group('Wereldatlas — a flag is drawn the way the flag really is');
  is('test_flags_the_swiss_flag_is_square_and_not_a_nordic_cross',
    [byId('zwitserland').flag.kind, byId('zwitserland').flag.square], ['cross', true]);
  is('test_flags_the_nordic_crosses_are_not_square',
    ['zweden', 'noorwegen', 'denemarken', 'finland', 'ijsland']
      .every(id => !byId(id).flag.square), true);
  is('test_flags_the_swiss_flag_is_a_white_cross_on_red',
    [byId('zwitserland').flag.field, byId('zwitserland').flag.cross], ['#d52b1e', '#ffffff']);
  is('test_flags_every_flag_on_the_flag_level_is_big_enough_to_drop_onto',
    poolFor(levelById('vlaggen')).length >= levelById('vlaggen').rounds, true);
  is('test_flags_no_two_countries_on_the_flag_level_share_a_flag',
    new Set(FLAG_COUNTRIES.map(id => JSON.stringify(byId(id).flag))).size, FLAG_COUNTRIES.length);

  group('Wereldatlas — the facts a child would be told twice');
  is('test_facts_south_africa_counts_twelve_official_languages',
    byId('zuidafrika').factNl.includes('twaalf'), true);
  is('test_facts_madagascar_is_not_said_to_have_left_africa_eighty_million_years_ago',
    byId('madagaskar').factNl.includes('los van Afrika'), false);
  is('test_facts_chile_is_described_by_its_average_width',
    byId('chili').factNl.includes('gemiddeld'), true);
  is('test_facts_new_zealand_remembers_the_bats',
    byId('nieuwzeeland').factNl.includes('vleermuizen'), true);
  is('test_facts_utrecht_is_simply_the_smallest_province',
    byId('utrecht').factNl.includes('kleinste provincie van Nederland'), true);
  is('test_facts_every_province_says_something_about_itself',
    PROVINCES.every(p => p.factNl.includes(p.nl.split('-').pop()) || p.factNl.length > 40), true);
  is('test_facts_no_fact_is_longer_than_the_card_can_hold',
    ALL_FEATURES.every(f => f.factNl.length <= 175 && f.factEn.length <= 175), true);

  group('Wereldatlas — a capital belongs to a country');
  is('test_capitals_every_capital_on_the_capitals_level_belongs_to_one_country',
    poolFor(levelById('hoofdsteden')).every(c =>
      EU_COUNTRIES.filter(o => o.capNl === c.capNl).length === 1), true);
  is('test_capitals_no_capital_is_also_the_name_of_a_different_country',
    EU_COUNTRIES.every(c => !EU_COUNTRIES.some(o => o.id !== c.id && o.nl === c.capNl)), true);
  is('test_capitals_the_world_names_a_real_capital_for_every_country',
    WORLD_COUNTRIES.every(c => c.capNl.length > 2 && c.capEn.length > 2), true);
  is('test_capitals_a_country_that_appears_twice_names_the_same_capital_both_times',
    WORLD_COUNTRIES.filter(c => EU_COUNTRIES.some(e => e.nl === c.nl))
      .every(c => EU_COUNTRIES.find(e => e.nl === c.nl).capNl === c.capNl), true);
  is('test_capitals_the_dutch_and_english_capital_are_told_apart',
    [capitalOf(byId('belgie'), true), capitalOf(byId('belgie'), false)], ['Brussel', 'Brussels']);
}

// ---------------------------------------------------------------- Stroomkring: what the circuit does

{
  const c = await bundle('src/games/circuit/sim.ts', 'circuit.mjs');
  const {
    solve, advance, renew, layWire, marksOf, faultOf, faultLine, cleanCircuit, netlist,
    canPlace, cellsOf, pinsOf, partAt, battVolts, chargeFrac, isSolved, startBoard,
    PARTS, PUZZLES, specOf, BATTERY_CHARGE, FUSE_BLOWS_AT, SHORT_AMPS, LED_VF, CAP_FARADS, COLS, ROWS,
  } = c;

  /** a part, the way the game writes one down */
  const put = (id, col, row, rot = 0, extra = {}) => ({ id, col, row, rot, ...extra });
  /** draw a line of wire through these cells, one square at a time, the way a finger does */
  const line = (board, cells) => {
    let prev;
    for (const cell of cells) {
      while (prev && (prev[0] !== cell[0] || prev[1] !== cell[1])) {
        const dc = Math.sign(cell[0] - prev[0]), dr = Math.sign(cell[1] - prev[1]);
        const step = dc !== 0 ? [prev[0] + dc, prev[1]] : [prev[0], prev[1] + dr];
        layWire(board, step[0], step[1], prev);
        prev = step;
      }
      if (!prev) { layWire(board, cell[0], cell[1]); prev = cell; }
    }
    return board;
  };
  const r3 = x => Math.round(x * 1000) / 1000;
  const r2 = x => Math.round(x * 100) / 100;
  /** the loop every test below is built on: a battery at 2,2 and one thing at 6,2 */
  const loop = (id, rot = 0, extra = {}) => {
    const b = [put('battery', 2, 2), put(id, 6, 2, rot, extra)];
    line(b, [[3, 2], [4, 2], [5, 2]]);
    line(b, [[7, 2], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [1, 2]]);
    return b;
  };
  /** let the clock run on a board in steps small enough for the solver to follow */
  const run = (board, seconds, step = 0.05) => {
    let last = null;
    for (let t = 0; t < seconds; t += step) {
      last = solve(board, false);
      advance(board, last, step);
    }
    return last ?? solve(board, false);
  };

  group('Stroomkring — a wire put down with a tap');
  // a wire is joined along the faces the line was drawn through, so one tapped down on its own is
  // joined to nothing: it looks like wire and behaves like a gap, and the game has to say which
  {
    const tapped = [put('battery', 2, 2), put('bulb', 6, 2), put('wire', 3, 2), put('wire', 4, 2)];
    const f = faultOf(tapped, solve(tapped, false));
    is('test_stray_a_tapped_wire_is_named_as_stray', f.kind, 'stray');
    is('test_stray_it_points_at_the_first_unjoined_wire', tapped[f.at].id, 'wire');
    is('test_stray_the_dutch_line_says_to_drag_the_line',
      faultLine(f, true).includes('met je vinger'), true);
    is('test_stray_the_english_line_says_to_drag_the_line',
      faultLine(f, false).includes('Drag the line'), true);
    const drawn = loop('bulb');
    is('test_stray_a_drawn_loop_is_never_stray', faultOf(drawn, solve(drawn, false)), null);
    const half = [put('battery', 2, 2), put('bulb', 6, 2)];
    line(half, [[3, 2], [4, 2], [5, 2]]);
    is('test_stray_a_half_drawn_loop_is_a_gap_and_not_stray',
      faultOf(half, solve(half, false)).kind, 'gap');
  }

  group('Stroomkring — the parts themselves');
  is('test_parts_there_are_fourteen_of_them', PARTS.length, 14);
  is('test_parts_ids_are_unique', new Set(PARTS.map(p => p.id)).size, PARTS.length);
  is('test_parts_all_have_both_languages',
    PARTS.every(p => p.name && p.nameNl && p.note && p.noteNl), true);
  is('test_parts_every_one_has_a_resistance', PARTS.every(p => p.r > 0), true);
  is('test_parts_only_the_sources_push', PARTS.filter(p => p.volts > 0).map(p => p.id), ['battery', 'solar']);
  is('test_parts_a_source_has_resistance_inside_it',
    PARTS.filter(p => p.volts > 0).every(p => p.rIn > 0), true);
  is('test_parts_the_solar_cell_is_weaker_than_the_battery',
    specOf('solar').volts < specOf('battery').volts, true);
  is('test_parts_only_the_crocodile_lead_covers_two_cells',
    PARTS.filter(p => p.len === 2).map(p => p.id), ['clip']);

  group('Stroomkring — how parts are joined');
  is('test_join_a_part_points_terminal_a_west_when_it_lies_flat',
    pinsOf(put('bulb', 3, 3)).filter(t => t.label === 'A')[0].face, 3);
  is('test_join_turning_it_a_quarter_puts_terminal_a_at_the_top',
    pinsOf(put('bulb', 3, 3, 1)).filter(t => t.label === 'A')[0].face, 0);
  is('test_join_a_wire_has_a_terminal_on_every_face', pinsOf(put('wire', 3, 3)).length, 4);
  is('test_join_a_relay_has_four_terminals', pinsOf(put('relay', 3, 3)).length, 4);
  is('test_join_a_relay_keeps_its_coil_and_its_contacts_on_opposite_corners',
    pinsOf(put('relay', 3, 3)).map(t => t.face), [3, 0, 1, 2]);
  is('test_join_a_crocodile_lead_covers_the_cell_beside_it',
    cellsOf(put('clip', 3, 3)), [[3, 3], [4, 3]]);
  is('test_join_two_lines_side_by_side_do_not_touch', (() => {
    const b = [];
    line(b, [[1, 1], [2, 1], [3, 1]]);
    line(b, [[1, 2], [2, 2], [3, 2]]);
    const net = netlist(b);
    // six lengths of wire, and the two runs never meet: three nodes each end, none shared
    return net.nodes > 6;
  })(), true);
  is('test_join_a_line_drawn_into_another_makes_a_branch', (() => {
    const b = [];
    line(b, [[1, 1], [2, 1], [3, 1]]);
    line(b, [[2, 1], [2, 2]]);
    return (b.find(p => p.col === 2 && p.row === 1).link & (1 << 2)) !== 0;
  })(), true);
  is('test_join_a_part_may_not_sit_on_another_part',
    canPlace([put('bulb', 3, 3)], put('motor', 3, 3)), false);
  is('test_join_a_part_may_not_hang_off_the_board',
    canPlace([], put('bulb', COLS, 1)), false);
  is('test_join_a_lead_needs_both_of_its_cells_free',
    canPlace([put('bulb', 4, 3)], put('clip', 3, 3)), false);
  is('test_join_which_part_is_on_a_cell', partAt([put('clip', 3, 3)], 4, 3), 0);

  group('Stroomkring — an open loop and a closed one');
  {
    const open = [put('battery', 2, 2), put('bulb', 6, 2)];
    line(open, [[3, 2], [4, 2], [5, 2]]);
    const s = solve(open);
    is('test_open_loop_carries_no_current', r3(s.drawn), 0);
    is('test_open_loop_leaves_the_bulb_dark', r3(s.parts[1].duty), 0);
    is('test_open_loop_names_the_gap', s.fault.kind, 'gap');
    is('test_open_loop_points_at_the_loose_end', open[s.fault.at].id, 'bulb');
    is('test_open_loop_says_so_in_dutch', faultLine(s.fault, true), 'Hier zit een gat in de kring.');
    is('test_open_loop_says_so_in_english', faultLine(s.fault, false), 'There is a gap in the loop here.');
  }
  {
    const b = [put('battery', 2, 2)];
    const s = solve(b);
    is('test_lone_battery_is_not_a_gap_but_a_loose_battery', s.fault.kind, 'loose');
  }
  is('test_empty_board_has_nothing_to_complain_about', solve([]).fault, null);
  is('test_board_with_no_source_says_there_is_no_battery',
    solve([put('bulb', 2, 2)]).fault.kind, 'nosource');
  {
    const closed = loop('bulb');
    const s = solve(closed);
    is('test_closed_loop_has_nothing_wrong_with_it', s.fault, null);
    // one bulb straight across a fresh cell: 4.5 V over 12 ohm plus half an ohm inside the battery
    is('test_closed_loop_carries_the_current_ohms_law_says', r3(s.drawn), 0.356);
    // the line of wire has a resistance of its own, so the reading is a whisker under the sum
    is('test_closed_loop_is_within_two_percent_of_the_textbook_sum',
      Math.abs(s.drawn - 4.5 / 12.5) / (4.5 / 12.5) < 0.02, true);
    is('test_closed_loop_burns_the_bulb_at_nearly_full_power', r2(s.parts[1].duty), 0.98);
    is('test_closed_loop_marks_the_bulb_as_lit', marksOf(closed, s).includes('lit'), true);
  }

  group('Stroomkring — two bulbs in series and two in parallel');
  {
    const series = [put('battery', 2, 2), put('bulb', 5, 2), put('bulb', 6, 2)];
    line(series, [[3, 2], [4, 2]]);
    line(series, [[7, 2], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [1, 2]]);
    const s = solve(series);
    // one current through both: 4.5 V over 24 ohm and a bit, which is half what one bulb draws
    is('test_series_two_bulbs_share_one_current', r3(Math.abs(s.parts[1].i)), 0.183);
    is('test_series_current_is_within_two_percent_of_the_textbook_sum',
      Math.abs(Math.abs(s.parts[1].i) - 4.5 / 24.5) / (4.5 / 24.5) < 0.02, true);
    is('test_series_both_bulbs_carry_exactly_the_same_current',
      r3(s.parts[1].i), r3(s.parts[2].i));
    is('test_series_each_bulb_gets_about_a_quarter_of_its_power', r2(s.parts[1].duty), 0.26);
    is('test_series_two_bulbs_are_both_counted_as_lit', marksOf(series, s).includes('twolit'), true);
    is('test_series_two_bulbs_are_not_counted_as_bright',
      marksOf(series, s).includes('twobright'), false);

    const parallel = [put('battery', 2, 2), put('bulb', 5, 1, 1), put('bulb', 5, 4, 1)];
    line(parallel, [[3, 2], [4, 2], [5, 2], [5, 3]]);
    line(parallel, [[5, 0], [4, 0], [3, 0], [2, 0], [1, 0], [1, 1], [1, 2]]);
    line(parallel, [[5, 5], [4, 5], [3, 5], [2, 5], [1, 5], [1, 4], [1, 3], [1, 2]]);
    const p = solve(parallel);
    is('test_parallel_each_bulb_gets_its_own_current',
      r3(Math.abs(p.parts[1].i)) > r3(Math.abs(s.parts[1].i)) * 1.8, true);
    is('test_parallel_each_bulb_burns_at_nearly_full_power',
      p.parts[1].duty > 0.85 && p.parts[2].duty > 0.85, true);
    is('test_parallel_both_bulbs_count_as_bright',
      marksOf(parallel, p).includes('twobright'), true);
    is('test_parallel_the_battery_gives_out_about_twice_as_much',
      p.drawn > s.drawn * 3.5, true);
    is('test_parallel_taking_one_branch_out_leaves_the_other_lit', (() => {
      const cut = parallel.filter(q => !(q.id === 'wire' && q.col === 5 && q.row === 0));
      const after = solve(cut);
      const m = marksOf(cut, after);
      return m.includes('onelitonedark');
    })(), true);
  }

  group('Stroomkring — a switch, a button and a relay');
  {
    const off = [put('battery', 2, 2), put('bulb', 6, 2), put('switch', 4, 4)];
    line(off, [[3, 2], [4, 2], [5, 2]]);
    line(off, [[7, 2], [7, 4], [6, 4], [5, 4]]);
    line(off, [[3, 4], [2, 4], [1, 4], [1, 2]]);
    const s = solve(off);
    is('test_switch_open_stops_the_current', r3(s.drawn), 0);
    is('test_switch_open_is_named_as_the_trouble', s.fault.kind, 'switchoff');
    is('test_switch_open_points_at_the_switch_itself', off[s.fault.at].id, 'switch');
    is('test_switch_open_says_so_in_dutch', faultLine(s.fault, true), 'Deze schakelaar staat uit.');
    off[2].on = true;
    const on = solve(off);
    is('test_switch_closed_lets_the_current_through', r3(on.drawn), 0.356);
    is('test_switch_closed_has_nothing_wrong_with_it', on.fault, null);

    const bell = [put('battery', 2, 2), put('buzzer', 6, 2), put('button', 4, 4)];
    line(bell, [[3, 2], [4, 2], [5, 2]]);
    line(bell, [[7, 2], [7, 4], [6, 4], [5, 4]]);
    line(bell, [[3, 4], [2, 4], [1, 4], [1, 2]]);
    const quiet = solve(bell);
    is('test_button_let_go_leaves_the_buzzer_silent', r3(quiet.parts[1].duty), 0);
    is('test_button_let_go_is_marked_as_quiet',
      marksOf(bell, quiet).includes('quietwhenlet'), true);
    bell[2].on = true;
    const held = solve(bell);
    is('test_button_held_down_makes_the_buzzer_sound', held.parts[1].duty > 0.8, true);
    is('test_button_held_down_is_marked_as_buzzing_while_held',
      marksOf(bell, held).includes('buzzheld'), true);
  }
  {
    // the little circuit on the left, the big one on the right, sharing only the relay
    const rly = [put('relay', 4, 2), put('battery', 1, 2), put('battery', 6, 3, 1), put('bulb', 6, 4, 1)];
    line(rly, [[2, 2], [3, 2]]);
    line(rly, [[4, 1], [4, 0], [3, 0], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2]]);
    line(rly, [[5, 2], [6, 2]]);
    line(rly, [[6, 5], [5, 5], [4, 5], [4, 4], [4, 3]]);
    const s = solve(rly);
    is('test_relay_the_coil_pulls_when_its_own_loop_is_closed', s.parts[0].on, true);
    is('test_relay_pulling_closes_the_second_loop', Math.abs(s.parts[0].i2) > 0.1, true);
    is('test_relay_the_second_loop_lights_its_bulb', s.parts[3].duty > 0.9, true);
    is('test_relay_is_marked_as_switching_the_other_circuit',
      marksOf(rly, s).includes('relayon'), true);
    const flat = rly.map((p, i) => (i === 1 ? { ...p, charge: 0 } : { ...p }));
    const after = solve(flat);
    is('test_relay_with_a_flat_coil_battery_drops_out', after.parts[0].on, false);
    is('test_relay_dropping_out_puts_the_second_loop_out', r3(after.parts[3].duty), 0);
  }

  group('Stroomkring — the LED and the motor care which way round they are');
  {
    const back = solve(loop('led', 0));
    is('test_led_backwards_passes_no_current', r3(back.parts[1].i), 0);
    is('test_led_backwards_stays_dark', back.parts[1].on, false);
    is('test_led_backwards_is_named_as_the_trouble', back.fault.kind, 'ledback');
    is('test_led_backwards_says_so_in_dutch', faultLine(back.fault, true), 'De led zit achterstevoren.');
    const b = loop('led', 2);
    const fwd = solve(b);
    is('test_led_the_right_way_round_lights', fwd.parts[1].on, true);
    is('test_led_the_right_way_round_has_nothing_wrong_with_it', fwd.fault, null);
    // 4.5 V less the 1.8 V the diode swallows, over 20 ohm and the half inside the battery
    is('test_led_the_right_way_round_carries_the_current_the_sum_says', r3(fwd.parts[1].i), 0.131);
    is('test_led_swallows_its_forward_volts_before_it_conducts',
      r2(fwd.parts[1].v - fwd.parts[1].i * specOf('led').r), r2(LED_VF));
    is('test_led_marks_both_ways_round_once_both_have_been_seen',
      [...marksOf(b, fwd), ...marksOf(loop('led', 0), back)].sort().join(','), 'ledback,ledon');

    const one = solve(loop('motor', 0));
    const other = solve(loop('motor', 2));
    is('test_motor_turned_round_runs_the_other_way',
      Math.sign(one.parts[1].i), -Math.sign(other.parts[1].i));
    is('test_motor_turned_round_works_just_as_hard',
      r3(Math.abs(one.parts[1].i)), r3(Math.abs(other.parts[1].i)));
    is('test_motor_one_way_is_marked_as_running_forwards',
      marksOf(loop('motor', 2), other).includes('motorfwd'), true);
    is('test_motor_the_other_way_is_marked_as_running_backwards',
      marksOf(loop('motor', 0), one).includes('motorback'), true);
  }

  group('Stroomkring — a short circuit, and the fuse that stops it');
  {
    const short = [put('battery', 2, 2)];
    line(short, [[3, 2], [3, 3], [2, 3], [1, 3], [1, 2]]);
    const s = solve(short);
    // 4.5 V over the half ohm inside the cell and a little copper: about nine amps
    is('test_short_circuit_draws_many_amps', r2(s.drawn), 8.18);
    is('test_short_circuit_is_over_the_line_that_counts_as_one', s.drawn > SHORT_AMPS, true);
    is('test_short_circuit_is_named_as_a_short', s.fault.kind, 'short');
    is('test_short_circuit_says_so_in_english',
      faultLine(s.fault, false), 'This is a short circuit: the current goes round everything.');
    is('test_short_circuit_is_marked', marksOf(short, s).includes('shorted'), true);

    const fused = [put('battery', 2, 2), put('fuse', 4, 2)];
    line(fused, [[3, 2]]);
    line(fused, [[5, 2], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [1, 2]]);
    const before = solve(fused);
    is('test_fuse_carries_far_more_than_it_is_built_for_for_an_instant',
      Math.abs(before.parts[1].i) > FUSE_BLOWS_AT, true);
    is('test_fuse_is_told_to_melt', before.blew, [1]);
    advance(fused, before, 0.05);
    is('test_fuse_has_melted', fused[1].blown, true);
    const after = solve(fused);
    is('test_fuse_that_has_melted_stops_the_current', r3(after.drawn), 0);
    is('test_fuse_that_has_melted_is_named_as_the_trouble', after.fault.kind, 'fuse');
    is('test_fuse_that_has_melted_is_marked', marksOf(fused, after).includes('fuseblew'), true);
    renew(fused);
    is('test_fuse_gets_a_new_thread_when_the_bench_is_renewed', fused[1].blown, false);

    const safe = [put('battery', 2, 2), put('fuse', 4, 2), put('bulb', 6, 2)];
    line(safe, [[3, 2]]);
    line(safe, [[5, 2]]);
    line(safe, [[7, 2], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [1, 2]]);
    const ok = solve(safe);
    is('test_fuse_leaves_an_ordinary_circuit_alone', ok.blew, []);
    is('test_fuse_in_an_ordinary_circuit_hardly_notices', ok.parts[1].duty < 0.3, true);
  }

  group('Stroomkring — what the battery spends');
  is('test_battery_a_fresh_one_pushes_its_full_volts', battVolts(1), specOf('battery').volts);
  is('test_battery_sags_as_it_empties', battVolts(0.3) < battVolts(1), true);
  is('test_battery_an_empty_one_pushes_nothing', battVolts(0), 0);
  is('test_battery_a_negative_charge_still_pushes_nothing', battVolts(-1), 0);
  {
    const one = loop('bulb');
    run(one, 10);
    const spentOne = BATTERY_CHARGE - one[0].charge;
    is('test_drain_one_bulb_for_ten_seconds_spends_what_it_drew', r2(spentOne), 3.53);

    const series = [put('battery', 2, 2), put('bulb', 5, 2), put('bulb', 6, 2)];
    line(series, [[3, 2], [4, 2]]);
    line(series, [[7, 2], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [1, 2]]);
    run(series, 10);
    const spentSeries = BATTERY_CHARGE - series[0].charge;
    is('test_drain_two_bulbs_in_series_last_about_twice_as_long',
      r2(spentOne / spentSeries), 1.94);

    const parallel = [put('battery', 2, 2), put('bulb', 5, 1, 1), put('bulb', 5, 4, 1)];
    line(parallel, [[3, 2], [4, 2], [5, 2], [5, 3]]);
    line(parallel, [[5, 0], [4, 0], [3, 0], [2, 0], [1, 0], [1, 1], [1, 2]]);
    line(parallel, [[5, 5], [4, 5], [3, 5], [2, 5], [1, 5], [1, 4], [1, 3], [1, 2]]);
    run(parallel, 10);
    const spentParallel = BATTERY_CHARGE - parallel[0].charge;
    is('test_drain_two_bulbs_in_parallel_cost_nearly_four_times_a_series_pair',
      r2(spentParallel / spentSeries), 3.71);
    is('test_drain_a_wasteful_circuit_empties_the_battery_sooner', spentParallel > spentOne, true);

    const short = [put('battery', 2, 2)];
    line(short, [[3, 2], [3, 3], [2, 3], [1, 3], [1, 2]]);
    run(short, 20);
    is('test_drain_a_short_circuit_empties_the_battery_in_seconds', r2(chargeFrac(short[0])), 0);
    is('test_drain_an_empty_battery_is_named_as_the_trouble', solve(short).fault.kind, 'flat');
    renew(short);
    is('test_drain_a_new_battery_is_full_again', chargeFrac(short[0]), 1);
  }

  group('Stroomkring — the solar cell and the capacitor');
  {
    const sun = [put('solar', 2, 2), put('bulb', 6, 2)];
    line(sun, [[3, 2], [4, 2], [5, 2]]);
    line(sun, [[7, 2], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [1, 2]]);
    const s = solve(sun);
    is('test_solar_lights_a_bulb_but_not_as_brightly', s.parts[1].duty > 0.2 && s.parts[1].duty < 0.7, true);
    is('test_solar_never_runs_out', sun[0].charge, undefined);
    run(sun, 5);
    is('test_solar_still_never_runs_out_after_a_while', solve(sun).parts[1].duty > 0.2, true);

    const cap = [put('battery', 2, 2), put('switch', 4, 2, 0, { on: true }), put('cap', 6, 2, 2)];
    line(cap, [[3, 2]]);
    line(cap, [[5, 2]]);
    line(cap, [[7, 2], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [1, 2]]);
    is('test_capacitor_starts_empty', cap[2].charge ?? 0, 0);
    run(cap, 3);
    const volts = (cap[2].charge ?? 0) / CAP_FARADS;
    is('test_capacitor_fills_up_to_about_the_battery_volts', volts > 4 && volts < 4.6, true);
  }

  group('Stroomkring — the ten puzzles');
  is('test_puzzles_there_are_ten_of_them', PUZZLES.length, 10);
  is('test_puzzles_ids_are_unique', new Set(PUZZLES.map(p => p.id)).size, PUZZLES.length);
  is('test_puzzles_all_have_both_languages',
    PUZZLES.every(p => p.goal && p.goalNl && p.hint && p.hintNl), true);
  is('test_puzzles_every_opening_board_fits_on_the_bench',
    PUZZLES.every(p => p.start.every(q => canPlace(p.start.filter(o => o !== q), q))), true);
  is('test_puzzles_every_opening_board_is_inside_the_grid',
    PUZZLES.every(p => p.start.every(q => cellsOf(q).every(([x, y]) => x >= 0 && x < COLS && y >= 0 && y < ROWS))), true);
  is('test_puzzles_every_part_on_an_opening_board_is_a_real_part',
    PUZZLES.every(p => p.start.every(q => PARTS.some(s => s.id === q.id))), true);
  is('test_puzzles_the_wire_is_on_every_shelf', PUZZLES.every(p => p.tray.includes('wire')), true);
  is('test_puzzles_the_last_one_is_the_open_bench', PUZZLES[PUZZLES.length - 1].free, true);
  is('test_puzzles_the_open_bench_offers_every_part',
    PUZZLES[PUZZLES.length - 1].tray.length, PARTS.length);
  is('test_puzzles_only_the_bench_asks_for_nothing',
    PUZZLES.filter(p => p.needs.length === 0).map(p => p.id), ['bench']);
  is('test_puzzles_are_not_finished_before_their_marks_are_seen',
    isSolved(PUZZLES[0], new Set()), false);
  is('test_puzzles_are_finished_once_every_mark_is_seen',
    isSolved(PUZZLES[0], new Set(['lit'])), true);
  is('test_puzzles_half_the_marks_is_not_enough',
    isSolved(PUZZLES[1], new Set(['lit'])), false);
  is('test_puzzles_the_open_bench_is_never_finished',
    isSolved(PUZZLES[PUZZLES.length - 1], new Set(['lit'])), false);
  is('test_puzzles_a_fresh_opening_board_is_a_copy', (() => {
    const a = startBoard(PUZZLES[0]);
    a[0].col = 8;
    return startBoard(PUZZLES[0])[0].col;
  })(), PUZZLES[0].start[0].col);
  is('test_puzzles_a_fresh_opening_board_has_a_full_battery',
    startBoard(PUZZLES[0]).filter(p => p.id === 'battery').every(p => p.charge === BATTERY_CHARGE), true);

  group('Stroomkring — a board out of a save nobody wrote');
  is('test_clean_an_empty_board_is_fine', cleanCircuit([]), []);
  is('test_clean_a_sound_board_comes_back_whole',
    cleanCircuit([{ id: 'bulb', col: 2, row: 2, rot: 0 }]).length, 1);
  is('test_clean_rubbish_is_thrown_away', cleanCircuit('nonsense'), null);
  is('test_clean_a_part_that_does_not_exist_is_thrown_away',
    cleanCircuit([{ id: 'flux-capacitor', col: 2, row: 2, rot: 0 }]), null);
  is('test_clean_a_part_off_the_board_is_thrown_away',
    cleanCircuit([{ id: 'bulb', col: 99, row: 2, rot: 0 }]), null);
  is('test_clean_two_parts_on_one_cell_are_thrown_away',
    cleanCircuit([{ id: 'bulb', col: 2, row: 2, rot: 0 }, { id: 'motor', col: 2, row: 2, rot: 0 }]), null);
  is('test_clean_a_silly_rotation_is_brought_back_into_range',
    cleanCircuit([{ id: 'bulb', col: 2, row: 2, rot: 17 }])[0].rot, 1);
  is('test_clean_a_negative_rotation_is_brought_back_into_range',
    cleanCircuit([{ id: 'bulb', col: 2, row: 2, rot: -1 }])[0].rot, 3);
  is('test_clean_a_lead_only_lies_two_ways',
    cleanCircuit([{ id: 'clip', col: 2, row: 2, rot: 3 }])[0].rot, 1);
  is('test_clean_a_battery_cannot_hold_more_than_a_full_one',
    cleanCircuit([{ id: 'battery', col: 2, row: 2, rot: 0, charge: 1e9 }])[0].charge, BATTERY_CHARGE);
  is('test_clean_a_wire_keeps_the_line_it_was_drawn_with',
    cleanCircuit([{ id: 'wire', col: 2, row: 2, rot: 0, link: 5 }])[0].link, 5);
  is('test_clean_a_wire_with_a_silly_link_is_brought_back_into_range',
    cleanCircuit([{ id: 'wire', col: 2, row: 2, rot: 0, link: 999 }])[0].link, 15);
  is('test_clean_a_board_bigger_than_the_bench_is_thrown_away',
    cleanCircuit(Array.from({ length: 200 }, (_, i) => ({ id: 'wire', col: i % 9, row: 0, rot: 0 }))), null);

  group('Stroomkring — the save slice a hand could have edited');
  {
    const { loadSave } = await bundle('src/util/storage.ts', 'storage.mjs');
    const KEY = 'cloudhopper.save.v1';
    const kept = fakeStore[KEY];
    /** write a save, read it back the way the game does, and hand back only Stroomkring's slice */
    const slice = written => { fakeStore[KEY] = JSON.stringify(written); return loadSave().circuit; };

    is('test_save_a_file_with_no_circuit_slice_comes_back_with_the_defaults',
      slice({ sound: true }), { solved: [], puzzle: 0, bench: [] });
    is('test_save_a_sound_circuit_slice_comes_back_whole',
      slice({ circuit: { solved: ['light', 'switch'], puzzle: 3, bench: [] } }),
      { solved: ['light', 'switch'], puzzle: 3, bench: [] });
    // a string here used to be read a letter at a time, and the chip said eight of nine were done
    is('test_save_a_list_of_finished_puzzles_that_is_not_a_list_is_thrown_away',
      slice({ circuit: { solved: 'nonsense' } }).solved, []);
    is('test_save_a_finished_puzzle_that_is_not_a_name_is_dropped',
      slice({ circuit: { solved: ['light', 7, null, 'switch'] } }).solved, ['light', 'switch']);
    is('test_save_a_puzzle_number_that_is_not_a_number_falls_back_to_the_first',
      slice({ circuit: { puzzle: 'three' } }).puzzle, 0);
    is('test_save_a_puzzle_number_that_is_not_finite_falls_back_to_the_first',
      slice({ circuit: { puzzle: Infinity } }).puzzle, 0);
    is('test_save_a_bench_that_is_not_a_list_is_thrown_away',
      slice({ circuit: { bench: 'nonsense' } }).bench, []);
    is('test_save_a_bench_of_rubbish_survives_the_slice_and_dies_in_the_board_check',
      cleanCircuit(slice({ circuit: { bench: [{ id: 'flux', col: -5, row: 400 }] } }).bench), null);
    is('test_save_a_file_that_is_not_json_at_all_comes_back_with_the_defaults',
      (() => { fakeStore[KEY] = '{ not json'; return loadSave().circuit; })(),
      { solved: [], puzzle: 0, bench: [] });

    if (kept === undefined) delete fakeStore[KEY]; else fakeStore[KEY] = kept;
  }
}

// ---------------------------------------------------------------- The platform: how hard to make it next

{
  const { scoreOf, updateMastery, nextStep, knobsFor, record, masteryOf, cleanBook, FRESH, SWEET_SPOT, SKILLS,
    cleanTopics, recordTopic, topicOf, pickNext } =
    await bundle('src/platform/skill.ts', 'skill.mjs');

  /** one attempt, written the way a game reports one */
  const go = (over = {}) => ({ correct: true, ms: 3000, parMs: 5000, hints: 0, tries: 1, ...over });
  /** put a run of attempts through a fresh skill and hand back where it ended up */
  const run = (list) => list.reduce((m, a) => updateMastery(m, a), { ...FRESH });

  group('Platform — how well one answer went');
  is('test_score_a_wrong_answer_is_worth_nothing', scoreOf(go({ correct: false })), 0);
  is('test_score_quick_and_clean_is_the_top_mark', scoreOf(go({ ms: 1000 })), 1);
  is('test_score_slow_but_right_is_worth_less_than_quick',
    scoreOf(go({ ms: 9000 })) < scoreOf(go({ ms: 1000 })), true);
  is('test_score_help_taken_is_worth_less_than_none',
    scoreOf(go({ hints: 1 })) < scoreOf(go({ hints: 0 })), true);
  is('test_score_third_go_is_worth_less_than_first',
    scoreOf(go({ tries: 3 })) < scoreOf(go({ tries: 1 })), true);
  is('test_score_never_leaves_the_nought_to_one_range',
    [go(), go({ ms: 60000 }), go({ hints: 9 }), go({ tries: 9 })].every(a => scoreOf(a) >= 0 && scoreOf(a) <= 1), true);

  group('Platform — the ground under a skill');
  is('test_mastery_starts_barely_above_nothing', FRESH.level < 0.15, true);
  is('test_mastery_a_clean_run_climbs', run([go(), go(), go(), go(), go()]).level > FRESH.level, true);
  is('test_mastery_a_run_of_misses_falls',
    run([go({ correct: false }), go({ correct: false }), go({ correct: false })]).level < FRESH.level, true);
  is('test_mastery_counts_every_answer', run([go(), go({ correct: false }), go()]).seen, 3);
  is('test_mastery_a_streak_is_clean_answers_in_a_row', run([go(), go(), go()]).streak, 3);
  is('test_mastery_help_breaks_the_streak', run([go(), go(), go({ hints: 1 })]).streak, 0);
  is('test_mastery_a_wrong_answer_breaks_the_streak', run([go(), go(), go({ correct: false })]).streak, 0);
  is('test_mastery_a_right_answer_clears_the_slump', run([go({ correct: false }), go()]).slump, 0);
  is('test_mastery_never_leaves_the_nought_to_one_range',
    run(Array(40).fill(go())).level <= 1 && run(Array(40).fill(go({ correct: false }))).level >= 0, true);
  // the point of the whole thing: four right out of five leaves a child where they are
  {
    const steady = [go(), go(), go(), go({ correct: false }), go(), go(), go(), go({ correct: false }), go(), go()];
    const m = run(steady);
    is('test_mastery_answering_at_the_sweet_spot_holds_roughly_still',
      Math.abs(m.level - FRESH.level) < 0.3, true);
  }

  group('Platform — what to ask next');
  is('test_step_two_wrong_in_a_row_builds_a_bridge_rather_than_starting_over',
    nextStep(run([go(), go(), go({ correct: false }), go({ correct: false })])).move, 'bridge');
  is('test_step_a_bridge_is_easier_than_where_the_child_is',
    (() => { const m = { ...FRESH, level: 0.5, slump: 2 };
      return nextStep(m).difficulty < m.level; })(), true);
  is('test_step_a_bridge_at_the_very_bottom_cannot_go_below_it',
    nextStep({ ...FRESH, level: 0, slump: 2 }).difficulty, 0);
  is('test_step_three_quick_clean_answers_stretch_rather_than_creep',
    nextStep(run([go({ ms: 900 }), go({ ms: 900 }), go({ ms: 900 })]),
      [go({ ms: 900 }), go({ ms: 900 }), go({ ms: 900 })]).move, 'stretch');
  // right, but slowly: that is a child keeping up rather than one running ahead
  is('test_step_a_good_but_unhurried_run_goes_up',
    nextStep({ ...FRESH, level: 0.4 }, [go({ ms: 6000 }), go({ ms: 6000 }), go({ ms: 6000 }), go({ ms: 6000 })]).move, 'up');
  is('test_step_a_mixed_run_holds',
    nextStep({ ...FRESH, level: 0.5 }, [go(), go({ correct: false }), go(), go({ correct: false })]).move, 'hold');
  is('test_step_difficulty_never_leaves_the_nought_to_one_range',
    [0, 0.5, 1].every(l => { const s = nextStep({ ...FRESH, level: l, streak: 9 }, [go(), go(), go()]);
      return s.difficulty >= 0 && s.difficulty <= 1; }), true);

  group('Platform — one dial, many knobs');
  const cap = { elements: 9, steps: 5 };
  is('test_knobs_the_gentlest_setting_puts_one_thing_on_screen', knobsFor(0, cap).elements, 1);
  is('test_knobs_the_gentlest_setting_is_one_step', knobsFor(0, cap).steps, 1);
  is('test_knobs_the_gentlest_setting_has_no_near_misses', knobsFor(0, cap).distractors, 0);
  is('test_knobs_the_hardest_setting_fills_the_screen', knobsFor(1, cap).elements, cap.elements);
  is('test_knobs_the_hardest_setting_takes_every_step', knobsFor(1, cap).steps, cap.steps);
  is('test_knobs_things_on_screen_never_go_down_as_it_gets_harder',
    [0, 0.2, 0.4, 0.6, 0.8, 1].every((d, i, a) => i === 0 || knobsFor(d, cap).elements >= knobsFor(a[i - 1], cap).elements), true);
  is('test_knobs_no_near_misses_at_all_at_the_very_start', knobsFor(0.15, cap).distractors, 0);
  is('test_knobs_near_misses_arrive_later_than_more_things',
    knobsFor(0.25, cap).distractors < 0.1 && knobsFor(0.25, cap).elements > 1, true);
  is('test_knobs_speed_only_ever_rises', knobsFor(1, cap).speed > knobsFor(0, cap).speed, true);

  group('Platform — the book of skills');
  is('test_book_an_unseen_skill_starts_fresh', masteryOf({}, 'number').level, FRESH.level);
  is('test_book_recording_leaves_the_other_skills_alone',
    Object.keys(record({ language: { ...FRESH } }, 'number', go())).sort(), ['language', 'number']);
  is('test_book_a_corrupt_save_opens_empty', cleanBook('nonsense'), {});
  is('test_book_a_half_written_skill_is_dropped', cleanBook({ number: { level: 'x' } }), {});
  is('test_book_a_level_out_of_range_is_pulled_back_in',
    cleanBook({ number: { level: 9, seen: 3 } }).number.level, 1);
  is('test_book_every_skill_name_is_unique', new Set(SKILLS).size, SKILLS.length);
  is('test_book_the_sweet_spot_is_four_out_of_five', SWEET_SPOT > 0.7 && SWEET_SPOT < 0.85, true);

  group('Platform — a book per subject');
  is('test_topics_an_untouched_subject_starts_fresh', topicOf({}, 'tafels').level, FRESH.level);
  is('test_topics_recording_one_leaves_the_others_alone',
    Object.keys(recordTopic({ erbij: { ...FRESH } }, 'tafels', go())).sort(), ['erbij', 'tafels']);
  is('test_topics_a_subject_the_game_no_longer_has_is_dropped',
    Object.keys(cleanTopics({ erbij: { level: 0.5 }, gone: { level: 0.5 } }, ['erbij'])), ['erbij']);
  is('test_topics_a_corrupt_save_opens_empty', cleanTopics('nonsense', ['erbij']), {});
  is('test_topics_a_level_out_of_range_is_pulled_back_in',
    cleanTopics({ erbij: { level: -4, seen: 2 } }, ['erbij']).erbij.level, 0);

  // what to do next: not the worst thing, and not the thing already mastered
  {
    const book = {
      easy: { ...FRESH, level: 0.97, seen: 40 },
      edge: { ...FRESH, level: 0.55, seen: 12 },
      wall: { ...FRESH, level: 0.04, seen: 30 },
    };
    is('test_next_subject_is_the_one_nearest_the_edge', pickNext(book, ['easy', 'edge', 'wall']), 'edge');
    is('test_next_subject_never_sends_a_child_to_the_wall',
      pickNext(book, ['easy', 'wall']) !== 'wall', true);
    is('test_next_subject_prefers_something_untried_to_something_finished',
      pickNext(book, ['easy', 'fresh']), 'fresh');
    is('test_next_subject_prefers_the_half_learnt_to_the_untried',
      pickNext(book, ['edge', 'fresh']), 'edge');
    is('test_next_subject_of_nothing_is_nothing', pickNext(book, []), null);
    // a subject just aced hands over to something new rather than asking for a tenth go
    is('test_next_subject_a_freshly_aced_one_gives_way_to_an_untried_one',
      pickNext({ aced: { level: 0.78, seen: 6, streak: 6, slump: 0 } }, ['aced', 'new']), 'new');
    is('test_next_subject_a_subject_in_the_middle_of_being_learnt_holds_on',
      pickNext({ mid: { level: 0.5, seen: 8, streak: 1, slump: 0 } }, ['mid', 'new']), 'mid');
  }
}

// ---------------------------------------------------------------- Rekenrijk: how many answers to offer

{
  const { LEVELS, optionsFor, parMsFor, makeQuestion, rngFor, inRule, levelById } =
    await bundle('src/games/numbers/model.ts', 'numdial.mjs');
  group('Rekenrijk — the dial on a level');

  const tafels = levelById('tafels');
  is('test_options_a_child_new_to_this_gets_three', optionsFor(tafels, 0), 3);
  is('test_options_a_child_sure_of_this_gets_the_full_set', optionsFor(tafels, 1), tafels.options);
  is('test_options_never_goes_below_three', LEVELS.every(L => optionsFor(L, -5) >= 3), true);
  is('test_options_never_goes_past_what_the_level_asked_for',
    LEVELS.every(L => optionsFor(L, 5) <= L.options), true);
  is('test_options_never_shrink_as_a_child_gets_surer',
    LEVELS.every(L => [0, 0.25, 0.5, 0.75, 1].every((d, i, a) =>
      i === 0 || optionsFor(L, d) >= optionsFor(L, a[i - 1]))), true);

  // fewer buttons must not mean an easier sum: the level decides what it is about, and keeps deciding
  is('test_dial_a_smaller_set_still_asks_the_level_s_own_sums',
    LEVELS.every(L => {
      const rng = rngFor(L, 3);
      for (let i = 0; i < 12; i++) if (!inRule(L, makeQuestion(L, rng, i, [], 3))) return false;
      return true;
    }), true);
  is('test_dial_a_smaller_set_still_contains_the_answer',
    LEVELS.every(L => {
      const rng = rngFor(L, 5);
      for (let i = 0; i < 12; i++) {
        const q = makeQuestion(L, rng, i, [], 3);
        if (q.options.length !== 3 || q.options[q.correct] !== q.answer) return false;
      }
      return true;
    }), true);
  is('test_dial_the_tables_are_given_longer_than_a_sum_to_ten',
    parMsFor(levelById('tafels')) > parMsFor(levelById('erbij')), true);
}

// ---------------------------------------------------------------- Klokkijken: how many times to offer

{
  const { LEVELS, optionsFor, parMsFor, makeQuestion, rngFor, isRight } =
    await bundle('src/games/clock/model.ts', 'clockdial.mjs');
  group('Klokkijken — the dial on a level');
  const asking = LEVELS.filter(L => L.kinds.some(k => k !== 'set'));

  is('test_clock_dial_a_child_new_to_this_gets_three', asking.every(L => optionsFor(L, 0) === 3), true);
  is('test_clock_dial_a_child_sure_of_this_gets_the_full_set',
    asking.every(L => optionsFor(L, 1) === L.options), true);
  is('test_clock_dial_never_goes_below_three', LEVELS.every(L => optionsFor(L, -3) >= 3), true);
  is('test_clock_dial_never_goes_past_what_the_level_asked_for',
    LEVELS.every(L => optionsFor(L, 3) <= L.options), true);

  // a smaller set is still a real question: the right time is in it, exactly once
  is('test_clock_dial_a_smaller_set_still_contains_the_time',
    asking.every(L => {
      const rng = rngFor(L, 7);
      for (let i = 0; i < 14; i++) {
        const q = makeQuestion(L, rng, i, [], 3);
        if (q.kind === 'set') continue;
        if (q.options.length !== 3) return false;
        if (!isRight(q, q.options[q.answer])) return false;
        if (q.options.filter(o => isRight(q, o)).length !== 1) return false;
      }
      return true;
    }), true);
  is('test_clock_dial_setting_the_hands_has_no_buttons_to_thin_out',
    (() => {
      const L = LEVELS.find(x => x.id === 'setit');
      const rng = rngFor(L, 2);
      for (let i = 0; i < 8; i++) if (makeQuestion(L, rng, i, [], 3).options.length !== 0) return false;
      return true;
    })(), true);
  is('test_clock_dial_working_out_how_much_later_is_given_longest',
    parMsFor(LEVELS.find(L => L.id === 'later')) > parMsFor(LEVELS.find(L => L.id === 'hours')), true);
}

// ---------------------------------------------------------------- Night Watch: a sky without a top

{
  const S = await bundle('src/games/nightwatch/sky.ts', 'nwsky.mjs');
  const G = await bundle('src/games/nightwatch/swipe.ts', 'nwswipe.mjs');
  const { FIGURES } = await bundle('src/games/nightwatch/figures.ts', 'nwfigures.mjs');
  const { uiScale } = await bundle('src/util/ui.ts', 'nwui.mjs');
  const {
    oneStrokeOrder, isOneStroke, minStarGap, grabRadius, lineClearance, widestStarR, capacity,
    playField, frameFor, figureClosest, madeLadder, madePuzzle, generatedPuzzle, layoutSky,
    closestPair, planNext, blend, parMsFor, NODE_CAP, EDGE_CAP, HAND_MADE_SPAN,
  } = S;
  const { starAt, press, move, lift, runLength, EMPTY_HAND } = G;

  /** the three sizes the game is checked at by hand, plus a tablet */
  const SCREENS = [[320, 568], [390, 844], [844, 390], [768, 1024]].map(([w, h]) => {
    const u = uiScale(w, h);
    return { w, h, u, f: playField(w, h, u) };
  });
  const phone = SCREENS[1];
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  /** distance from a point to a segment, for checking that no star sits on a line */
  const segDist = (p, a, b) => {
    const abx = b.x - a.x, aby = b.y - a.y, l2 = abx * abx + aby * aby;
    let t = l2 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
  };

  group('Night Watch — a figure one finger can draw without lifting');
  const kite = FIGURES.find(f => f.id === 'kite');
  const owl = FIGURES.find(f => f.id === 'owl');
  is('test_onestroke_a_closed_square_of_four_lines_is_one_stroke',
    oneStrokeOrder([[0, 1], [1, 2], [2, 3], [3, 0]]).length, 4);
  is('test_onestroke_the_order_it_gives_back_joins_end_to_end',
    isOneStroke(oneStrokeOrder(kite.edges)), true);
  is('test_onestroke_a_plain_path_keeps_every_line', oneStrokeOrder([[0, 1], [1, 2], [2, 3]]).length, 3);
  is('test_onestroke_six_odd_ends_cannot_be_drawn_without_lifting', oneStrokeOrder(owl.edges), null);
  is('test_onestroke_a_figure_in_two_pieces_is_refused', oneStrokeOrder([[0, 1], [2, 3]]), null);
  is('test_onestroke_a_line_from_a_star_to_itself_is_refused', oneStrokeOrder([[0, 0]]), null);
  is('test_onestroke_no_lines_at_all_is_refused', oneStrokeOrder([]), null);
  is('test_onestroke_a_list_that_jumps_between_lines_is_not_in_order', isOneStroke([[0, 1], [2, 3]]), false);
  is('test_onestroke_the_same_line_drawn_twice_is_not_one_stroke', isOneStroke([[0, 1], [1, 0]]), false);

  group('Night Watch — no two stars closer than a fingertip');
  is('test_gap_is_a_fingertip_plus_the_bodies_of_both_stars',
    Math.round(minStarGap(1, 100) * 10) / 10, 35.8);
  is('test_gap_is_wider_than_the_two_stars_it_has_to_separate',
    minStarGap(1, 100) > widestStarR(1) * 2, true);
  is('test_gap_grows_with_the_scale_of_the_interface', minStarGap(2, 100) > minStarGap(1, 100), true);
  is('test_gap_a_wide_field_takes_a_share_of_itself_as_the_floor', minStarGap(1, 2000), 150);
  is('test_gap_is_always_wider_than_the_reach_that_picks_a_star_up',
    [1, 1.4, 2.2].every(u => [150, 280, 350, 700, 1200].every(s => minStarGap(u, s) > grabRadius(u, s))), true);
  // a finger dead on a line is inside the reach of anything sitting beside it, so the clearance
  // has to be wider than the reach and not narrower: a real swipe found this one the hard way
  is('test_gap_a_line_holds_every_other_star_further_off_than_the_reach_that_picks_one_up',
    [1, 1.4, 2.2].every(u => [150, 280, 350, 700, 1200].every(s => lineClearance(u, s) > grabRadius(u, s))), true);

  group('Night Watch — the figures the sky makes up');
  const DIALS = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const built = [];
  for (const sc of SCREENS) for (const d of DIALS) for (let seed = 1; seed <= 20; seed++) {
    const p = generatedPuzzle(d, sc.f, sc.u, seed * 37);
    built.push({ sc, d, p, sky: layoutSky(p, sc.f, sc.u, seed * 11) });
  }
  is('test_generator_never_puts_two_stars_within_a_fingertip_of_each_other',
    built.every(m => closestPair(m.sky.stars) >= minStarGap(m.sc.u, m.sc.f.s) - 1e-6), true);
  is('test_generator_every_figure_it_makes_is_drawable_in_one_stroke',
    built.every(m => m.p.oneStroke && oneStrokeOrder(m.p.edges) !== null), true);
  is('test_generator_never_goes_over_the_star_cap', built.every(m => m.p.stars.length <= NODE_CAP), true);
  is('test_generator_never_goes_over_the_line_cap', built.every(m => m.p.edges.length <= EDGE_CAP), true);
  is('test_generator_always_gives_at_least_three_lines', built.every(m => m.p.edges.length >= 3), true);
  is('test_generator_every_star_of_the_figure_carries_a_line',
    built.every(m => m.p.stars.every((_, i) => m.p.edges.some(([a, b]) => a === i || b === i))), true);
  is('test_generator_never_draws_the_same_line_twice',
    built.every(m => new Set(m.p.edges.map(([a, b]) => key(a, b))).size === m.p.edges.length), true);
  is('test_generator_never_puts_more_stars_in_the_sky_than_it_holds',
    built.every(m => m.sky.stars.length <= capacity(m.sc.f, m.sc.u)), true);
  is('test_generator_keeps_every_star_clear_of_the_lines_it_is_not_an_end_of',
    built.every(m => {
      const clear = lineClearance(m.sc.u, m.sc.f.s);
      return m.p.edges.every(([ea, eb]) => {
        const a = m.sky.stars[m.sky.figureStars[ea]], b = m.sky.stars[m.sky.figureStars[eb]];
        return m.sky.stars.every((s, i) =>
          i === m.sky.figureStars[ea] || i === m.sky.figureStars[eb] || segDist(s, a, b) >= clear - 1e-6);
      });
    }), true);
  is('test_generator_never_lays_a_star_outside_the_field',
    built.every(m => m.sky.stars.every(s =>
      s.x >= m.sc.f.x && s.x <= m.sc.f.x + m.sc.f.w && s.y >= m.sc.f.y && s.y <= m.sc.f.y + m.sc.f.h)), true);

  const avgOn = (sc, d, pick) => {
    let sum = 0;
    for (let i = 1; i <= 20; i++) sum += pick(generatedPuzzle(d, sc.f, sc.u, i * 37));
    return sum / 20;
  };
  const avg = (d, pick) => avgOn(phone, d, pick);
  is('test_generator_puts_more_stars_in_the_figure_higher_up_the_dial',
    avg(1, p => p.stars.length) > avg(0.5, p => p.stars.length), true);
  is('test_generator_draws_more_lines_higher_up_the_dial',
    avg(1, p => p.edges.length) > avg(0.5, p => p.edges.length), true);
  // a bigger figure is given more seconds overall and fewer of them per line, which is where the
  // pressure actually comes from: eleven lines in three seconds is far less time than six in two
  is('test_generator_gives_less_time_per_line_higher_up_the_dial',
    avg(1, p => p.showMs / p.edges.length) < avg(0.5, p => p.showMs / p.edges.length), true);
  is('test_generator_never_gives_less_than_a_third_of_a_second_a_line',
    built.every(m => m.p.showMs / m.p.edges.length >= 200), true);
  is('test_generator_never_gives_less_than_a_second_and_a_fifth_to_look',
    built.every(m => m.p.showMs >= 1200), true);
  is('test_generator_crowds_the_look_alikes_closer_higher_up_the_dial',
    avg(1, p => p.crowd) > avg(0.6, p => p.crowd), true);
  is('test_generator_scatters_more_look_alikes_higher_up_the_dial',
    avg(1, p => p.distractors) > avg(0.5, p => p.distractors), true);
  is('test_generator_leaves_the_sky_still_low_down_the_dial',
    [0.1, 0.3, 0.5].every(d => {
      const p = generatedPuzzle(d, phone.f, phone.u, 99);
      return p.turn === 0 && p.mirror === false;
    }), true);
  is('test_generator_turns_the_sky_over_near_the_top_of_the_dial',
    generatedPuzzle(0.95, phone.f, phone.u, 99).turn > 0, true);
  is('test_generator_lines_go_out_together_low_down_and_one_at_a_time_higher_up',
    [generatedPuzzle(0.3, phone.f, phone.u, 5).fade, generatedPuzzle(0.9, phone.f, phone.u, 5).fade],
    ['together', 'oneByOne']);
  const stamp = p => `${p.stars.length}:${p.edges.length}:${Math.round(p.stars[0][0] * 1e6)}`;
  is('test_generator_the_same_seed_makes_the_same_figure',
    stamp(generatedPuzzle(0.8, phone.f, phone.u, 4242)), stamp(generatedPuzzle(0.8, phone.f, phone.u, 4242)));
  is('test_generator_a_different_seed_makes_a_different_figure',
    stamp(generatedPuzzle(0.8, phone.f, phone.u, 4242)) !== stamp(generatedPuzzle(0.8, phone.f, phone.u, 77)), true);
  is('test_generator_a_short_sideways_sky_gets_a_smaller_figure_than_a_tall_one',
    avgOn(SCREENS[2], 1, p => p.stars.length) < avgOn(SCREENS[1], 1, p => p.stars.length), true);
  is('test_generator_gives_a_made_up_figure_no_name_to_pretend_with',
    (() => { const p = generatedPuzzle(0.9, phone.f, phone.u, 7); return [p.made, p.name, p.nameNl, p.lore]; })(),
    [false, '', '', '']);
  is('test_par_a_figure_with_more_lines_is_given_longer_to_draw', parMsFor(10, 5) > parMsFor(4, 5), true);

  group('Night Watch — the hand-made figures, still whole');
  is('test_figures_all_eight_hand_made_figures_are_still_here', FIGURES.length, 8);
  is('test_figures_every_one_has_an_english_name_a_dutch_name_and_a_line_of_lore',
    FIGURES.every(f => !!f.name && !!f.nameNl && f.lore.startsWith('nwLore')), true);
  is('test_figures_every_line_joins_two_stars_that_exist',
    FIGURES.every(f => f.edges.every(([a, b]) => a !== b && !!f.stars[a] && !!f.stars[b])), true);
  is('test_figures_no_figure_draws_the_same_line_twice',
    FIGURES.every(f => new Set(f.edges.map(([a, b]) => key(a, b))).size === f.edges.length), true);
  is('test_figures_every_star_of_every_figure_is_on_a_line',
    FIGURES.every(f => f.stars.every((_, i) => f.edges.some(([a, b]) => a === i || b === i))), true);
  is('test_figures_every_star_sits_inside_the_square_it_is_placed_in',
    FIGURES.every(f => f.stars.every(([x, y]) => x > 0 && x < 1 && y > 0 && y < 1)), true);
  is('test_figures_no_two_stars_of_a_hand_made_figure_come_within_a_fingertip_on_any_screen',
    SCREENS.every(sc => FIGURES.every(f => figureClosest(f.stars, sc.f) >= minStarGap(sc.u, sc.f.s))), true);
  is('test_figures_no_star_of_a_hand_made_figure_sits_on_one_of_its_own_lines',
    SCREENS.every(sc => FIGURES.every(f => {
      const pts = f.stars.map(([x, y]) => ({ x: sc.f.x + x * sc.f.w, y: sc.f.y + y * sc.f.h }));
      return f.edges.every(([a, b]) => pts.every((p, i) =>
        i === a || i === b || segDist(p, pts[a], pts[b]) >= lineClearance(sc.u, sc.f.s)));
    })), true);
  is('test_ladder_the_kite_with_its_four_lines_opens_the_run', madeLadder()[0].figure.id, 'kite');
  is('test_ladder_every_rung_stands_higher_than_the_one_below_it',
    madeLadder().every((r, i, a) => i === 0 || r.at > a[i - 1].at), true);
  is('test_ladder_the_lines_only_ever_grow_along_the_run',
    madeLadder().every((r, i, a) => i === 0 || r.figure.edges.length >= a[i - 1].figure.edges.length), true);
  is('test_ladder_the_last_hand_made_rung_is_halfway_up_the_dial',
    madeLadder()[madeLadder().length - 1].at, HAND_MADE_SPAN);
  is('test_ladder_holds_every_hand_made_figure_exactly_once',
    new Set(madeLadder().map(r => r.figure.id)).size, FIGURES.length);
  is('test_made_puzzle_keeps_the_figures_name_and_its_line_of_lore',
    (() => { const p = madePuzzle(kite, 0.1, phone.f, phone.u, 3); return [p.name, p.nameNl, p.lore]; })(),
    [kite.name, kite.nameNl, kite.lore]);
  is('test_made_puzzle_keeps_every_line_of_the_figure',
    madePuzzle(owl, 0.3, phone.f, phone.u, 3).edges.length, owl.edges.length);
  is('test_made_puzzle_puts_the_kites_lines_into_one_stroke_order',
    isOneStroke(madePuzzle(kite, 0.1, phone.f, phone.u, 3).edges), true);
  is('test_made_puzzle_says_so_when_a_figure_needs_a_lift', madePuzzle(owl, 0.3, phone.f, phone.u, 3).oneStroke, false);
  is('test_made_puzzle_never_crowds_a_hand_made_figure_past_a_fingertip',
    SCREENS.every(sc => FIGURES.every(f => [0, 0.25, 0.5].every(d => {
      const p = madePuzzle(f, d, sc.f, sc.u, 17);
      return closestPair(layoutSky(p, sc.f, sc.u, 5).stars) >= minStarGap(sc.u, sc.f.s) - 1e-6;
    }))), true);
  is('test_frame_a_quarter_turn_lays_the_figure_into_a_square',
    (() => { const fr = frameFor(phone.f, 1); return fr.w === fr.h; })(), true);
  is('test_frame_a_half_turn_keeps_the_whole_field', frameFor(phone.f, 2).w, phone.f.w);
  is('test_field_a_sideways_phone_still_gets_a_sky_deep_enough_for_a_fingertip',
    playField(844, 390, uiScale(844, 390)).s * 0.18 > minStarGap(uiScale(844, 390), playField(844, 390, uiScale(844, 390)).s), true);

  group('Night Watch — the ladder without a top');
  const fresh = { level: 0.08, seen: 0, streak: 0, slump: 0 };
  const plan = (vm, pattern, recent, seenMade) => planNext({
    vm, pattern, recent: recent ?? [], seenMade: seenMade ?? [], field: phone.f, u: phone.u, seed: 21,
  });
  const good = { correct: true, ms: 1000, parMs: 5000, hints: 0, tries: 1 };
  is('test_plan_a_child_at_the_bottom_meets_a_hand_made_figure_first', plan(fresh, fresh).puzzle.made, true);
  is('test_plan_the_very_first_figure_is_the_easiest_hand_made_one', plan(fresh, fresh).puzzle.id, 'kite');
  is('test_plan_a_figure_already_brought_back_tonight_does_not_come_round_again',
    plan(fresh, fresh, [], ['kite']).puzzle.id !== 'kite', true);
  is('test_plan_a_child_who_has_seen_them_all_gets_one_the_sky_made_up',
    plan(fresh, fresh, [], FIGURES.map(f => f.id)).puzzle.made, false);
  is('test_plan_a_child_far_above_the_hand_made_run_gets_one_the_sky_made_up',
    plan({ ...fresh, level: 0.9 }, { ...fresh, level: 0.9 }).puzzle.made, false);
  is('test_plan_a_child_partway_up_starts_partway_along_the_run',
    plan({ ...fresh, level: 0.3 }, { ...fresh, level: 0.3 }).puzzle.id !== 'kite', true);
  is('test_plan_two_wrong_in_a_row_builds_a_bridge_rather_than_starting_over',
    plan({ ...fresh, level: 0.7, slump: 2 }, { ...fresh, level: 0.7, slump: 2 }).move, 'bridge');
  is('test_plan_a_bridge_asks_for_less_than_the_child_was_on',
    plan({ ...fresh, level: 0.7, slump: 2 }, { ...fresh, level: 0.7, slump: 2 }).difficulty < 0.7, true);
  is('test_plan_a_clean_quick_run_stretches_rather_than_creeps',
    plan({ ...fresh, level: 0.6, streak: 3 }, { ...fresh, level: 0.6, streak: 3 }, [good, good, good]).move, 'stretch');
  is('test_plan_a_stretch_asks_for_more_than_the_child_was_on',
    plan({ ...fresh, level: 0.6, streak: 3 }, { ...fresh, level: 0.6, streak: 3 }, [good, good, good]).difficulty > 0.6, true);
  is('test_plan_forty_figures_in_a_row_all_come_out_drawable',
    (() => {
      for (let i = 0; i < 40; i++) {
        const lvl = Math.min(1, i / 20);
        const p = planNext({
          vm: { ...fresh, level: lvl }, pattern: { ...fresh, level: lvl }, recent: [],
          seenMade: [], field: phone.f, u: phone.u, seed: 100 + i,
        }).puzzle;
        if (p.edges.length < 3) return false;
        if (!p.made && !p.oneStroke) return false;
      }
      return true;
    })(), true);
  is('test_blend_visual_memory_carries_most_of_the_weight',
    blend({ level: 1, seen: 0, streak: 0, slump: 0 }, { level: 0, seen: 0, streak: 0, slump: 0 }).level, 0.65);
  is('test_blend_the_worse_of_the_two_slumps_is_the_one_that_counts',
    blend({ ...fresh, slump: 0 }, { ...fresh, slump: 2 }).slump, 2);
  is('test_blend_a_streak_is_only_as_long_as_the_shorter_of_the_two',
    blend({ ...fresh, streak: 5 }, { ...fresh, streak: 2 }).streak, 2);

  group('Night Watch — what one finger means');
  const STARS = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const nothing = () => false;
  const has = set => (a, b) => set.has(key(a, b));
  is('test_swipe_a_point_on_a_star_picks_that_star', starAt({ x: 4, y: 3 }, STARS, 30), 0);
  is('test_swipe_a_point_out_of_reach_of_every_star_picks_nothing', starAt({ x: 50, y: 50 }, STARS, 30), null);
  is('test_swipe_a_point_halfway_between_two_stars_refuses_to_choose',
    starAt({ x: 85, y: 0 }, [{ x: 70, y: 0 }, { x: 100, y: 0 }], 30), null);
  is('test_swipe_a_clearly_nearer_star_wins_even_when_both_are_in_reach',
    starAt({ x: 90, y: 0 }, [{ x: 70, y: 0 }, { x: 100, y: 0 }], 30), 1);
  is('test_swipe_a_wider_slack_refuses_a_pair_it_would_otherwise_have_split',
    starAt({ x: 90, y: 0 }, [{ x: 70, y: 0 }, { x: 100, y: 0 }], 30, 0.5), null);
  is('test_swipe_an_empty_sky_picks_nothing', starAt({ x: 0, y: 0 }, [], 30), null);
  is('test_swipe_a_press_on_a_star_starts_a_run', press(EMPTY_HAND, 0, nothing).hand.path, [0]);
  is('test_swipe_a_press_on_a_star_reports_that_it_started', press(EMPTY_HAND, 0, nothing).event, 'start');
  is('test_swipe_a_press_on_empty_sky_starts_nothing', press(EMPTY_HAND, null, nothing).hand.path, []);
  {
    // Arrange: a finger down on star 0
    let h = press(EMPTY_HAND, 0, nothing).hand;
    // Act: run it on through 1, 2 and 3 without lifting
    const one = move(h, 1, nothing); h = one.hand;
    const two = move(h, 2, nothing); h = two.hand;
    const three = move(h, 3, nothing); h = three.hand;
    is('test_swipe_running_on_to_a_new_star_adds_a_line', one.event, 'add');
    is('test_swipe_the_added_line_joins_the_star_left_to_the_star_reached', [one.a, one.b], [0, 1]);
    is('test_swipe_a_run_through_four_stars_draws_three_lines',
      [one.event, two.event, three.event], ['add', 'add', 'add']);
    is('test_swipe_the_run_remembers_every_star_it_passed_through', h.path, [0, 1, 2, 3]);
    is('test_swipe_the_note_climbs_with_the_length_of_the_run', runLength(h), 3);
    // Act: pull back over the star before last
    const back = move(h, 2, nothing);
    is('test_swipe_passing_back_over_the_last_star_takes_that_line_away', back.event, 'undo');
    is('test_swipe_the_line_taken_away_is_the_one_just_drawn', [back.a, back.b], [3, 2]);
    is('test_swipe_the_run_is_one_star_shorter_after_a_pull_back', back.hand.path, [0, 1, 2]);
  }
  is('test_swipe_standing_still_on_the_same_star_changes_nothing',
    move({ path: [0, 1], links: 1, anchor: null }, 1, nothing).event, 'none');
  is('test_swipe_a_finger_between_stars_changes_nothing',
    move({ path: [0, 1], links: 1, anchor: null }, null, nothing).event, 'none');
  is('test_swipe_a_run_that_never_started_ignores_a_star_under_it', move(EMPTY_HAND, 2, nothing).event, 'none');
  {
    // Arrange: a press on star 0 that goes nowhere, then lifted - a plain tap
    const after = lift(press(EMPTY_HAND, 0, nothing).hand);
    is('test_swipe_lifting_on_the_first_star_leaves_it_waiting', after.anchor, 0);
    // Act: tap a second star
    const join = press(after, 2, nothing);
    is('test_swipe_a_tap_and_then_another_tap_draws_the_line_between_them',
      [join.event, join.a, join.b], ['add', 0, 2]);
    is('test_swipe_the_second_tap_leaves_nothing_waiting', join.hand.anchor, null);
    is('test_swipe_the_second_tap_can_be_carried_straight_on_into_a_run', join.hand.path, [2]);
  }
  is('test_swipe_lifting_after_a_line_leaves_nothing_waiting',
    lift({ path: [0, 1], links: 1, anchor: null }).anchor, null);
  is('test_swipe_a_press_on_empty_sky_lets_the_waiting_star_go',
    press({ path: [], links: 0, anchor: 3 }, null, nothing).hand.anchor, null);
  is('test_swipe_pressing_the_waiting_star_again_only_picks_it_up_once_more',
    press({ path: [], links: 0, anchor: 3 }, 3, nothing).hand.path, [3]);
  {
    // Arrange: the line between stars 0 and 1 is already on the sky
    const drawn = new Set([key(0, 1)]);
    // Act: draw over it as the first line of a gesture
    const over = move(press(EMPTY_HAND, 0, has(drawn)).hand, 1, has(drawn));
    is('test_swipe_drawing_over_a_line_you_already_have_takes_it_away', over.event, 'remove');
    is('test_swipe_a_line_taken_away_leaves_the_finger_on_the_far_star', over.hand.path, [1]);
    // Act: meet the same line partway through a long run instead
    const mid = move({ path: [5, 0], links: 1, anchor: null }, 1, has(drawn));
    is('test_swipe_a_long_run_crossing_a_line_it_already_has_leaves_it_alone', mid.event, 'pass');
    is('test_swipe_a_run_that_passed_a_line_it_had_carries_straight_on', mid.hand.path, [5, 0, 1]);
    is('test_swipe_a_tap_onto_a_line_you_already_have_takes_it_away',
      press({ path: [], links: 0, anchor: 0 }, 1, has(drawn)).event, 'remove');
  }
}

// ---------------------------------------------------------------- The catalogue of experiences

{
  const { CATALOG, byId, forAge, inDomain, domainsPresent, coverage, shelf } =
    await bundle('src/platform/catalog.ts', 'catalog.mjs');
  group('Platform — the catalogue');

  is('test_catalog_every_id_is_unique', new Set(CATALOG.map(e => e.id)).size, CATALOG.length);
  is('test_catalog_every_row_is_named_in_both_languages',
    CATALOG.every(e => e.title && e.line && e.lineNl && e.practises && e.practisesNl), true);
  is('test_catalog_every_row_has_at_least_one_subject',
    CATALOG.every(e => e.domains.length > 0), true);
  is('test_catalog_no_row_ends_before_it_begins',
    CATALOG.every(e => e.to > e.from), true);
  is('test_catalog_no_row_falls_outside_two_to_ten',
    CATALOG.every(e => e.from >= 2 && e.to <= 10), true);
  is('test_catalog_a_sitting_is_minutes_not_hours',
    CATALOG.every(e => e.minutes[0] >= 1 && e.minutes[1] <= 30 && e.minutes[1] > e.minutes[0]), true);
  is('test_catalog_is_listed_youngest_first',
    CATALOG.every((e, i) => i === 0 || e.from >= CATALOG[i - 1].from), true);

  is('test_catalog_looking_up_a_page_finds_it', byId('moonshot').title, 'Moonshot');
  is('test_catalog_looking_up_nothing_finds_nothing', byId('nope'), undefined);

  is('test_age_a_two_year_old_is_offered_only_what_suits_them',
    forAge(2).every(e => e.from <= 2), true);
  is('test_age_nothing_is_offered_below_its_own_floor', forAge(2).some(e => e.from > 2), false);
  is('test_age_an_eleven_year_old_has_outgrown_the_app', forAge(11).length, 0);
  is('test_age_every_row_is_offered_to_somebody',
    CATALOG.every(e => forAge(e.from).includes(e)), true);

  // the parent's choices reaching the shelf: before this, nothing called forAge or allows
  const ids = list => list.map(e => e.id);
  const all = r => [...r.now, ...r.later, ...r.earlier];
  is('test_shelf_no_profile_shows_everything_in_order', ids(shelf(null).now), ids(CATALOG));
  is('test_shelf_no_profile_has_nothing_set_apart',
    shelf(null).later.length + shelf(null).earlier.length, 0);
  is('test_shelf_what_fits_now_is_what_fits_the_age', ids(shelf({ years: 5, domains: [] }).now), ids(forAge(5)));
  is('test_shelf_age_puts_nothing_away_without_a_subject_choice',
    all(shelf({ years: 2, domains: [] })).length, CATALOG.length);
  is('test_shelf_too_old_things_are_to_grow_into',
    shelf({ years: 2, domains: [] }).later.every(e => e.from > 2), true);
  is('test_shelf_outgrown_things_are_kept_apart',
    ids(shelf({ years: 10, domains: [] }).earlier), ids(CATALOG.filter(e => e.to < 10)));
  is('test_shelf_a_thing_is_on_the_shelf_once',
    [2, 5, 10].every(y => new Set(ids(all(shelf({ years: y, domains: [] })))).size === CATALOG.length), true);
  is('test_shelf_an_unchosen_subject_is_put_away',
    all(shelf({ years: 6, domains: ['ruimte'] })).every(e => e.domains.includes('ruimte')), true);
  is('test_shelf_a_chosen_subject_keeps_all_its_things',
    all(shelf({ years: 6, domains: ['ruimte'] })).length, inDomain('ruimte').length);
  is('test_shelf_a_later_thing_of_an_unchosen_subject_is_not_offered_either',
    ids(shelf({ years: 3, domains: ['taal'] }).later), ['letters']);

  is('test_domain_every_subject_has_something_in_it',
    domainsPresent().every(d => inDomain(d).length > 0), true);
  is('test_domain_the_brief_s_subjects_are_all_covered',
    ['taal', 'rekenen', 'tijd', 'vormen', 'dieren', 'dinos', 'ruimte', 'techniek', 'natuur']
      .filter(d => inDomain(d).length === 0), []);

  // the number the roadmap is about: the youngest band is the thinnest, and it must not quietly
  // stop being true
  is('test_coverage_rises_with_age_up_to_eight', coverage(8) > coverage(2), true);
  is('test_coverage_of_the_youngest_is_still_the_thinnest',
    [3, 4, 5, 6, 7, 8].every(a => coverage(a) >= coverage(2)), true);
}

// ---------------------------------------------------------------- Recorded sound effects

{
  const { SFX } = await bundle('src/platform/sfxspec.ts', 'sfxspec.mjs');
  group('Platform — recorded sound effects');
  const rows = Object.entries(SFX);
  is('test_sfx_every_row_is_named_game_dot_method', rows.every(([k]) => /^[a-z]+\.[a-zA-Z]+$/.test(k)), true);
  is('test_sfx_every_generation_is_at_least_the_api_floor', rows.every(([, r]) => r.secs >= 0.5), true);
  is('test_sfx_nothing_plays_longer_than_it_was_made', rows.every(([, r]) => r.max > 0 && r.max <= r.secs), true);
  is('test_sfx_every_prompt_asks_for_the_house_sound', rows.every(([, r]) => r.prompt.includes('for a calm children')), true);
  is('test_sfx_a_background_is_long_enough_to_loop', rows.filter(([, r]) => r.loop).every(([, r]) => r.secs >= 8), true);
  is('test_sfx_both_journeys_have_their_own_sounds',
    ['go', 'arrive', 'more', 'on', 'bed'].every(m => SFX[`reis.${m}`] && SFX[`diepzee.${m}`]), true);
  is('test_sfx_klankhuis_notes_are_never_recorded',
    rows.some(([k]) => /^rhythm\.(play|playChord|click|drum)$/.test(k)), false);
  // the sfx files are the other half of the contract: every row has to name a method that exists
  const { readFileSync } = await import('node:fs');
  const src = { atlas: 'atlas/atlassfx', circuit: 'circuit/sfx', clock: 'clock/clocksfx', dig: 'dig/digsfx',
    letters: 'letters/lettersfx', market: 'market/marketsfx', mill: 'mill/millsfx', moonshot: 'moonshot/rocketsfx',
    nightwatch: 'nightwatch/nightsfx', numbers: 'numbers/numbersfx', orbit: 'orbit/orbitsfx', puffball: 'puffball/puffsfx',
    rhythm: 'rhythm/chimesfx', tidepool: 'tidepool/tidesfx' };
  const text = g => g === 'cloudhopper' ? readFileSync('src/util/audio.ts', 'utf8')
    : g === 'ui' ? readFileSync('src/platform/uisfx.ts', 'utf8')
    : g === 'reis' || g === 'diepzee' ? readFileSync('src/journey/journeysfx.ts', 'utf8')
    : readFileSync(`src/games/${src[g]}.ts`, 'utf8');
  is('test_sfx_every_row_names_a_sound_that_exists', rows.filter(([k, r]) => {
    const [g, m] = k.split('.');
    if (r.loop) return false;   // a background is started by its key, not by a method
    const t = text(g);
    return !(new RegExp(`\\n\\s+${m}\\(`).test(t) || new RegExp(`function ${m}Synth\\(`).test(t));
  }).map(([k]) => k), []);

  const { measure } = await bundle('src/platform/sfxlevel.ts', 'sfxlevel.mjs');
  const quiet = new Float32Array(1000);
  for (let i = 500; i < 1000; i++) quiet[i] = i % 2 ? 0.5 : -0.5;
  is('test_sfx_silence_before_a_sound_is_skipped', Math.round(measure(quiet, 1000).start * 1000), 496);
  is('test_sfx_a_sound_is_levelled_by_its_peak', measure(quiet, 1000).level, 0.8);
  is('test_sfx_a_silent_file_plays_at_nothing', measure(new Float32Array(10), 1000).level, 0);
}

// ---------------------------------------------------------------- The voice

{
  const { cleanManifest, clipFor, bestVoice, clipsForLine } = await bundle('src/platform/voice.ts', 'voice.mjs');
  group('Platform — the voice');

  // "elke gesproken tekst is nu zo'n AI robot": pick the most natural woman's voice the device has
  const v = (name, lang, localService = true) => ({ name, lang, localService });
  const pickName = (list, want = 'nl') => bestVoice(list, want)?.name ?? null;
  is('test_voice_a_woman_is_picked_over_a_man',
    pickName([v('Xander', 'nl-NL'), v('Claire', 'nl-NL')]), 'Claire');
  is('test_voice_an_enhanced_voice_beats_a_compact_one',
    pickName([v('Claire', 'nl-NL'), v('Claire (Enhanced)', 'nl-NL')]), 'Claire (Enhanced)');
  is('test_voice_espeak_comes_last',
    pickName([v('espeak-ng Dutch', 'nl'), v('Xander', 'nl-NL')]), 'Xander');
  is('test_voice_a_voice_on_the_device_beats_a_better_one_on_the_network',
    pickName([v('Microsoft Fenna Online (Natural)', 'nl-NL', false), v('Microsoft Frank', 'nl-NL')]), 'Microsoft Frank');
  is('test_voice_a_network_voice_is_used_only_when_there_is_nothing_else',
    pickName([v('Google Nederlands', 'nl-NL', false), v('Samantha', 'en-US')]), 'Google Nederlands');
  is('test_voice_another_language_is_never_picked', pickName([v('Samantha', 'en-US')]), null);
  is('test_voice_the_netherlands_before_flanders',
    pickName([v('Ellen', 'nl-BE'), v('Claire', 'nl-NL')]), 'Claire');
  is('test_voice_an_underscore_in_the_language_tag_is_read',
    pickName([v('Claire', 'nl_NL')]), 'Claire');

  const { lineKey } = await bundle('src/platform/voicekey.ts', 'voicekey.mjs');
  is('test_voicekey_the_same_words_give_the_same_key', lineKey('Tik op de klokjes.'), lineKey('Tik op de klokjes.'));
  is('test_voicekey_spacing_does_not_change_the_key', lineKey('Tik  op de\nklokjes. '), lineKey('Tik op de klokjes.'));
  is('test_voicekey_different_words_give_a_different_key', lineKey('Tik op de klokjes.') === lineKey('Tik op de klokjes'), false);
  is('test_voicekey_a_key_is_short_and_safe_as_a_file_name', /^t[0-9a-f]{8}$/.test(lineKey('Één, twee, drie.')), true);

  // a line a game puts together at runtime is said from the recordings of its sentences
  const rec = (...texts) => ({ nl: texts.map(t => ({ id: lineKey(t), file: `nl/${lineKey(t)}.mp3`, secs: 1 })), en: [] });
  const m2 = rec('Welke komt hierna?', 'De vier rotsplaneten, dichtst bij de zon eerst', 'Tik op de klokjes.');
  is('test_voice_a_whole_line_is_one_recording', clipsForLine(m2, 'nl', 'Tik op de klokjes.').length, 1);
  is('test_voice_a_full_stop_left_off_still_finds_the_recording', clipsForLine(m2, 'nl', 'Tik op de klokjes').length, 1);
  is('test_voice_a_line_put_together_is_said_from_its_sentences',
    clipsForLine(m2, 'nl', 'Welke komt hierna? De vier rotsplaneten, dichtst bij de zon eerst.').length, 2);
  is('test_voice_one_sentence_missing_sends_the_whole_line_to_the_device',
    clipsForLine(m2, 'nl', 'Welke komt hierna? Iets wat niemand insprak.'), null);
  is('test_voice_nothing_recorded_means_the_device', clipsForLine(rec(), 'nl', 'Hoi.'), null);
  const m3 = rec('Lampje', 'Twaalf ohm gloeiend draad.', 'Die nog even niet', 'De vier rotsplaneten');
  is('test_voice_a_name_and_its_note_across_a_dash_are_two_recordings',
    clipsForLine(m3, 'nl', 'Lampje — Twaalf ohm gloeiend draad.').length, 2);
  is('test_voice_a_note_of_two_sentences_recorded_whole_is_found_after_the_dash',
    clipsForLine(rec('Lampje', 'Twaalf ohm. Hoe meer stroom, hoe feller.'), 'nl', 'Lampje — Twaalf ohm. Hoe meer stroom, hoe feller.').length, 2);
  is('test_voice_two_pieces_glued_without_a_stop_are_found',
    clipsForLine(m3, 'nl', 'Die nog even niet De vier rotsplaneten').length, 2);

  const good = { nl: [{ id: 'a', file: 'nl/a.mp3', secs: 1.2 }], en: [{ id: 'a', file: 'en/a.mp3', secs: 1.1 }] };
  is('test_voice_a_good_manifest_survives', cleanManifest(good), good);
  is('test_voice_nothing_recorded_is_not_an_error', cleanManifest({ nl: [], en: [] }), { nl: [], en: [] });
  is('test_voice_a_missing_manifest_opens_empty', cleanManifest(null), { nl: [], en: [] });
  is('test_voice_nonsense_opens_empty', cleanManifest('kaas'), { nl: [], en: [] });
  is('test_voice_a_row_without_a_file_is_dropped',
    cleanManifest({ nl: [{ id: 'a' }], en: [] }).nl, []);
  is('test_voice_a_row_without_an_id_is_dropped',
    cleanManifest({ nl: [{ file: 'a.mp3' }], en: [] }).nl, []);
  is('test_voice_a_line_recorded_twice_keeps_the_first',
    cleanManifest({ nl: [{ id: 'a', file: 'one.mp3' }, { id: 'a', file: 'two.mp3' }], en: [] }).nl[0].file, 'one.mp3');
  is('test_voice_a_length_that_makes_no_sense_becomes_nothing',
    cleanManifest({ nl: [{ id: 'a', file: 'a.mp3', secs: -3 }], en: [] }).nl[0].secs, 0);

  is('test_voice_a_recorded_line_is_found', clipFor(good, 'nl', 'a').file, 'nl/a.mp3');
  is('test_voice_each_language_has_its_own_recording', clipFor(good, 'en', 'a').file, 'en/a.mp3');
  is('test_voice_a_line_nobody_recorded_falls_back', clipFor(good, 'nl', 'b'), null);
  is('test_voice_a_line_recorded_in_one_language_only_falls_back_in_the_other',
    clipFor({ nl: [{ id: 'a', file: 'nl/a.mp3', secs: 1 }], en: [] }, 'en', 'a'), null);
}

// ---------------------------------------------------------------- A day, a sitting, a limit

{
  const S = await bundle('src/platform/session.ts', 'session.mjs');
  const { limitsForAge, limitIsGuidance, dayKey, useToday, limitsFor, leftToday, roomFor,
    isLastGo, spent, spend, finished, allows, cleanChild, cleanUsed } = S;
  group('Platform — the day');

  const kid = (over = {}) => ({ id: 'a', name: 'Kind', years: 5, domains: [], limits: null, warn: false, ...over });
  const TODAY = '2026-09-22';
  const used = (over = {}) => ({ date: TODAY, minutes: 0, finished: 0, ...over });

  // the guidance, and where it stops being guidance
  is('test_limits_a_three_year_old_gets_the_shortest_day', limitsForAge(3), { perDay: 30, perSitting: 10 });
  is('test_limits_a_five_year_old_gets_the_hour', limitsForAge(5), { perDay: 60, perSitting: 15 });
  is('test_limits_never_shrink_as_a_child_grows',
    [2,3,4,5,6,7,8,9,10].every((a, i, all) => i === 0 || limitsForAge(a).perDay >= limitsForAge(all[i-1]).perDay), true);
  is('test_limits_a_sitting_is_always_shorter_than_a_day',
    [2,4,6,8,10].every(a => limitsForAge(a).perSitting < limitsForAge(a).perDay), true);
  is('test_limits_say_where_the_evidence_stops',
    [2,4,6].every(a => limitIsGuidance(a)) && [7,8,10].every(a => !limitIsGuidance(a)), true);

  // a day is a date, so midnight needs no timer
  is('test_day_is_written_as_a_date', dayKey(new Date(2026, 8, 22)), '2026-09-22');
  is('test_day_pads_a_single_digit', dayKey(new Date(2026, 0, 5)), '2026-01-05');
  is('test_day_yesterdays_tally_is_todays_empty_one',
    useToday(used({ date: '2026-09-21', minutes: 29 }), TODAY), { date: TODAY, minutes: 0, finished: 0 });
  is('test_day_todays_tally_is_kept', useToday(used({ minutes: 12 }), TODAY).minutes, 12);

  // what is left
  is('test_left_a_fresh_day_is_the_whole_allowance', leftToday(used(), kid(), TODAY), 60);
  is('test_left_counts_down', leftToday(used({ minutes: 25 }), kid(), TODAY), 35);
  is('test_left_never_goes_negative', leftToday(used({ minutes: 400 }), kid(), TODAY), 0);
  is('test_left_a_parents_own_limit_wins',
    leftToday(used(), kid({ limits: { perDay: 20, perSitting: 10 } }), TODAY), 20);

  // room for one more: a twelve minute game is not offered when four minutes are left
  is('test_room_a_long_game_is_refused_at_the_end_of_the_day',
    roomFor(used({ minutes: 56 }), kid(), TODAY, 12), false);
  is('test_room_a_short_game_still_fits', roomFor(used({ minutes: 56 }), kid(), TODAY, 3), true);
  is('test_room_nothing_fits_once_the_day_is_spent', roomFor(used({ minutes: 60 }), kid(), TODAY, 1), false);

  // the last go is announced early enough to be enjoyed, not in its final seconds
  is('test_last_go_is_not_announced_at_the_start', isLastGo(used(), kid(), TODAY, 5), false);
  is('test_last_go_is_announced_with_a_whole_game_left',
    isLastGo(used({ minutes: 45 }), kid(), TODAY, 5), true);
  is('test_last_go_is_not_announced_once_there_is_nothing_left',
    isLastGo(used({ minutes: 60 }), kid(), TODAY, 5), false);
  is('test_spent_is_the_end_of_the_day', spent(used({ minutes: 60 }), kid(), TODAY), true);
  is('test_spent_is_not_the_end_a_minute_before', spent(used({ minutes: 59 }), kid(), TODAY), false);

  // counting
  is('test_spend_adds_minutes', spend(used({ minutes: 10 }), TODAY, 5).minutes, 15);
  is('test_spend_ignores_a_negative_minute', spend(used({ minutes: 10 }), TODAY, -5).minutes, 10);
  is('test_spend_on_a_new_day_starts_from_nothing',
    spend(used({ date: '2026-09-21', minutes: 30 }), TODAY, 5).minutes, 5);
  is('test_finished_counts_things_played_to_their_end', finished(used(), TODAY).finished, 1);

  // what a parent switched off
  is('test_domains_an_empty_choice_means_everything', allows(kid(), ['ruimte']), true);
  is('test_domains_a_chosen_subject_is_offered', allows(kid({ domains: ['ruimte'] }), ['ruimte']), true);
  is('test_domains_an_unchosen_subject_is_not', allows(kid({ domains: ['ruimte'] }), ['taal']), false);
  is('test_domains_one_match_is_enough', allows(kid({ domains: ['taal'] }), ['ruimte', 'taal']), true);

  // saves that have been got at
  is('test_clean_a_child_without_an_id_is_not_a_child', cleanChild({ years: 5 }), null);
  is('test_clean_nonsense_is_not_a_child', cleanChild('kaas'), null);
  is('test_clean_an_age_outside_the_app_is_pulled_in', cleanChild({ id: 'a', years: 99 }).years, 10);
  is('test_clean_an_age_below_the_app_is_pulled_in', cleanChild({ id: 'a', years: 0 }).years, 2);
  is('test_clean_a_missing_age_is_the_middle', cleanChild({ id: 'a' }).years, 5);
  is('test_clean_an_absurd_limit_is_pulled_in',
    cleanChild({ id: 'a', limits: { perDay: 9999, perSitting: 9999 } }).limits, { perDay: 240, perSitting: 60 });
  is('test_clean_a_used_record_of_nonsense_opens_empty', cleanUsed('kaas'), { date: '', minutes: 0, finished: 0 });
  is('test_clean_negative_minutes_become_none', cleanUsed({ minutes: -20 }).minutes, 0);
}

// ---------------------------------------------------------------- The door to the parent's app

{
  const G = await bundle('src/platform/gate.ts', 'gate.mjs');
  const { scramble, looksLikePin, tooEasy, TOO_EASY, needsSetup, waitingFor, tryPin, setPin,
    cleanGate, FRESH_GATE, TRIES, COOLDOWN } = G;
  group('Platform — the parent gate');

  is('test_gate_a_new_app_has_no_code_yet', needsSetup(FRESH_GATE), true);
  is('test_gate_four_digits_is_a_code', looksLikePin('4071'), true);
  is('test_gate_three_digits_is_not', looksLikePin('407'), false);
  is('test_gate_letters_are_not', looksLikePin('abcd'), false);
  is('test_gate_a_code_with_a_space_is_not', looksLikePin('40 1'), false);

  is('test_gate_the_obvious_codes_are_refused', TOO_EASY.every(p => tooEasy(p)), true);
  is('test_gate_a_thought_about_code_is_allowed', tooEasy('4071'), false);
  is('test_gate_choosing_an_obvious_code_fails', setPin(FRESH_GATE, '1234').why, 'tooEasy');
  is('test_gate_choosing_three_digits_fails', setPin(FRESH_GATE, '407').why, 'malformed');

  // the code is never stored as itself
  is('test_gate_the_code_is_not_kept_in_the_open', setPin(FRESH_GATE, '4071').state.code.includes('4071'), false);
  is('test_gate_the_same_code_scrambles_the_same_way', scramble('4071'), scramble('4071'));
  is('test_gate_different_codes_scramble_differently', scramble('4071') === scramble('4072'), false);

  const set = setPin(FRESH_GATE, '4071').state;
  is('test_gate_a_code_is_set', needsSetup(set), false);
  is('test_gate_the_right_code_opens_the_door', tryPin(set, '4071', 100).ok, true);
  is('test_gate_the_wrong_code_does_not', tryPin(set, '4072', 100).ok, false);
  is('test_gate_a_malformed_try_is_told_apart_from_a_wrong_one', tryPin(set, 'abc', 100).why, 'malformed');

  // wrong tries in a row close the door for a while
  {
    let g = set;
    for (let i = 0; i < TRIES; i++) g = tryPin(g, '0001', 100).state;
    is('test_gate_five_wrong_tries_close_the_door', waitingFor(g, 100), COOLDOWN);
    is('test_gate_a_closed_door_refuses_even_the_right_code', tryPin(g, '4071', 100).why, 'waiting');
    is('test_gate_the_door_opens_again_after_the_wait', tryPin(g, '4071', 100 + COOLDOWN).ok, true);
    is('test_gate_one_right_try_clears_the_count', tryPin(set, '4071', 100).state.wrong, 0);
  }
  is('test_gate_four_wrong_tries_do_not_close_it',
    (() => { let g = set; for (let i = 0; i < TRIES - 1; i++) g = tryPin(g, '0001', 100).state;
      return waitingFor(g, 100); })(), 0);

  is('test_gate_a_save_of_nonsense_opens_with_no_code', cleanGate('kaas'), FRESH_GATE);
  is('test_gate_a_negative_wait_is_no_wait', cleanGate({ until: -50 }).until, 0);
}

// ---------------------------------------------------------------- the simplest shape, for a toddler

{
  const { SIMPLE_UPTO, simpleFor } = await bundle('src/platform/who.ts', 'who.mjs');
  const { TOOLS, buildSite, soften, strike } = await bundle('src/games/dig/site.ts', 'digsite.mjs');
  group('Suri - the simple shape of a game');

  is('test_simple_a_two_year_old_gets_the_simple_shape', simpleFor(2), true);
  is('test_simple_the_oldest_toddler_gets_it_too', simpleFor(SIMPLE_UPTO), true);
  is('test_simple_a_four_year_old_gets_the_whole_game', simpleFor(SIMPLE_UPTO + 1), false);
  is('test_simple_nobody_filled_in_gets_the_whole_game', simpleFor(null), false);

  // the hardest site in the game, which is the one a brush cannot touch
  const rock = () => buildSite(20, 14, 977, 1, null);
  const brush = TOOLS[0];
  const hardestIn = site => Math.max(...site.hard);
  is('test_dig_hard_rock_is_beyond_the_brush', hardestIn(rock()) > brush.maxHard, true);
  is('test_dig_softening_brings_it_all_within_the_brush', hardestIn(soften(rock())) <= brush.maxHard, true);

  // what that means with a finger on the slab: a stroke that moved nothing now moves rock
  const blocked = () => {
    const site = rock();
    let stuck = 0;
    for (let y = 0; y < site.rows; y++) for (let x = 0; x < site.cols; x++) {
      if (strike(site, brush, x + 0.5, y + 0.5, () => 0.5).blocked) stuck++;
    }
    return stuck;
  };
  is('test_dig_a_brush_on_hard_rock_is_stopped_somewhere', blocked() > 0, true);
  const stuckSoft = (() => {
    const site = soften(rock());
    let stuck = 0;
    for (let y = 0; y < site.rows; y++) for (let x = 0; x < site.cols; x++) {
      if (strike(site, brush, x + 0.5, y + 0.5, () => 0.5).blocked) stuck++;
    }
    return stuck;
  })();
  is('test_dig_a_brush_on_soft_rock_is_never_stopped', stuckSoft, 0);
  // softening only ever takes hardness away, so the grain of the rock underneath is still the
  // grain of that site rather than one flat slab
  is('test_dig_softening_never_makes_a_cell_harder',
    (() => { const a = rock(), b = soften(rock());
      for (let i = 0; i < a.hard.length; i++) if (b.hard[i] > a.hard[i]) return false;
      return true; })(), true);
  is('test_dig_softening_leaves_rock_the_brush_already_moved_alone',
    (() => { const a = rock(), b = soften(rock());
      for (let i = 0; i < a.hard.length; i++) if (a.hard[i] < brush.maxHard * 0.9 && a.hard[i] !== b.hard[i]) return false;
      return true; })(), true);
  is('test_dig_the_brush_can_never_break_bone', brush.risk, 0);
}

// ---------------------------------------------------------------- the discovery journeys

{
  const r = await bundle('src/journey/route.ts', 'route.mjs');
  const { begin, setOff, travel, tellMore, onward, goTo, leftToTell, lineNow, reading, toneAt,
    ahead, seenAll, mix, LEG_SECONDS } = r;
  group('Ontdekreis - travelling, holding and telling');

  const beat = n => ({ say: 'en ' + n, sayNl: 'en ' + n });
  const stop = (id, at, mark, more = 0) => ({
    id, at, mark, title: id, titleNl: id, say: id + '!', sayNl: id + '!',
    more: Array.from({ length: more }, (_, i) => beat(i)), tone: '#102040', picture: { kind: 'none' },
  });
  const J = {
    id: 'test', title: 't', titleNl: 't', opening: 'o', openingNl: 'o', closing: 'c', closingNl: 'c',
    craft: 'pod', axis: 'down', unit: 'm', unitNl: 'm',
    stops: [stop('a', 0, 0, 2), stop('b', 0.5, 100), stop('c', 1, 1000, 1)],
  };
  // a leg, in one go and in many small steps, so the engine cannot depend on the frame rate
  const run = (t, secs, step = LEG_SECONDS) => {
    let out = t;
    for (let left = secs; left > 0; left -= step) out = travel(J, out, Math.min(step, left));
    return out;
  };

  is('test_journey_a_new_trip_is_not_going_anywhere', begin().going, false);
  is('test_journey_a_trip_that_has_not_started_does_not_move', run(begin(), 10).at, 0);
  is('test_journey_starting_twice_changes_nothing', setOff(setOff(begin())).going, true);

  const first = run(setOff(begin()), LEG_SECONDS + 0.1);
  is('test_journey_the_first_stop_is_reached_at_once', first.held, 'a');
  is('test_journey_reaching_a_stop_stops_the_travelling', run(first, 30).held, 'a');
  is('test_journey_a_stop_reached_is_a_stop_seen', first.seen, ['a']);
  is('test_journey_the_arrival_line_is_what_is_said', lineNow(J, first, false), 'a!');

  const more1 = tellMore(J, first);
  is('test_journey_asking_for_more_moves_to_the_next_beat', lineNow(J, more1, false), 'en 0');
  is('test_journey_two_beats_leave_one_after_the_first', leftToTell(J, more1), 1);
  const spent = tellMore(J, tellMore(J, more1));
  is('test_journey_asking_past_the_last_beat_changes_nothing', spent.beat, 2);
  is('test_journey_a_stop_with_nothing_more_to_tell_says_so', leftToTell(J, { ...first, held: 'b' }), 0);

  const leg2 = run(onward(J, spent), LEG_SECONDS + 0.1);
  is('test_journey_going_on_reaches_the_next_stop', leg2.held, 'b');
  is('test_journey_a_new_stop_starts_at_its_own_first_line', leg2.beat, 0);
  is('test_journey_half_a_leg_is_still_between_the_stops', run(onward(J, leg2), LEG_SECONDS / 2).held, null);

  const leg3 = run(onward(J, leg2), LEG_SECONDS + 0.1);
  is('test_journey_the_last_stop_is_reached_like_any_other', leg3.held, 'c');
  is('test_journey_leaving_the_last_stop_ends_the_journey', onward(J, leg3).done, true);
  is('test_journey_a_finished_journey_ends_at_the_end', onward(J, leg3).at, 1);
  is('test_journey_a_finished_journey_does_not_creep_on', run(onward(J, leg3), 10).at, 1);
  is('test_journey_everything_seen_is_everything_seen', seenAll(J, onward(J, leg3).seen), true);
  is('test_journey_two_of_three_is_not_everything', seenAll(J, ['a', 'b']), false);

  // the index may open anything, including something never travelled to
  const jumped = goTo(J, begin(), 'c');
  is('test_journey_the_index_opens_a_stop_that_was_never_reached', jumped.held, 'c');
  is('test_journey_a_stop_opened_from_the_index_counts_as_seen', jumped.seen, ['c']);
  is('test_journey_a_stop_that_does_not_exist_is_ignored', goTo(J, begin(), 'zzz').held, null);

  // the gauge runs between the stops, not across the whole route
  is('test_gauge_at_the_start_reads_the_first_mark', reading(J, 0), 0);
  is('test_gauge_halfway_to_the_middle_stop_is_half_its_mark', reading(J, 0.25), 50);
  is('test_gauge_halfway_on_the_second_leg_uses_the_second_scale', reading(J, 0.75), 550);
  is('test_gauge_past_the_end_reads_the_last_mark', reading(J, 2), 1000);

  is('test_journey_the_colour_between_two_of_one_colour_is_that_colour', toneAt(J, 0.3), '#102040');
  is('test_mix_the_whole_way_is_the_far_colour', mix('#000000', '#ffffff', 1), '#ffffff');
  is('test_mix_halfway_is_halfway', mix('#000000', '#ffffff', 0.5), '#808080');
  is('test_mix_past_the_end_stays_at_the_end', mix('#000000', '#ffffff', 4), '#ffffff');

  is('test_journey_nothing_is_ahead_once_everything_is_seen',
    ahead(J, { ...begin(), seen: ['a', 'b', 'c'] }), null);
}

// ---------------------------------------------------------------- the journeys themselves

{
  const { SOLAR } = await bundle('src/journeys/solar.ts', 'solar.mjs');
  const { seenAll } = await bundle('src/journey/route.ts', 'route2.mjs');
  group('Ontdekreis - the routes that ship');

  const check = j => {
    const ids = j.stops.map(s => s.id);
    return {
      id: j.id,
      first: j.stops[0].at,
      last: j.stops[j.stops.length - 1].at,
      ordered: j.stops.every((s, i) => i === 0 || s.at > j.stops[i - 1].at),
      rising: j.stops.every((s, i) => i === 0 || s.mark >= j.stops[i - 1].mark),
      unique: new Set(ids).size === ids.length,
      spoken: j.stops.every(s => s.say && s.sayNl && s.title && s.titleNl),
      beats: j.stops.every(s => s.more.every(b => b.say && b.sayNl)),
      tones: j.stops.every(s => /^#[0-9a-f]{6}$/.test(s.tone)),
      done: seenAll(j, ids),
    };
  };
  is('test_solar_route_is_whole_and_in_order', check(SOLAR), {
    id: 'reis', first: 0, last: 1, ordered: true, rising: true, unique: true,
    spoken: true, beats: true, tones: true, done: true,
  });
  is('test_solar_route_stops_at_every_planet_and_the_sun', SOLAR.stops.length, 11);
}

// ---------------------------------------------------------------- what the parent is shown

{
  const { recordLevelResult, whenFinished } = await bundle('src/util/storage.ts', 'storage.mjs');
  group('Het dagtotaal - wat een ouder te zien krijgt');

  // the day's tally lives in the clock, which reads storage, so storage cannot read it back: one
  // callback instead, registered when the clock starts. Without this wiring the parent's screen
  // said "0 dingen afgemaakt" for ever, whatever the child did.
  let rung = 0;
  whenFinished(() => { rung++; });
  recordLevelResult('test:a', 10, 3, false);
  is('test_tally_a_level_left_unfinished_is_not_counted', rung, 0);
  recordLevelResult('test:a', 10, 3, true);
  is('test_tally_a_level_played_to_its_end_is_counted', rung, 1);
  recordLevelResult('test:a', 10, 3, true);
  is('test_tally_playing_it_again_is_counted_again', rung, 2);
  is('test_tally_a_finished_level_stays_finished', recordLevelResult('test:a', 1, 0, false).completed, true);
  is('test_tally_the_best_result_is_the_one_that_is_kept',
    [recordLevelResult('test:a', 1, 0, false).best, recordLevelResult('test:a', 1, 0, false).stars], [10, 3]);
}

rmSync(out, { recursive: true, force: true });
console.log(`\n${ran - failed}/${ran} checks passed`);
process.exit(failed ? 1 : 0);

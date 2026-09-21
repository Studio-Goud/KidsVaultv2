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
    collapse, stillAttached, shapeOf, slipperiness, widthOf, canLift, isFlyable } = d;

  /** a column of parts stacked bottom-first, the way a child builds one */
  const col = (c, ids) => {
    const out = [];
    let row = 0;
    for (const id of ids) { out.push({ id, col: c, row }); row += partById(id).rows; }
    return out;
  };
  const stageParts = design =>
    [...stagesByColumn(design)].map(([c, l]) => `${c}:${l.map(s => s.parts.slice().sort((a, b) => a - b).join('+')).join('|')}`).join(' ');

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

rmSync(out, { recursive: true, force: true });
console.log(`\n${ran - failed}/${ran} checks passed`);
process.exit(failed ? 1 : 0);

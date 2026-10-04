/**
 * Katalog der Übungsfiguren: deutscher Name, Figur, Muskeln und Zuordnung zu
 * Bibliotheks-IDs (public/exercise-library.json) bzw. Namen eigener Übungen.
 */
import { findLibraryMatch, getLinks, normalize, peekLibrary } from '../exerciseLibrary'
import * as F from './figures'
import type { FigureEntry, MuscleRegion } from './types'

type Entry = Omit<FigureEntry, 'names' | 'libraryIds'> & { names?: string[]; libraryIds?: string[] }
const E = (e: Entry): FigureEntry => ({ names: [], libraryIds: [], ...e })
const M = (...m: MuscleRegion[]) => m

export const FIGURES: FigureEntry[] = [
  // --- Brust -------------------------------------------------------------
  E({
    id: 'bench-press',
    name: 'Bankdrücken (Langhantel)',
    figure: F.benchPress,
    primary: M('chest'),
    secondary: M('triceps', 'frontDelt'),
    libraryIds: ['Barbell_Bench_Press_-_Medium_Grip', 'Bench_Press_-_Powerlifting', 'Wide-Grip_Barbell_Bench_Press', 'Smith_Machine_Bench_Press', 'Close-Grip_Barbell_Bench_Press', 'Machine_Bench_Press', 'Leverage_Chest_Press'],
    names: ['Bankdrücken', 'Bench Press', 'Flachbankdrücken', 'Bankdrücken Langhantel', 'Brustpresse'],
  }),
  E({
    id: 'incline-press',
    name: 'Schrägbankdrücken',
    figure: F.inclinePress,
    primary: M('chest', 'frontDelt'),
    secondary: M('triceps'),
    libraryIds: ['Barbell_Incline_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press', 'Smith_Machine_Incline_Bench_Press', 'Hammer_Grip_Incline_DB_Bench_Press', 'Leverage_Incline_Chest_Press'],
    names: ['Schrägbankdrücken', 'Incline Bench Press', 'Schrägbankdrücken Langhantel', 'Schrägbankdrücken Kurzhantel', 'Incline Press'],
  }),
  E({
    id: 'db-bench-press',
    name: 'Kurzhantel-Bankdrücken',
    figure: F.dbBenchPress,
    primary: M('chest'),
    secondary: M('triceps', 'frontDelt'),
    libraryIds: ['Dumbbell_Bench_Press', 'Dumbbell_Bench_Press_with_Neutral_Grip', 'Dumbbell_Floor_Press', 'Alternating_Floor_Press'],
    names: ['Kurzhantel Bankdrücken', 'Bankdrücken Kurzhantel', 'Dumbbell Bench Press', 'KH-Bankdrücken'],
  }),
  E({
    id: 'db-fly',
    name: 'Fliegende (Kurzhantel)',
    figure: F.dbFly,
    primary: M('chest'),
    secondary: M('frontDelt'),
    libraryIds: ['Dumbbell_Flyes', 'Incline_Dumbbell_Flyes', 'Flat_Bench_Cable_Flyes'],
    names: ['Fliegende', 'Kurzhantel Fliegende', 'Flys', 'Dumbbell Fly', 'Dumbbell Flyes', 'Kurzhantel-Flys'],
  }),
  E({
    id: 'butterfly',
    name: 'Butterfly (Maschine)',
    figure: F.butterfly,
    primary: M('chest'),
    secondary: M('frontDelt'),
    libraryIds: ['Butterfly', 'Cable_Crossover'],
    names: ['Butterfly', 'Pec Deck', 'Butterfly Maschine', 'Cable Crossover'],
  }),
  E({
    id: 'push-up',
    name: 'Liegestütze',
    figure: F.pushUp,
    primary: M('chest'),
    secondary: M('triceps', 'frontDelt', 'abs'),
    libraryIds: ['Pushups', 'Push-Up_Wide', 'Push-Ups_-_Close_Triceps_Position', 'Pushups_Close_and_Wide_Hand_Positions'],
    names: ['Liegestütz', 'Liegestütze', 'Push-up', 'Push-ups', 'Pushups', 'Push Ups'],
  }),
  E({
    id: 'dips',
    name: 'Dips',
    figure: F.dips,
    primary: M('triceps', 'chest'),
    secondary: M('frontDelt'),
    libraryIds: ['Dips_-_Triceps_Version', 'Dips_-_Chest_Version', 'Parallel_Bar_Dip', 'Dip_Machine'],
    names: ['Dips', 'Barrendips', 'Dip', 'Trizeps Dips'],
  }),
  // --- Schultern ----------------------------------------------------------
  E({
    id: 'ohp',
    name: 'Schulterdrücken (Langhantel)',
    figure: F.ohpBarbell,
    primary: M('frontDelt', 'sideDelt'),
    secondary: M('triceps', 'traps'),
    libraryIds: ['Standing_Military_Press', 'Barbell_Shoulder_Press', 'Seated_Barbell_Military_Press', 'Smith_Machine_Overhead_Shoulder_Press'],
    names: ['Military Press', 'Overhead Press', 'Schulterdrücken Langhantel', 'Schulterdrücken stehend'],
  }),
  E({
    id: 'db-shoulder-press',
    name: 'Schulterdrücken (Kurzhantel)',
    figure: F.dbShoulderPress,
    primary: M('frontDelt', 'sideDelt'),
    secondary: M('triceps'),
    libraryIds: ['Dumbbell_Shoulder_Press', 'Seated_Dumbbell_Press', 'Standing_Dumbbell_Press', 'Arnold_Dumbbell_Press', 'Machine_Shoulder_Military_Press', 'Shoulder_Press_-_With_Bands'],
    names: ['Schulterdrücken', 'Schulterdrücken Kurzhantel', 'Shoulder Press', 'Dumbbell Shoulder Press', 'Arnold Press'],
  }),
  E({
    id: 'lateral-raise',
    name: 'Seitheben',
    figure: F.lateralRaise,
    primary: M('sideDelt'),
    secondary: M('traps', 'frontDelt'),
    libraryIds: ['Side_Lateral_Raise', 'Seated_Side_Lateral_Raise', 'Lateral_Raise_-_With_Bands', 'Standing_Low-Pulley_Deltoid_Raise'],
    names: ['Seitheben', 'Seitheben Kurzhantel', 'Lateral Raise', 'Lateral Raises', 'Side Lateral Raise'],
  }),
  E({
    id: 'front-raise',
    name: 'Frontheben',
    figure: F.frontRaise,
    primary: M('frontDelt'),
    secondary: M('sideDelt'),
    libraryIds: ['Front_Two-Dumbbell_Raise', 'Front_Dumbbell_Raise', 'Single_Dumbbell_Raise', 'Front_Plate_Raise', 'Front_Cable_Raise'],
    names: ['Frontheben', 'Front Raise', 'Front Raises', 'Frontheben Kurzhantel'],
  }),
  E({
    id: 'reverse-fly',
    name: 'Reverse Flys',
    figure: F.reverseFly,
    primary: M('rearDelt'),
    secondary: M('traps', 'lats'),
    libraryIds: ['Reverse_Flyes', 'Seated_Bent-Over_Rear_Delt_Raise', 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench', 'Back_Flyes_-_With_Bands', 'Reverse_Machine_Flyes', 'Cable_Rear_Delt_Fly', 'Band_Pull_Apart'],
    names: ['Reverse Flys', 'Reverse Fly', 'Reverse Flyes', 'Butterfly Reverse', 'Reverse Butterfly', 'Vorgebeugtes Seitheben', 'Rear Delt Fly'],
  }),
  E({
    id: 'face-pull',
    name: 'Face Pulls',
    figure: F.facePull,
    primary: M('rearDelt'),
    secondary: M('traps', 'sideDelt'),
    libraryIds: ['Face_Pull'],
    names: ['Face Pull', 'Face Pulls', 'Facepulls'],
  }),
  // --- Rücken -------------------------------------------------------------
  E({
    id: 'pull-up',
    name: 'Klimmzüge',
    figure: F.pullUp,
    primary: M('lats'),
    secondary: M('biceps', 'rearDelt', 'forearms'),
    libraryIds: ['Pullups', 'Chin-Up', 'Wide-Grip_Rear_Pull-Up', 'V-Bar_Pullup', 'Weighted_Pull_Ups', 'Band_Assisted_Pull-Up'],
    names: ['Klimmzug', 'Klimmzüge', 'Pull-up', 'Pull-ups', 'Pullups', 'Chin-up', 'Chin-ups'],
  }),
  E({
    id: 'lat-pulldown',
    name: 'Latzug',
    figure: F.latPulldown,
    primary: M('lats'),
    secondary: M('biceps', 'rearDelt'),
    libraryIds: ['Wide-Grip_Lat_Pulldown', 'Close-Grip_Front_Lat_Pulldown', 'Underhand_Cable_Pulldowns', 'V-Bar_Pulldown', 'Full_Range-Of-Motion_Lat_Pulldown'],
    names: ['Latzug', 'Lat Pulldown', 'Latziehen', 'Lat-Zug', 'Latzug breit'],
  }),
  E({
    id: 'bent-over-row',
    name: 'Langhantelrudern vorgebeugt',
    figure: F.bentOverRow,
    primary: M('lats', 'rearDelt'),
    secondary: M('biceps', 'lowerBack', 'traps'),
    libraryIds: ['Bent_Over_Barbell_Row', 'Reverse_Grip_Bent-Over_Rows', 'Smith_Machine_Bent_Over_Row', 'Bent_Over_Two-Arm_Long_Bar_Row', 'T-Bar_Row_with_Handle'],
    names: ['Langhantelrudern', 'Rudern vorgebeugt', 'Barbell Row', 'Bent Over Row', 'T-Bar-Rudern'],
  }),
  E({
    id: 'db-row',
    name: 'Kurzhantelrudern vorgebeugt',
    figure: F.bentOverRowDb,
    primary: M('lats', 'rearDelt'),
    secondary: M('biceps', 'lowerBack'),
    libraryIds: ['Bent_Over_Two-Dumbbell_Row', 'Bent_Over_Two-Dumbbell_Row_With_Palms_In', 'Two-Arm_Kettlebell_Row'],
    names: ['Kurzhantelrudern', 'Dumbbell Row', 'Kurzhantelrudern beidarmig'],
  }),
  E({
    id: 'one-arm-row',
    name: 'Kurzhantelrudern einarmig',
    figure: F.oneArmRow,
    primary: M('lats'),
    secondary: M('rearDelt', 'biceps'),
    libraryIds: ['One-Arm_Dumbbell_Row', 'One-Arm_Kettlebell_Row', 'Alternating_Kettlebell_Row'],
    names: ['Einarmiges Rudern', 'Einarmiges Kurzhantelrudern', 'One Arm Dumbbell Row', 'Kurzhantelrudern einarmig'],
  }),
  E({
    id: 'cable-row',
    name: 'Kabelrudern sitzend',
    figure: F.cableRow,
    primary: M('lats'),
    secondary: M('rearDelt', 'biceps', 'traps'),
    libraryIds: ['Seated_Cable_Rows', 'Seated_One-arm_Cable_Pulley_Rows', 'Leverage_Iso_Row'],
    names: ['Kabelrudern', 'Rudern sitzend', 'Rudern am Kabel', 'Seated Cable Row', 'Rudern', 'Rudermaschine'],
  }),
  E({
    id: 'deadlift',
    name: 'Kreuzheben',
    figure: F.deadlift,
    primary: M('glutes', 'hamstrings', 'lowerBack'),
    secondary: M('quads', 'traps', 'forearms', 'lats'),
    libraryIds: ['Barbell_Deadlift', 'Trap_Bar_Deadlift', 'Sumo_Deadlift', 'Deficit_Deadlift', 'Rack_Pulls'],
    names: ['Kreuzheben', 'Deadlift', 'Kreuzheben Langhantel'],
  }),
  E({
    id: 'romanian-deadlift',
    name: 'Rumänisches Kreuzheben',
    figure: F.romanianDeadlift,
    primary: M('hamstrings', 'glutes'),
    secondary: M('lowerBack', 'forearms'),
    libraryIds: ['Romanian_Deadlift', 'Stiff-Legged_Barbell_Deadlift', 'Stiff-Legged_Dumbbell_Deadlift', 'Good_Morning', 'Smith_Machine_Stiff-Legged_Deadlift'],
    names: ['Rumänisches Kreuzheben', 'RDL', 'Romanian Deadlift', 'Kreuzheben mit gestreckten Beinen', 'Steifbeiniges Kreuzheben'],
  }),
  // --- Beine --------------------------------------------------------------
  E({
    id: 'back-squat',
    name: 'Kniebeuge (Langhantel)',
    figure: F.backSquat,
    primary: M('quads', 'glutes'),
    secondary: M('hamstrings', 'lowerBack', 'adductors'),
    libraryIds: ['Barbell_Squat', 'Barbell_Full_Squat', 'Smith_Machine_Squat', 'Wide_Stance_Barbell_Squat', 'Box_Squat', 'Front_Barbell_Squat'],
    names: ['Kniebeuge', 'Kniebeugen', 'Squat', 'Squats', 'Back Squat', 'Kniebeuge Langhantel'],
  }),
  E({
    id: 'goblet-squat',
    name: 'Goblet Squat',
    figure: F.gobletSquat,
    primary: M('quads', 'glutes'),
    secondary: M('adductors', 'abs'),
    libraryIds: ['Goblet_Squat', 'Dumbbell_Squat', 'Plie_Dumbbell_Squat', 'Front_Squats_With_Two_Kettlebells'],
    names: ['Goblet Squat', 'Goblet Squats', 'Kniebeuge mit Kurzhantel', 'Kniebeuge Kettlebell'],
  }),
  E({
    id: 'air-squat',
    name: 'Kniebeuge (Körpergewicht)',
    figure: F.airSquat,
    primary: M('quads', 'glutes'),
    secondary: M('hamstrings', 'adductors'),
    libraryIds: ['Bodyweight_Squat', 'Squats_-_With_Bands', 'Chair_Squat'],
    names: ['Air Squat', 'Air Squats', 'Bodyweight Squat', 'Kniebeuge ohne Gewicht', 'Kniebeugen Körpergewicht'],
  }),
  E({
    id: 'jump-squat',
    name: 'Sprungkniebeuge',
    figure: F.jumpSquat,
    primary: M('quads', 'glutes'),
    secondary: M('calves', 'hamstrings'),
    libraryIds: ['Freehand_Jump_Squat', 'Weighted_Jump_Squat', 'Knee_Tuck_Jump'],
    names: ['Jump Squat', 'Jump Squats', 'Sprungkniebeugen', 'Squat Jumps', 'Hocksprünge'],
  }),
  E({
    id: 'wall-sit',
    name: 'Wandsitzen',
    figure: F.wallSit,
    primary: M('quads'),
    secondary: M('glutes'),
    names: ['Wandsitzen', 'Wall Sit', 'Wall Sits', 'Wandsitz', 'Stuhl an der Wand'],
  }),
  E({
    id: 'leg-press',
    name: 'Beinpresse',
    figure: F.legPress,
    primary: M('quads', 'glutes'),
    secondary: M('hamstrings', 'adductors'),
    libraryIds: ['Leg_Press', 'Narrow_Stance_Leg_Press', 'Smith_Machine_Leg_Press', 'Hack_Squat'],
    names: ['Beinpresse', 'Leg Press', 'Beinpresse 45°'],
  }),
  E({
    id: 'lunge',
    name: 'Ausfallschritte',
    figure: F.lunge,
    primary: M('quads', 'glutes'),
    secondary: M('hamstrings', 'adductors'),
    libraryIds: ['Dumbbell_Lunges', 'Bodyweight_Walking_Lunge', 'Barbell_Lunge', 'Barbell_Walking_Lunge', 'Dumbbell_Rear_Lunge', 'Split_Jump', 'Scissors_Jump'],
    names: ['Ausfallschritt', 'Ausfallschritte', 'Lunges', 'Lunge', 'Walking Lunges', 'Ausfallschritte Kurzhantel'],
  }),
  E({
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    figure: F.bulgarianSplitSquat,
    primary: M('quads', 'glutes'),
    secondary: M('hamstrings', 'adductors'),
    libraryIds: ['Split_Squat_with_Dumbbells', 'One_Leg_Barbell_Squat', 'Smith_Single-Leg_Split_Squat'],
    names: ['Bulgarian Split Squat', 'Bulgarische Kniebeuge', 'Bulgarische Split-Kniebeuge', 'Split Squat'],
  }),
  E({
    id: 'hip-thrust',
    name: 'Hip Thrust',
    figure: F.hipThrust,
    primary: M('glutes'),
    secondary: M('hamstrings', 'quads'),
    libraryIds: ['Barbell_Hip_Thrust', 'Smith_Machine_Hip_Raise'],
    names: ['Hip Thrust', 'Hip Thrusts', 'Hüftstoßen', 'Hip Thrust Langhantel'],
  }),
  E({
    id: 'glute-bridge',
    name: 'Glute Bridge',
    figure: F.gluteBridge,
    primary: M('glutes'),
    secondary: M('hamstrings', 'lowerBack'),
    libraryIds: ['Butt_Lift_Bridge', 'Barbell_Glute_Bridge', 'Single_Leg_Glute_Bridge', 'Hip_Lift_with_Band'],
    names: ['Glute Bridge', 'Beckenheben', 'Hüftheben', 'Brücke', 'Glute Bridges'],
  }),
  E({
    id: 'leg-extension',
    name: 'Beinstrecker',
    figure: F.legExtension,
    primary: M('quads'),
    secondary: M(),
    libraryIds: ['Leg_Extensions', 'Single-Leg_Leg_Extension'],
    names: ['Beinstrecker', 'Leg Extension', 'Leg Extensions', 'Beinstrecken'],
  }),
  E({
    id: 'leg-curl',
    name: 'Beinbeuger',
    figure: F.legCurl,
    primary: M('hamstrings'),
    secondary: M('calves'),
    libraryIds: ['Lying_Leg_Curls', 'Seated_Leg_Curl', 'Standing_Leg_Curl'],
    names: ['Beinbeuger', 'Leg Curl', 'Leg Curls', 'Beinbeugen', 'Beinbeuger liegend'],
  }),
  E({
    id: 'calf-raise',
    name: 'Wadenheben',
    figure: F.calfRaise,
    primary: M('calves'),
    secondary: M(),
    libraryIds: ['Standing_Calf_Raises', 'Standing_Dumbbell_Calf_Raise', 'Standing_Barbell_Calf_Raise', 'Smith_Machine_Calf_Raise', 'Calf_Raises_-_With_Bands', 'Calf_Raise_On_A_Dumbbell'],
    names: ['Wadenheben', 'Calf Raise', 'Calf Raises', 'Wadenheben stehend'],
  }),
  // --- Arme ---------------------------------------------------------------
  E({
    id: 'db-curl',
    name: 'Bizepscurls (Kurzhantel)',
    figure: F.dbCurl,
    primary: M('biceps'),
    secondary: M('forearms'),
    libraryIds: ['Dumbbell_Bicep_Curl', 'Dumbbell_Alternate_Bicep_Curl', 'Seated_Dumbbell_Curl', 'Standing_Biceps_Cable_Curl'],
    names: ['Bizepscurls', 'Bizepscurl', 'Bizeps Curls', 'Kurzhantel Curls', 'Biceps Curl', 'Bicep Curls', 'Curls'],
  }),
  E({
    id: 'bb-curl',
    name: 'Bizepscurls (Langhantel)',
    figure: F.bbCurl,
    primary: M('biceps'),
    secondary: M('forearms'),
    libraryIds: ['Barbell_Curl', 'EZ-Bar_Curl', 'Close-Grip_EZ_Bar_Curl', 'Wide-Grip_Standing_Barbell_Curl', 'Close-Grip_Standing_Barbell_Curl'],
    names: ['Langhantel Curls', 'Langhantelcurls', 'Barbell Curl', 'SZ Curls', 'SZ-Curls', 'Bizepscurls Langhantel'],
  }),
  E({
    id: 'hammer-curl',
    name: 'Hammercurls',
    figure: F.hammerCurl,
    primary: M('biceps', 'forearms'),
    secondary: M(),
    libraryIds: ['Hammer_Curls', 'Alternate_Hammer_Curl', 'Cable_Hammer_Curls_-_Rope_Attachment', 'Cross_Body_Hammer_Curl'],
    names: ['Hammercurls', 'Hammer Curls', 'Hammer Curl', 'Hammercurl'],
  }),
  E({
    id: 'triceps-pushdown',
    name: 'Trizepsdrücken am Kabel',
    figure: F.tricepsPushdown,
    primary: M('triceps'),
    secondary: M('forearms'),
    libraryIds: ['Triceps_Pushdown', 'Triceps_Pushdown_-_Rope_Attachment', 'Triceps_Pushdown_-_V-Bar_Attachment', 'Reverse_Grip_Triceps_Pushdown'],
    names: ['Trizepsdrücken', 'Trizeps drücken', 'Trizepsdrücken am Kabel', 'Triceps Pushdown', 'Pushdown', 'Trizeps Kabel'],
  }),
  E({
    id: 'skull-crusher',
    name: 'Skull Crusher',
    figure: F.skullCrusher,
    primary: M('triceps'),
    secondary: M(),
    libraryIds: ['EZ-Bar_Skullcrusher', 'Lying_Triceps_Press', 'Lying_Dumbbell_Tricep_Extension', 'Band_Skull_Crusher'],
    names: ['Skull Crusher', 'Skullcrusher', 'Stirndrücken', 'French Press', 'Liegendes Trizepsdrücken'],
  }),
  E({
    id: 'overhead-triceps',
    name: 'Überkopf-Trizepsstrecken',
    figure: F.overheadTriceps,
    primary: M('triceps'),
    secondary: M(),
    libraryIds: ['Seated_Triceps_Press', 'Standing_Dumbbell_Triceps_Extension', 'Dumbbell_One-Arm_Triceps_Extension', 'Cable_Rope_Overhead_Triceps_Extension', 'Triceps_Overhead_Extension_with_Rope', 'Kettlebell_Overhead_Triceps_Extension'],
    names: ['Overhead Trizeps', 'Overhead-Trizeps', 'Trizepsstrecken über Kopf', 'Überkopf Trizepsstrecken', 'Overhead Triceps Extension', 'Nackendrücken Kurzhantel'],
  }),
  E({
    id: 'triceps-kickback',
    name: 'Trizeps-Kickbacks',
    figure: F.tricepsKickback,
    primary: M('triceps'),
    secondary: M('rearDelt'),
    libraryIds: ['Tricep_Dumbbell_Kickback', 'Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension', 'Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension'],
    names: ['Kickbacks', 'Trizeps Kickbacks', 'Triceps Kickback', 'Trizeps-Kickback'],
  }),
  // --- Rumpf --------------------------------------------------------------
  E({
    id: 'crunch',
    name: 'Crunches',
    figure: F.crunch,
    primary: M('abs'),
    secondary: M('obliques'),
    libraryIds: ['Crunches', 'Crunch_-_Hands_Overhead', 'Tuck_Crunch', 'Weighted_Crunches', 'Sit-Up', '3_4_Sit-Up', 'Cross-Body_Crunch', 'Air_Bike'],
    names: ['Crunch', 'Crunches', 'Bauchpresse', 'Sit-ups', 'Situps'],
  }),
  E({
    id: 'plank',
    name: 'Plank',
    figure: F.plank,
    primary: M('abs'),
    secondary: M('obliques', 'frontDelt', 'glutes', 'quads'),
    libraryIds: ['Plank'],
    names: ['Plank', 'Unterarmstütz', 'Planke', 'Brett', 'Plank (Unterarmstütz)'],
  }),
  E({
    id: 'side-plank',
    name: 'Seitstütz',
    figure: F.sidePlank,
    primary: M('obliques'),
    secondary: M('abs', 'sideDelt', 'glutes'),
    libraryIds: ['Side_Bridge', 'Push_Up_to_Side_Plank'],
    names: ['Seitstütz', 'Side Plank', 'Seitlicher Unterarmstütz', 'Side Bridge'],
  }),
  E({
    id: 'hanging-leg-raise',
    name: 'Hängendes Beinheben',
    figure: F.hangingLegRaise,
    primary: M('abs'),
    secondary: M('obliques', 'forearms', 'lats'),
    libraryIds: ['Hanging_Leg_Raise', 'Knee_Hip_Raise_On_Parallel_Bars', 'Wind_Sprints'],
    names: ['Hängendes Beinheben', 'Beinheben hängend', 'Hanging Leg Raise', 'Hanging Leg Raises', 'Beinheben'],
  }),
  E({
    id: 'russian-twist',
    name: 'Russian Twist',
    figure: F.russianTwist,
    primary: M('obliques'),
    secondary: M('abs'),
    libraryIds: ['Russian_Twist', 'Plate_Twist', 'Cable_Russian_Twists'],
    names: ['Russian Twist', 'Russian Twists', 'Russischer Twist'],
  }),
  E({
    id: 'mountain-climber',
    name: 'Mountain Climbers',
    figure: F.mountainClimber,
    primary: M('abs', 'quads'),
    secondary: M('frontDelt', 'chest', 'glutes'),
    libraryIds: ['Mountain_Climbers', 'Spider_Crawl'],
    names: ['Mountain Climber', 'Mountain Climbers', 'Bergsteiger'],
  }),
  E({
    id: 'burpee',
    name: 'Burpees',
    figure: F.burpee,
    primary: M('quads', 'chest'),
    secondary: M('glutes', 'triceps', 'abs', 'calves'),
    names: ['Burpee', 'Burpees'],
  }),
  E({
    id: 'jumping-jack',
    name: 'Hampelmann',
    figure: F.jumpingJack,
    primary: M('calves', 'sideDelt'),
    secondary: M('adductors', 'glutes'),
    libraryIds: ['Star_Jump'],
    names: ['Hampelmann', 'Jumping Jacks', 'Jumping Jack', 'Star Jumps', 'Hampelmänner'],
  }),
  E({
    id: 'high-knees',
    name: 'High Knees',
    figure: F.highKnees,
    primary: M('quads', 'calves'),
    secondary: M('abs', 'glutes'),
    libraryIds: ['Fast_Skipping', 'Step-up_with_Knee_Raise'],
    names: ['High Knees', 'Kniehebelauf', 'Skipping', 'Knieheben im Stand', 'Laufen auf der Stelle'],
  }),
  E({
    id: 'superman',
    name: 'Superman',
    figure: F.superman,
    primary: M('lowerBack'),
    secondary: M('glutes', 'hamstrings', 'rearDelt'),
    libraryIds: ['Hyperextensions_With_No_Hyperextension_Bench'],
    names: ['Superman', 'Supermans', 'Rückenstrecken am Boden'],
  }),
  E({
    id: 'kettlebell-swing',
    name: 'Kettlebell Swing',
    figure: F.kettlebellSwing,
    primary: M('glutes', 'hamstrings'),
    secondary: M('lowerBack', 'frontDelt', 'abs'),
    libraryIds: ['One-Arm_Kettlebell_Swings', 'Vertical_Swing'],
    names: ['Kettlebell Swing', 'Kettlebell Swings', 'KB Swing'],
  }),
  E({
    id: 'glute-kickback',
    name: 'Glute Kickbacks',
    figure: F.gluteKickback,
    primary: M('glutes'),
    secondary: M('hamstrings', 'lowerBack'),
    libraryIds: ['Glute_Kickback', 'One-Legged_Cable_Kickback'],
    names: ['Glute Kickback', 'Glute Kickbacks', 'Donkey Kicks', 'Kickbacks Vierfüßlerstand'],
  }),
]

// ---------------------------------------------------------------------------
// Zuordnung
// ---------------------------------------------------------------------------

let byId: Map<string, FigureEntry> | null = null
let byLib: Map<string, FigureEntry> | null = null
let byName: Map<string, FigureEntry> | null = null

const baseName = (s: string) => normalize(s.replace(/\([^)]*\)/g, ' '))

function index() {
  if (byId && byLib && byName) return
  byId = new Map()
  byLib = new Map()
  byName = new Map()
  for (const e of FIGURES) {
    byId.set(e.id, e)
    for (const id of e.libraryIds) if (!byLib.has(id)) byLib.set(id, e)
  }
  // Exakte Namen zuerst, danach Kurzformen ohne Klammerzusatz.
  for (const e of FIGURES) {
    for (const n of [e.name, ...e.names]) {
      const k = normalize(n)
      if (k && !byName.has(k)) byName.set(k, e)
    }
  }
  for (const e of FIGURES) {
    for (const n of [e.name, ...e.names]) {
      const k = baseName(n)
      if (k && !byName.has(k)) byName.set(k, e)
    }
  }
}

export function getFigure(id: string): FigureEntry | null {
  index()
  return byId!.get(id) ?? null
}

export function figureForLibraryId(id: string | null | undefined): FigureEntry | null {
  if (!id) return null
  index()
  return byLib!.get(id) ?? null
}

export function figureForName(name: string | null | undefined): FigureEntry | null {
  if (!name) return null
  index()
  const n = normalize(name)
  if (!n) return null
  const hit = byName!.get(n) ?? byName!.get(baseName(name))
  if (hit) return hit
  // Name einer Bibliotheksübung (falls die Bibliothek schon geladen ist).
  const lib = peekLibrary()
  if (lib) {
    const ex = lib.find((e) => normalize(e.name_de) === n || normalize(e.name_en) === n)
    if (ex) return figureForLibraryId(ex.id)
  }
  return null
}

/** Figur zu einer eigenen Übung: gespeicherte Bibliotheks-Verknüpfung, dann Name/Alias. */
export function figureForExercise(exercise: { id: string; name: string } | null | undefined): FigureEntry | null {
  if (!exercise) return null
  const linked = figureForLibraryId(getLinks()[exercise.id])
  if (linked) return linked
  const byNm = figureForName(exercise.name)
  if (byNm) return byNm
  const lib = peekLibrary()
  if (lib) {
    const m = findLibraryMatch(exercise, lib)
    if (m) return figureForLibraryId(m.id)
  }
  return null
}

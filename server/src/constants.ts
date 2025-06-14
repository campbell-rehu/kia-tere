export const LETTER_SETS = {
  easy: [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'L',
    'M',
    'N',
    'O',
    'P',
    'R',
    'S',
    'T',
    'W',
  ], // 18 common letters - easier to find words
  hard: [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  ], // All 26 letters - includes challenging letters like Q, X, Z
} as const;

export const CATEGORIES = [
  'Animals',
  'Foods',
  'Countries',
  'Movies',
  'Sports',
  'Colors',
  'Professions',
  'Things in a Kitchen',
  'School Subjects',
  'Board Games',
  'Fruits',
  'Vegetables',
  'Car Brands',
  'TV Shows',
  'Books',
  'Things You Wear',
  'Musical Instruments',
  'Things in Nature',
  'Superheroes',
  'Pizza Toppings',
  'Things in Space',
  'Board Game Mechanics',
] as const;

export const GAME_CONSTANTS = {
  TURN_TIME: 10, // seconds
  ROUND_END_DELAY: 3000, // milliseconds
  ROOM_CODE_LENGTH: 6,
  ROOM_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  EMPTY_ROOM_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  WINS_TO_END_GAME: 3,
} as const;

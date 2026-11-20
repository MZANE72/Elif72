export type PspButtonId =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'SQUARE'
  | 'CROSS'
  | 'CIRCLE'
  | 'TRIANGLE'
  | 'L'
  | 'R'
  | 'START'
  | 'SELECT';

export type FootballActionId =
  | 'SHOOT'
  | 'PASS'
  | 'CROSS_BALL'
  | 'THROUGH_FN'
  | 'SPRINT'
  | 'PAUSE';

export type TouchActionId =
  | 'SHOOT'
  | 'PASS'
  | 'CROSS_BALL'
  | 'THROUGH_FN'
  | 'SPRINT';

export type ThroughFnMode = 'HYBRID' | 'MODIFIER_ONLY' | 'DIRECT_ONLY';

export type ButtonAccentColor =
  | 'emerald'
  | 'crimson'
  | 'amber'
  | 'cyan'
  | 'indigo'
  | 'slate';

export interface TouchButtonConfig {
  id: TouchActionId;
  label: string;
  x: number; // Percentage 0..100 inside screen overlay
  y: number; // Percentage 0..100 inside screen overlay
  size: number; // Scale multiplier 0.7..1.5
  opacity: number; // 0.3..1.0
  visible: boolean;
  color: ButtonAccentColor;
}

export interface ControlProfile {
  presetId: string;
  keyboard: {
    UP: string;
    DOWN: string;
    LEFT: string;
    RIGHT: string;
    SHOOT: string;
    PASS: string;
    CROSS_BALL: string;
    THROUGH_FN: string;
    SPRINT: string;
    PAUSE: string;
  };
  pspMap: Record<Exclude<FootballActionId, 'PAUSE'>, PspButtonId>;
  throughFnMode: ThroughFnMode;
  touchOverlayEnabled: boolean;
  touchButtons: Record<TouchActionId, TouchButtonConfig>;
}

export type MatchDifficulty = 'AMATEUR' | 'PRO' | 'STAR';

export type GameScreenState =
  | 'TITLE_MENU'
  | 'TEAM_SELECT'
  | 'PLAYING'
  | 'PAUSED'
  | 'HALFTIME'
  | 'FULLTIME';

export interface PlayerRosterEntry {
  number: number;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  speed: number;
  shooting: number;
  passing: number;
}

export interface TeamConfig {
  id: string;
  name: string;
  shortName: string;
  league: string;
  primaryColor: string;
  secondaryColor: string;
  gkColor: string;
  attackRating: number;
  midfieldRating: number;
  defenseRating: number;
  roster: PlayerRosterEntry[];
}

export interface MatchStats {
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeOnTarget: number;
  awayOnTarget: number;
  homePasses: number;
  awayPasses: number;
  homeThroughBalls: number;
  awayThroughBalls: number;
  homeCrosses: number;
  awayCrosses: number;
  homePossessionTicks: number;
  awayPossessionTicks: number;
}

export interface MatchSnapshot {
  screen: GameScreenState;
  minute: number;
  half: 1 | 2;
  stats: MatchStats;
  controlledPlayerName: string;
  controlledPlayerNumber: number;
  controlledStamina: number;
  shotCharge: number;
  fnActive: boolean;
  lastActionToast: string | null;
  goalBanner: {
    scorerName: string;
    teamShort: string;
    teamColor: string;
    minute: number;
    shotType: string;
  } | null;
}

export interface EmulatorSettings {
  soundEnabled: boolean;
  scanlinesEnabled: boolean;
  showFps: boolean;
  wideMode: boolean;
  matchMinutes: number;
  difficulty: MatchDifficulty;
}

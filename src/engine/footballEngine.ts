import { TEAMS } from '../data/presets';
import {
  GameScreenState,
  MatchDifficulty,
  MatchSnapshot,
  MatchStats,
  TeamConfig,
  ThroughFnMode,
} from '../types/emulator';
import { soundEngine } from '../utils/sound';

export const VIEW_W = 960;
export const VIEW_H = 540;

const WORLD_W = 1480;
const WORLD_H = 880;
const PITCH_X = 90;
const PITCH_Y = 70;
const PITCH_W = 1300;
const PITCH_H = 740;
const PITCH_RIGHT = PITCH_X + PITCH_W;
const PITCH_BOTTOM = PITCH_Y + PITCH_H;
const CENTER_X = PITCH_X + PITCH_W / 2;
const CENTER_Y = PITCH_Y + PITCH_H / 2;
const GOAL_HALF_H = 84;
const GOAL_DEPTH = 38;

export interface MatchInputState {
  moveX: number;
  moveY: number;
  sprint: boolean;
  shootHeld: boolean;
  passJustPressed: boolean;
  crossJustPressed: boolean;
  throughJustPressed: boolean;
  throughHeld: boolean;
  fnMode: ThroughFnMode;
}

interface SimPlayer {
  id: string;
  team: 'HOME' | 'AWAY';
  number: number;
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  stamina: number;
  speedRating: number;
  shootingRating: number;
  passingRating: number;
  tackleCooldown: number;
  stunTimer: number;
}

interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  curveX: number;
  curveY: number;
  ownerId: string | null;
  pickupLock: number;
  lastTouchTeam: 'HOME' | 'AWAY';
  lastTouchName: string;
  lastShotType: string;
  trail: Array<{ x: number; y: number; z: number }>;
}

const FORMATION_OFFSETS: Array<{
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  nx: number;
  ny: number;
}> = [
  { role: 'GK', nx: 0.04, ny: 0.5 },
  { role: 'DEF', nx: 0.2, ny: 0.28 },
  { role: 'DEF', nx: 0.2, ny: 0.72 },
  { role: 'MID', nx: 0.36, ny: 0.32 },
  { role: 'MID', nx: 0.36, ny: 0.68 },
  { role: 'FWD', nx: 0.46, ny: 0.22 },
  { role: 'FWD', nx: 0.47, ny: 0.52 },
];

export class FootballMatchEngine {
  public screen: GameScreenState = 'TITLE_MENU';
  public homeTeam: TeamConfig = TEAMS[0];
  public awayTeam: TeamConfig = TEAMS[3];
  public difficulty: MatchDifficulty = 'PRO';
  public matchMinutes = 3;

  private players: SimPlayer[] = [];
  private ball: BallState;
  private controlledPlayerId = 'H6';
  private cameraX = CENTER_X - VIEW_W / 2;
  private cameraY = CENTER_Y - VIEW_H / 2;

  private matchElapsedSec = 0;
  private half: 1 | 2 = 1;
  private goalFreezeTimer = 0;
  private goalBanner: MatchSnapshot['goalBanner'] = null;
  private toastText: string | null = null;
  private toastTimer = 0;
  private netRippleLeft = 0;
  private netRippleRight = 0;

  private shotCharge = 0;
  private isChargingShot = false;
  private fnUsedAsCombo = false;
  private prevThroughHeld = false;

  private aiActionCooldown = 0;
  private stats: MatchStats = this.emptyStats();

  constructor() {
    this.ball = this.createCenterBall();
    this.resetTeamsForKickoff('HOME');
  }

  private emptyStats(): MatchStats {
    return {
      homeGoals: 0,
      awayGoals: 0,
      homeShots: 0,
      awayShots: 0,
      homeOnTarget: 0,
      awayOnTarget: 0,
      homePasses: 0,
      awayPasses: 0,
      homeThroughBalls: 0,
      awayThroughBalls: 0,
      homeCrosses: 0,
      awayCrosses: 0,
      homePossessionTicks: 1,
      awayPossessionTicks: 1,
    };
  }

  private createCenterBall(): BallState {
    return {
      x: CENTER_X,
      y: CENTER_Y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      curveX: 0,
      curveY: 0,
      ownerId: null,
      pickupLock: 0,
      lastTouchTeam: 'HOME',
      lastTouchName: '',
      lastShotType: 'Şut',
      trail: [],
    };
  }

  public startNewMatch(
    home: TeamConfig,
    away: TeamConfig,
    difficulty: MatchDifficulty,
    matchMinutes: number
  ) {
    this.homeTeam = home;
    this.awayTeam = away;
    this.difficulty = difficulty;
    this.matchMinutes = matchMinutes;
    this.stats = this.emptyStats();
    this.matchElapsedSec = 0;
    this.half = 1;
    this.goalFreezeTimer = 0;
    this.goalBanner = null;
    this.shotCharge = 0;
    this.isChargingShot = false;
    this.resetTeamsForKickoff('HOME');
    this.screen = 'PLAYING';
    this.showToast('Santra! Başarılar');
    soundEngine.playWhistle(false);
  }

  public startSecondHalf() {
    this.half = 2;
    this.matchElapsedSec = (this.matchMinutes * 60) / 2;
    this.resetTeamsForKickoff('AWAY');
    this.screen = 'PLAYING';
    this.showToast('İkinci Yarı Başladı');
    soundEngine.playWhistle(false);
  }

  private resetTeamsForKickoff(kickoffTeam: 'HOME' | 'AWAY') {
    this.players = [];
    FORMATION_OFFSETS.forEach((slot, idx) => {
      const hRoster = this.homeTeam.roster[idx] ?? this.homeTeam.roster[0];
      const hx = PITCH_X + slot.nx * PITCH_W;
      const hy = PITCH_Y + slot.ny * PITCH_H;
      this.players.push({
        id: `H${idx}`,
        team: 'HOME',
        number: hRoster.number,
        name: hRoster.name,
        role: slot.role,
        homeX: hx,
        homeY: hy,
        x: idx === 6 && kickoffTeam === 'HOME' ? CENTER_X - 18 : hx,
        y: idx === 6 && kickoffTeam === 'HOME' ? CENTER_Y : hy,
        vx: 0,
        vy: 0,
        facingX: 1,
        facingY: 0,
        stamina: 100,
        speedRating: hRoster.speed,
        shootingRating: hRoster.shooting,
        passingRating: hRoster.passing,
        tackleCooldown: 0,
        stunTimer: 0,
      });

      const aRoster = this.awayTeam.roster[idx] ?? this.awayTeam.roster[0];
      const ax = PITCH_RIGHT - slot.nx * PITCH_W;
      const ay = PITCH_Y + (1 - slot.ny) * PITCH_H;
      this.players.push({
        id: `A${idx}`,
        team: 'AWAY',
        number: aRoster.number,
        name: aRoster.name,
        role: slot.role,
        homeX: ax,
        homeY: ay,
        x: idx === 6 && kickoffTeam === 'AWAY' ? CENTER_X + 18 : ax,
        y: idx === 6 && kickoffTeam === 'AWAY' ? CENTER_Y : ay,
        vx: 0,
        vy: 0,
        facingX: -1,
        facingY: 0,
        stamina: 100,
        speedRating: aRoster.speed,
        shootingRating: aRoster.shooting,
        passingRating: aRoster.passing,
        tackleCooldown: 0,
        stunTimer: 0,
      });
    });

    this.controlledPlayerId = 'H6';
    this.ball = this.createCenterBall();
    this.ball.ownerId = kickoffTeam === 'HOME' ? 'H6' : 'A6';
    this.cameraX = CENTER_X - VIEW_W / 2;
    this.cameraY = CENTER_Y - VIEW_H / 2;
  }

  private showToast(msg: string) {
    this.toastText = msg;
    this.toastTimer = 1.65;
  }

  public getSnapshot(): MatchSnapshot {
    const totalMatchSec = this.matchMinutes * 60;
    const rawMinute = Math.min(90, Math.floor((this.matchElapsedSec / totalMatchSec) * 90));
    const ctrl =
      this.players.find((p) => p.id === this.controlledPlayerId) ?? this.players[0];

    return {
      screen: this.screen,
      minute: rawMinute,
      half: this.half,
      stats: { ...this.stats },
      controlledPlayerName: ctrl?.name ?? '',
      controlledPlayerNumber: ctrl?.number ?? 0,
      controlledStamina: ctrl?.stamina ?? 100,
      shotCharge: this.isChargingShot ? this.shotCharge : 0,
      fnActive: this.prevThroughHeld,
      lastActionToast: this.toastTimer > 0 ? this.toastText : null,
      goalBanner: this.goalBanner,
    };
  }

  public step(dt: number, input: MatchInputState) {
    if (this.screen !== 'PLAYING') return;

    const clampedDt = Math.min(dt, 0.04);

    if (this.toastTimer > 0) {
      this.toastTimer = Math.max(0, this.toastTimer - clampedDt);
    }
    if (this.netRippleLeft > 0) this.netRippleLeft = Math.max(0, this.netRippleLeft - clampedDt);
    if (this.netRippleRight > 0) this.netRippleRight = Math.max(0, this.netRippleRight - clampedDt);

    if (this.goalFreezeTimer > 0) {
      this.goalFreezeTimer -= clampedDt;
      this.updateBallPhysics(clampedDt, true);
      if (this.goalFreezeTimer <= 0) {
        const concededBy = this.goalBanner?.teamShort === this.homeTeam.shortName ? 'AWAY' : 'HOME';
        this.goalBanner = null;
        this.resetTeamsForKickoff(concededBy);
      }
      this.updateCamera(clampedDt);
      return;
    }

    // Match Clock
    this.matchElapsedSec += clampedDt;
    const totalSec = this.matchMinutes * 60;
    if (this.half === 1 && this.matchElapsedSec >= totalSec / 2) {
      this.screen = 'HALFTIME';
      this.isChargingShot = false;
      this.shotCharge = 0;
      soundEngine.playWhistle(false);
      return;
    }
    if (this.half === 2 && this.matchElapsedSec >= totalSec) {
      this.screen = 'FULLTIME';
      this.isChargingShot = false;
      this.shotCharge = 0;
      soundEngine.playWhistle(true);
      return;
    }

    // Possession tracking
    if (this.ball.ownerId) {
      if (this.ball.ownerId.startsWith('H')) this.stats.homePossessionTicks += 1;
      else this.stats.awayPossessionTicks += 1;
    }

    // Ensure controlled player is always on HOME team
    if (this.ball.ownerId && this.ball.ownerId.startsWith('H')) {
      this.controlledPlayerId = this.ball.ownerId;
    }

    const controlled = this.players.find((p) => p.id === this.controlledPlayerId)!;
    const fnActive =
      input.throughHeld && input.fnMode !== 'DIRECT_ONLY';

    if (!input.throughHeld) {
      // If user tapped THROUGH_FN in HYBRID mode without combining with another button, fire Through Ball!
      if (
        this.prevThroughHeld &&
        input.fnMode === 'HYBRID' &&
        !this.fnUsedAsCombo &&
        this.ball.ownerId === controlled.id
      ) {
        this.executeThroughBall(controlled, input, false);
      }
      this.fnUsedAsCombo = false;
    }
    this.prevThroughHeld = input.throughHeld;

    // DIRECT_ONLY mode fires through ball immediately on press
    if (
      input.throughJustPressed &&
      input.fnMode === 'DIRECT_ONLY' &&
      this.ball.ownerId === controlled.id
    ) {
      this.executeThroughBall(controlled, input, false);
    }

    // Handle controlled player actions
    const hasBall = this.ball.ownerId === controlled.id;

    if (hasBall) {
      // 1. PASS or FN + PASS -> Ground Through Ball
      if (input.passJustPressed) {
        if (fnActive) {
          this.fnUsedAsCombo = true;
          this.executeThroughBall(controlled, input, false);
        } else {
          this.executeShortPass(controlled, input);
        }
      }

      // 2. CROSS or FN + CROSS -> Lofted Cross or Lofted Through Ball
      if (input.crossJustPressed) {
        if (fnActive) {
          this.fnUsedAsCombo = true;
          this.executeThroughBall(controlled, input, true);
        } else {
          this.executeCross(controlled, input);
        }
      }

      // 3. SHOOT (charge while held, release to shoot; FN + SHOOT = Finesse Shot)
      if (input.shootHeld) {
        if (!this.isChargingShot) {
          this.isChargingShot = true;
          this.shotCharge = 0.14;
        } else {
          this.shotCharge = Math.min(1.0, this.shotCharge + clampedDt * 1.45);
        }
        if (fnActive) this.fnUsedAsCombo = true;
      } else if (this.isChargingShot) {
        this.executeShot(controlled, input, this.shotCharge, fnActive);
        this.isChargingShot = false;
        this.shotCharge = 0;
      }
    } else {
      // Defending / Off-ball controls
      if (this.isChargingShot && !input.shootHeld) {
        this.isChargingShot = false;
        this.shotCharge = 0;
      }

      // Header / Volley opportunity if ball is loose in air near controlled player!
      const distToBall = Math.hypot(this.ball.x - controlled.x, this.ball.y - controlled.y);
      if (input.shootHeld && distToBall < 48 && this.ball.z > 6 && this.ball.pickupLock <= 0) {
        this.executeVolleyOrHeader(controlled, input, fnActive);
      } else {
        if (input.passJustPressed) {
          this.switchControlledPlayer();
        }
        if (input.shootHeld && controlled.tackleCooldown <= 0) {
          this.attemptTackle(controlled, input);
        }
        if (input.crossJustPressed && distToBall < 46 && this.ball.pickupLock <= 0) {
          this.executeClearance(controlled);
        }
      }
    }

    // Move Controlled Player
    this.moveControlledPlayer(controlled, clampedDt, input);

    // Update AI Teammates & Opponents
    this.updateAiPlayers(clampedDt, input);

    // Update Ball Physics & Goal Detection
    this.updateBallPhysics(clampedDt, false);

    // Update Camera
    this.updateCamera(clampedDt);
  }

  private moveControlledPlayer(
    player: SimPlayer,
    dt: number,
    input: MatchInputState
  ) {
    if (player.stunTimer > 0) {
      player.stunTimer -= dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.vx *= 0.88;
      player.vy *= 0.88;
      return;
    }
    if (player.tackleCooldown > 0) player.tackleCooldown -= dt;

    const mag = Math.hypot(input.moveX, input.moveY);
    const baseSpeed = 190 + (player.speedRating - 70) * 1.9;
    const canSprint = input.sprint && player.stamina > 8 && mag > 0.1;
    const dribblePenalty = this.ball.ownerId === player.id ? 0.93 : 1.0;
    const speed = baseSpeed * (canSprint ? 1.32 : 1.0) * dribblePenalty;

    if (canSprint) {
      player.stamina = Math.max(0, player.stamina - dt * 22);
    } else {
      player.stamina = Math.min(100, player.stamina + dt * (mag > 0.1 ? 8 : 18));
    }

    if (mag > 0.05) {
      const nx = input.moveX / Math.max(1, mag);
      const ny = input.moveY / Math.max(1, mag);
      player.vx = nx * speed;
      player.vy = ny * speed;
      player.facingX = nx;
      player.facingY = ny;
    } else {
      player.vx *= 0.72;
      player.vy *= 0.72;
    }

    player.x = Math.max(PITCH_X - 18, Math.min(PITCH_RIGHT + 18, player.x + player.vx * dt));
    player.y = Math.max(PITCH_Y - 18, Math.min(PITCH_BOTTOM + 18, player.y + player.vy * dt));
  }

  private getAimDirection(player: SimPlayer, input: MatchInputState): { dx: number; dy: number } {
    const mag = Math.hypot(input.moveX, input.moveY);
    if (mag > 0.2) {
      return { dx: input.moveX / mag, dy: input.moveY / mag };
    }
    return { dx: player.facingX, dy: player.facingY };
  }

  private findBestPassTarget(
    passer: SimPlayer,
    aimX: number,
    aimY: number,
    preferForwardRun: boolean
  ): SimPlayer | null {
    let best: SimPlayer | null = null;
    let bestScore = -Infinity;

    for (const mate of this.players) {
      if (mate.team !== passer.team || mate.id === passer.id) continue;
      const dx = mate.x - passer.x;
      const dy = mate.y - passer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30 || dist > 780) continue;

      const dot = (dx / dist) * aimX + (dy / dist) * aimY;
      let score = dot * 2.4 - dist / 650;
      if (preferForwardRun) {
        const attackDir = passer.team === 'HOME' ? 1 : -1;
        score += ((mate.x - passer.x) * attackDir) / 400;
        if (mate.role === 'FWD') score += 0.45;
      }
      if (score > bestScore) {
        bestScore = score;
        best = mate;
      }
    }
    return best;
  }

  private executeShortPass(passer: SimPlayer, input: MatchInputState) {
    const aim = this.getAimDirection(passer, input);
    const target = this.findBestPassTarget(passer, aim.dx, aim.dy, false);
    let tx = passer.x + aim.dx * 220;
    let ty = passer.y + aim.dy * 220;

    if (target) {
      tx = target.x + target.vx * 0.22;
      ty = target.y + target.vy * 0.22;
    }

    const dx = tx - passer.x;
    const dy = ty - passer.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = Math.min(640, 380 + dist * 0.65);

    this.releaseBall(passer, (dx / dist) * speed, (dy / dist) * speed, 18, 0, 0, 'Pas');
    if (passer.team === 'HOME') this.stats.homePasses += 1;
    else this.stats.awayPasses += 1;

    soundEngine.playKick(0.35);
    if (target && passer.team === 'HOME') {
      this.controlledPlayerId = target.id;
    }
  }

  private executeThroughBall(
    passer: SimPlayer,
    input: MatchInputState,
    lofted: boolean
  ) {
    const aim = this.getAimDirection(passer, input);
    const target = this.findBestPassTarget(passer, aim.dx, aim.dy, true);
    const attackDir = passer.team === 'HOME' ? 1 : -1;

    let leadX = passer.x + aim.dx * 300;
    let leadY = passer.y + aim.dy * 300;

    if (target) {
      // Lead the ball into space ahead of the runner!
      leadX = target.x + attackDir * (lofted ? 165 : 130) + target.vx * 0.38;
      leadY = target.y + target.vy * 0.35;
      leadX = Math.max(PITCH_X + 35, Math.min(PITCH_RIGHT - 35, leadX));
      leadY = Math.max(PITCH_Y + 35, Math.min(PITCH_BOTTOM - 35, leadY));
    }

    const dx = leadX - passer.x;
    const dy = leadY - passer.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = lofted ? Math.min(590, 340 + dist * 0.55) : Math.min(720, 440 + dist * 0.62);
    const vz = lofted ? 260 : 28;

    this.releaseBall(
      passer,
      (dx / dist) * speed,
      (dy / dist) * speed,
      vz,
      0,
      0,
      lofted ? 'Havadan Ara Pas' : 'Ara Pas'
    );

    if (passer.team === 'HOME') {
      this.stats.homePasses += 1;
      this.stats.homeThroughBalls += 1;
      this.showToast(lofted ? 'FN + Orta · Havadan Ara Pas' : 'FN · Ara Pas');
      if (target) this.controlledPlayerId = target.id;
    } else {
      this.stats.awayPasses += 1;
      this.stats.awayThroughBalls += 1;
    }

    soundEngine.playThroughBall();
  }

  private executeCross(passer: SimPlayer, input: MatchInputState) {
    const attackDir = passer.team === 'HOME' ? 1 : -1;
    const targetGoalX = attackDir === 1 ? PITCH_RIGHT - 135 : PITCH_X + 135;
    const aim = this.getAimDirection(passer, input);

    // Aim into the penalty box if in attacking half, otherwise high diagonal switch
    const inAttackingHalf =
      attackDir === 1 ? passer.x > CENTER_X - 40 : passer.x < CENTER_X + 40;
    let tx = passer.x + aim.dx * 340;
    let ty = passer.y + aim.dy * 340;

    if (inAttackingHalf) {
      const boxRunner = this.players.find(
        (p) =>
          p.team === passer.team &&
          p.id !== passer.id &&
          p.role === 'FWD' &&
          Math.abs(p.x - targetGoalX) < 260
      );
      tx = boxRunner ? boxRunner.x + attackDir * 28 : targetGoalX;
      ty = boxRunner ? boxRunner.y : CENTER_Y + (passer.y > CENTER_Y ? -45 : 45);
    }

    const dx = tx - passer.x;
    const dy = ty - passer.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = Math.min(620, 320 + dist * 0.58);

    this.releaseBall(passer, (dx / dist) * speed, (dy / dist) * speed, 315, 0, 0, 'Orta');
    if (passer.team === 'HOME') {
      this.stats.homeCrosses += 1;
      this.showToast('Orta Açıldı');
    } else {
      this.stats.awayCrosses += 1;
    }
    soundEngine.playCross();
  }

  private executeShot(
    shooter: SimPlayer,
    input: MatchInputState,
    charge: number,
    finesse: boolean
  ) {
    const goalX = shooter.team === 'HOME' ? PITCH_RIGHT : PITCH_X;
    const aim = this.getAimDirection(shooter, input);

    // Blend player directional input with goal direction so shots feel responsive!
    const toGoalX = goalX - shooter.x;
    const toGoalY = CENTER_Y - shooter.y;
    const goalDist = Math.max(1, Math.hypot(toGoalX, toGoalY));
    const dirToGoalX = toGoalX / goalDist;
    const dirToGoalY = toGoalY / goalDist;

    let shotYOffset = aim.dy * 72;
    if (finesse) {
      // Finesse aims toward far corner
      shotYOffset = shooter.y < CENTER_Y ? 56 : -56;
    }

    const targetY = CENTER_Y + shotYOffset;
    const dx = goalX - shooter.x;
    const dy = targetY - shooter.y;
    const d = Math.max(1, Math.hypot(dx, dy));

    const ratingFactor = 0.88 + (shooter.shootingRating - 70) * 0.006;
    const power = (540 + charge * 460) * ratingFactor;
    const vz = finesse ? 135 + charge * 90 : 85 + charge * 185;

    // Curve for finesse shot
    const curveY = finesse ? (shooter.y < CENTER_Y ? -140 : 140) : 0;

    this.releaseBall(
      shooter,
      (dx / d) * power,
      (dy / d) * power,
      vz,
      0,
      curveY,
      finesse ? 'Plase Şut' : charge > 0.78 ? 'Sert Şut' : 'Şut'
    );

    if (shooter.team === 'HOME') {
      this.stats.homeShots += 1;
      this.showToast(finesse ? 'FN + Şut · Plase!' : `Şut %${Math.round(charge * 100)}`);
    } else {
      this.stats.awayShots += 1;
    }

    soundEngine.playKick(0.85);
  }

  private executeVolleyOrHeader(
    player: SimPlayer,
    input: MatchInputState,
    finesse: boolean
  ) {
    this.ball.ownerId = player.id;
    this.executeShot(player, input, 0.72, finesse);
    this.showToast('Kafa Vuruşu!');
  }

  private executeClearance(player: SimPlayer) {
    const clearDir = player.team === 'HOME' ? 1 : -1;
    this.ball.ownerId = null;
    this.ball.pickupLock = 0.25;
    this.ball.vx = clearDir * 520;
    this.ball.vy = (player.y - CENTER_Y) * 0.4;
    this.ball.vz = 260;
    this.ball.lastTouchTeam = player.team;
    this.ball.lastTouchName = player.name;
    soundEngine.playCross();
    this.showToast('Top Uzaklaştırıldı');
  }

  private attemptTackle(defender: SimPlayer, input: MatchInputState) {
    defender.tackleCooldown = 0.85;
    const aim = this.getAimDirection(defender, input);
    defender.vx = aim.dx * 340;
    defender.vy = aim.dy * 340;
    defender.stunTimer = 0.22;

    const dist = Math.hypot(this.ball.x - defender.x, this.ball.y - defender.y);
    if (dist < 46 && this.ball.z < 30) {
      this.ball.ownerId = defender.id;
      this.ball.pickupLock = 0.16;
      this.ball.lastTouchTeam = defender.team;
      this.ball.lastTouchName = defender.name;
      soundEngine.playKick(0.45);
      this.showToast('Top Kapıldı!');
    }
  }

  private switchControlledPlayer() {
    let best: SimPlayer | null = null;
    let bestDist = Infinity;
    for (const p of this.players) {
      if (p.team !== 'HOME' || p.id === this.controlledPlayerId || p.role === 'GK') continue;
      const d = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best) {
      this.controlledPlayerId = best.id;
    }
  }

  private releaseBall(
    player: SimPlayer,
    vx: number,
    vy: number,
    vz: number,
    curveX: number,
    curveY: number,
    shotType: string
  ) {
    this.ball.ownerId = null;
    this.ball.pickupLock = 0.18;
    this.ball.x = player.x + (vx / Math.max(1, Math.hypot(vx, vy))) * 14;
    this.ball.y = player.y + (vy / Math.max(1, Math.hypot(vx, vy))) * 14;
    this.ball.vx = vx;
    this.ball.vy = vy;
    this.ball.vz = vz;
    this.ball.curveX = curveX;
    this.ball.curveY = curveY;
    this.ball.lastTouchTeam = player.team;
    this.ball.lastTouchName = player.name;
    this.ball.lastShotType = shotType;
  }

  private updateAiPlayers(dt: number, input: MatchInputState) {
    if (this.aiActionCooldown > 0) this.aiActionCooldown -= dt;

    const diffMult =
      this.difficulty === 'AMATEUR' ? 0.8 : this.difficulty === 'PRO' ? 0.96 : 1.09;

    // Nearest defenders for both sides
    const nearestAway = this.findNearestOutfielder('AWAY', this.ball.x, this.ball.y);
    const secondHome = this.findNearestOutfielder(
      'HOME',
      this.ball.x,
      this.ball.y,
      this.controlledPlayerId
    );

    const ballOwner = this.players.find((p) => p.id === this.ball.ownerId) ?? null;

    for (const p of this.players) {
      if (p.id === this.controlledPlayerId) continue;
      if (p.tackleCooldown > 0) p.tackleCooldown -= dt;
      if (p.stunTimer > 0) {
        p.stunTimer -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.88;
        p.vy *= 0.88;
        continue;
      }

      const teamHasBall = ballOwner?.team === p.team;
      const attackDir = p.team === 'HOME' ? 1 : -1;

      if (p.role === 'GK') {
        const gkX = p.team === 'HOME' ? PITCH_X + 28 : PITCH_RIGHT - 28;
        const clampedBallY = Math.max(
          CENTER_Y - GOAL_HALF_H + 14,
          Math.min(CENTER_Y + GOAL_HALF_H - 14, this.ball.y)
        );
        this.steerPlayerToward(p, gkX, clampedBallY, 175 * diffMult, dt);

        if (this.ball.ownerId === p.id && this.aiActionCooldown <= 0) {
          this.aiActionCooldown = 0.55;
          const mate = this.findBestPassTarget(p, attackDir, 0, false);
          if (mate) {
            const dx = mate.x - p.x;
            const dy = mate.y - p.y;
            const dist = Math.max(1, Math.hypot(dx, dy));
            this.releaseBall(p, (dx / dist) * 480, (dy / dist) * 480, 95, 0, 0, 'Kaleci Pası');
            soundEngine.playKick(0.4);
          }
        }
        continue;
      }

      // If this AI player currently holds the ball (AWAY team)
      if (this.ball.ownerId === p.id) {
        const oppGoalX = p.team === 'HOME' ? PITCH_RIGHT : PITCH_X;
        const distToGoal = Math.hypot(oppGoalX - p.x, CENTER_Y - p.y);

        // Shoot when inside striking zone
        if (distToGoal < 330 && this.aiActionCooldown <= 0) {
          this.aiActionCooldown = 0.7;
          const aimY = CENTER_Y + (Math.random() - 0.5) * 110;
          const dx = oppGoalX - p.x;
          const dy = aimY - p.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          const speed = 640 * diffMult;
          this.releaseBall(p, (dx / d) * speed, (dy / d) * speed, 110, 0, 0, 'Şut');
          this.stats.awayShots += 1;
          soundEngine.playKick(0.8);
          continue;
        }

        // Check pressure from nearest opponent
        const nearestPress = this.findNearestOutfielder('HOME', p.x, p.y);
        const underPressure =
          nearestPress && Math.hypot(nearestPress.x - p.x, nearestPress.y - p.y) < 95;

        if (underPressure && this.aiActionCooldown <= 0) {
          this.aiActionCooldown = 0.5;
          const mate = this.findBestPassTarget(p, attackDir, (Math.random() - 0.5) * 0.4, true);
          if (mate) {
            const dx = mate.x - p.x;
            const dy = mate.y - p.y;
            const d = Math.max(1, Math.hypot(dx, dy));
            this.releaseBall(p, (dx / d) * 490, (dy / d) * 490, 22, 0, 0, 'Pas');
            this.stats.awayPasses += 1;
            soundEngine.playKick(0.35);
            continue;
          }
        }

        // Dribble toward goal
        const targetY =
          p.y < CENTER_Y - 120 ? CENTER_Y - 60 : p.y > CENTER_Y + 120 ? CENTER_Y + 60 : p.y;
        this.steerPlayerToward(p, oppGoalX - 110 * attackDir, targetY, 195 * diffMult, dt);
        continue;
      }

      // Off-ball movement
      let targetX = p.homeX;
      let targetY = p.homeY;
      let maxSpd = (165 + (p.speedRating - 70) * 1.4) * (p.team === 'AWAY' ? diffMult : 1.0);

      if (p.team === 'AWAY' && nearestAway?.id === p.id && !teamHasBall) {
        // Press the ball carrier
        targetX = this.ball.x;
        targetY = this.ball.y;
        maxSpd *= 1.08;

        const distBall = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
        if (
          distBall < 32 &&
          this.ball.ownerId &&
          this.ball.ownerId.startsWith('H') &&
          p.tackleCooldown <= 0
        ) {
          p.tackleCooldown = 1.25;
          if (Math.random() < 0.35 * diffMult) {
            this.ball.ownerId = p.id;
            this.ball.pickupLock = 0.25;
            soundEngine.playKick(0.4);
          }
        }
      } else if (
        p.team === 'HOME' &&
        input.throughHeld &&
        secondHome?.id === p.id &&
        !teamHasBall
      ) {
        // FN Teammate Press when defending!
        targetX = this.ball.x;
        targetY = this.ball.y;
        maxSpd *= 1.15;
      } else {
        // Tactical shifting based on ball X
        const shiftX = (this.ball.x - CENTER_X) * 0.45;
        const attackPush = teamHasBall ? attackDir * 145 : -attackDir * 70;
        targetX = Math.max(PITCH_X + 60, Math.min(PITCH_RIGHT - 60, p.homeX + shiftX + attackPush));
        targetY = p.homeY + (this.ball.y - CENTER_Y) * 0.22;

        // Forward runs when teammate has ball
        if (teamHasBall && p.role === 'FWD') {
          targetX = Math.max(
            PITCH_X + 90,
            Math.min(PITCH_RIGHT - 90, this.ball.x + attackDir * 210)
          );
        }
      }

      this.steerPlayerToward(p, targetX, targetY, maxSpd, dt);
    }
  }

  private findNearestOutfielder(
    team: 'HOME' | 'AWAY',
    x: number,
    y: number,
    excludeId?: string
  ): SimPlayer | null {
    let best: SimPlayer | null = null;
    let bestDist = Infinity;
    for (const p of this.players) {
      if (p.team !== team || p.role === 'GK' || p.id === excludeId) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  private steerPlayerToward(
    p: SimPlayer,
    tx: number,
    ty: number,
    speed: number,
    dt: number
  ) {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 6) {
      const nx = dx / dist;
      const ny = dy / dist;
      const actualSpeed = Math.min(speed, dist * 5);
      p.vx = nx * actualSpeed;
      p.vy = ny * actualSpeed;
      p.facingX = nx;
      p.facingY = ny;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else {
      p.vx *= 0.7;
      p.vy *= 0.7;
    }
    p.x = Math.max(PITCH_X - 15, Math.min(PITCH_RIGHT + 15, p.x));
    p.y = Math.max(PITCH_Y - 15, Math.min(PITCH_BOTTOM + 15, p.y));
  }

  private updateBallPhysics(dt: number, inGoalCelebration: boolean) {
    if (this.ball.pickupLock > 0) {
      this.ball.pickupLock = Math.max(0, this.ball.pickupLock - dt);
    }

    if (this.ball.ownerId && !inGoalCelebration) {
      const owner = this.players.find((p) => p.id === this.ball.ownerId);
      if (owner) {
        this.ball.x = owner.x + owner.facingX * 14;
        this.ball.y = owner.y + owner.facingY * 14;
        this.ball.z = 0;
        this.ball.vx = owner.vx;
        this.ball.vy = owner.vy;
        this.ball.vz = 0;
        this.ball.trail = [];
        return;
      }
      this.ball.ownerId = null;
    }

    // Free ball physics (including Z-axis gravity & Magnus curve!)
    this.ball.vx += this.ball.curveX * dt;
    this.ball.vy += this.ball.curveY * dt;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.z > 0 || this.ball.vz !== 0) {
      this.ball.vz -= 640 * dt;
      this.ball.z += this.ball.vz * dt;
      if (this.ball.z <= 0) {
        this.ball.z = 0;
        if (Math.abs(this.ball.vz) > 85) {
          this.ball.vz = -this.ball.vz * 0.45;
        } else {
          this.ball.vz = 0;
        }
      }
    }

    const drag = this.ball.z > 2 ? 0.992 : 0.972;
    const frameDrag = Math.pow(drag, dt * 60);
    this.ball.vx *= frameDrag;
    this.ball.vy *= frameDrag;
    this.ball.curveX *= 0.96;
    this.ball.curveY *= 0.96;

    // Trail for fast shots / crosses
    if (Math.hypot(this.ball.vx, this.ball.vy) > 290) {
      this.ball.trail.push({ x: this.ball.x, y: this.ball.y, z: this.ball.z });
      if (this.ball.trail.length > 10) this.ball.trail.shift();
    } else if (this.ball.trail.length > 0) {
      this.ball.trail.shift();
    }

    if (inGoalCelebration) {
      // Keep ball inside goal net
      if (this.ball.x < PITCH_X - GOAL_DEPTH + 10) {
        this.ball.x = PITCH_X - GOAL_DEPTH + 10;
        this.ball.vx *= -0.3;
      }
      if (this.ball.x > PITCH_RIGHT + GOAL_DEPTH - 10) {
        this.ball.x = PITCH_RIGHT + GOAL_DEPTH - 10;
        this.ball.vx *= -0.3;
      }
      return;
    }

    // Check Goals
    const inGoalY =
      this.ball.y > CENTER_Y - GOAL_HALF_H && this.ball.y < CENTER_Y + GOAL_HALF_H;

    if (inGoalY && this.ball.x > PITCH_RIGHT + 4 && this.ball.z < 92) {
      // HOME SCORES!
      this.stats.homeGoals += 1;
      this.stats.homeOnTarget += 1;
      this.netRippleRight = 1.0;
      this.triggerGoal('HOME');
      return;
    }

    if (inGoalY && this.ball.x < PITCH_X - 4 && this.ball.z < 92) {
      // AWAY SCORES!
      this.stats.awayGoals += 1;
      this.stats.awayOnTarget += 1;
      this.netRippleLeft = 1.0;
      this.triggerGoal('AWAY');
      return;
    }

    // Goalposts bounce
    const posts = [
      { x: PITCH_X, y: CENTER_Y - GOAL_HALF_H },
      { x: PITCH_X, y: CENTER_Y + GOAL_HALF_H },
      { x: PITCH_RIGHT, y: CENTER_Y - GOAL_HALF_H },
      { x: PITCH_RIGHT, y: CENTER_Y + GOAL_HALF_H },
    ];
    for (const post of posts) {
      const dx = this.ball.x - post.x;
      const dy = this.ball.y - post.y;
      const d = Math.hypot(dx, dy);
      if (d < 12 && this.ball.z < 92) {
        const nx = dx / Math.max(1, d);
        const ny = dy / Math.max(1, d);
        const dot = this.ball.vx * nx + this.ball.vy * ny;
        this.ball.vx -= 1.8 * dot * nx;
        this.ball.vy -= 1.8 * dot * ny;
        this.ball.x = post.x + nx * 13;
        this.ball.y = post.y + ny * 13;
        soundEngine.playPostHit();
        this.showToast('Direkten Döndü!');
      }
    }

    // Keep ball in lively play off sideboards / endlines (arcade fluid bounce)
    if (this.ball.y < PITCH_Y + 6) {
      this.ball.y = PITCH_Y + 6;
      this.ball.vy = Math.abs(this.ball.vy) * 0.72;
    } else if (this.ball.y > PITCH_BOTTOM - 6) {
      this.ball.y = PITCH_BOTTOM - 6;
      this.ball.vy = -Math.abs(this.ball.vy) * 0.72;
    }

    if (!inGoalY) {
      if (this.ball.x < PITCH_X + 6) {
        this.ball.x = PITCH_X + 6;
        this.ball.vx = Math.abs(this.ball.vx) * 0.68;
      } else if (this.ball.x > PITCH_RIGHT - 6) {
        this.ball.x = PITCH_RIGHT - 6;
        this.ball.vx = -Math.abs(this.ball.vx) * 0.68;
      }
    }

    // Player ball pickup / GK save
    if (this.ball.pickupLock <= 0 && this.ball.z < 36) {
      for (const p of this.players) {
        const reach = p.role === 'GK' ? 28 : 20;
        const d = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
        if (d < reach) {
          if (p.role === 'GK' && Math.hypot(this.ball.vx, this.ball.vy) > 360) {
            if (p.team === 'AWAY') this.stats.homeOnTarget += 1;
            else this.stats.awayOnTarget += 1;
            this.showToast(`${p.name} Kurtardı!`);
          }
          this.ball.ownerId = p.id;
          this.ball.lastTouchTeam = p.team;
          this.ball.lastTouchName = p.name;
          this.ball.curveX = 0;
          this.ball.curveY = 0;
          if (p.team === 'HOME') {
            this.controlledPlayerId = p.id;
          }
          break;
        }
      }
    }
  }

  private triggerGoal(scoringTeam: 'HOME' | 'AWAY') {
    const team = scoringTeam === 'HOME' ? this.homeTeam : this.awayTeam;
    const totalMatchSec = this.matchMinutes * 60;
    const minute = Math.min(90, Math.max(1, Math.round((this.matchElapsedSec / totalMatchSec) * 90)));

    this.goalFreezeTimer = 2.3;
    this.isChargingShot = false;
    this.shotCharge = 0;
    this.goalBanner = {
      scorerName:
        this.ball.lastTouchTeam === scoringTeam && this.ball.lastTouchName
          ? this.ball.lastTouchName
          : team.roster[6].name,
      teamShort: team.shortName,
      teamColor: team.primaryColor,
      minute,
      shotType: this.ball.lastShotType || 'Gol',
    };
    soundEngine.playGoal();
  }

  private updateCamera(dt: number) {
    const targetCamX = Math.max(
      0,
      Math.min(WORLD_W - VIEW_W, this.ball.x - VIEW_W / 2 + this.ball.vx * 0.14)
    );
    const targetCamY = Math.max(
      0,
      Math.min(WORLD_H - VIEW_H, this.ball.y - VIEW_H / 2 + this.ball.vy * 0.1)
    );
    const lerp = 1 - Math.pow(0.015, dt);
    this.cameraX += (targetCamX - this.cameraX) * lerp;
    this.cameraY += (targetCamY - this.cameraY) * lerp;
  }

  public render(ctx: CanvasRenderingContext2D, input: MatchInputState) {
    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    // Outer stadium apron
    ctx.fillStyle = '#0B131E';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.translate(-this.cameraX, -this.cameraY);

    this.drawPitch(ctx);
    this.drawPassAndFnReticles(ctx, input);
    this.drawGoals(ctx);
    this.drawEntities(ctx);

    ctx.restore();

    // Draw crisp bottom-center radar minimap
    this.drawRadar(ctx);
  }

  private drawPitch(ctx: CanvasRenderingContext2D) {
    // Perimeter ad boards
    ctx.fillStyle = '#111827';
    ctx.fillRect(PITCH_X - 30, PITCH_Y - 24, PITCH_W + 60, PITCH_H + 48);

    const boards = [
      { label: 'eFOOTBALL 26', color: '#059669' },
      { label: 'PPSSPP HD', color: '#1D4ED8' },
      { label: 'SÜPER KUPA', color: '#D97706' },
      { label: 'PRO STADIUM', color: '#334155' },
    ];
    const segW = PITCH_W / 8;
    for (let i = 0; i < 8; i++) {
      const b = boards[i % boards.length];
      ctx.fillStyle = b.color;
      ctx.fillRect(PITCH_X + i * segW + 2, PITCH_Y - 20, segW - 4, 14);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 9px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, PITCH_X + i * segW + segW / 2, PITCH_Y - 10);
    }

    // Mowed Grass Stripes (12 vertical bands)
    const stripeCount = 12;
    const stripeW = PITCH_W / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#11613B' : '#147044';
      ctx.fillRect(PITCH_X + i * stripeW, PITCH_Y, stripeW + 0.5, PITCH_H);
    }

    // Chalk Lines
    ctx.strokeStyle = 'rgba(255,255,255,0.86)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(PITCH_X, PITCH_Y, PITCH_W, PITCH_H);

    // Halfway line & center circle
    ctx.beginPath();
    ctx.moveTo(CENTER_X, PITCH_Y);
    ctx.lineTo(CENTER_X, PITCH_BOTTOM);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 82, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Penalty Boxes
    const penW = 165;
    const penH = 340;
    const sixW = 60;
    const sixH = 185;

    ctx.strokeRect(PITCH_X, CENTER_Y - penH / 2, penW, penH);
    ctx.strokeRect(PITCH_X, CENTER_Y - sixH / 2, sixW, sixH);
    ctx.strokeRect(PITCH_RIGHT - penW, CENTER_Y - penH / 2, penW, penH);
    ctx.strokeRect(PITCH_RIGHT - sixW, CENTER_Y - sixH / 2, sixW, sixH);

    // Penalty arcs
    ctx.beginPath();
    ctx.arc(PITCH_X + 115, CENTER_Y, 68, -0.68, 0.68);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(PITCH_RIGHT - 115, CENTER_Y, 68, Math.PI - 0.68, Math.PI + 0.68);
    ctx.stroke();
  }

  private drawGoals(ctx: CanvasRenderingContext2D) {
    const drawGoal = (isLeft: boolean, ripple: number) => {
      const gx = isLeft ? PITCH_X - GOAL_DEPTH : PITCH_RIGHT;
      const gy = CENTER_Y - GOAL_HALF_H;
      const shake = ripple > 0 ? Math.sin(ripple * 30) * ripple * 5 : 0;

      ctx.fillStyle = 'rgba(248, 250, 252, 0.14)';
      ctx.fillRect(gx + shake, gy, GOAL_DEPTH, GOAL_HALF_H * 2);

      // Net mesh lines
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= GOAL_DEPTH; x += 9) {
        ctx.beginPath();
        ctx.moveTo(gx + x + shake, gy);
        ctx.lineTo(gx + x + shake, gy + GOAL_HALF_H * 2);
        ctx.stroke();
      }
      for (let y = 0; y <= GOAL_HALF_H * 2; y += 12) {
        ctx.beginPath();
        ctx.moveTo(gx + shake, gy + y);
        ctx.lineTo(gx + GOAL_DEPTH + shake, gy + y);
        ctx.stroke();
      }

      // Frame
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(gx + shake, gy, GOAL_DEPTH, GOAL_HALF_H * 2);
    };

    drawGoal(true, this.netRippleLeft);
    drawGoal(false, this.netRippleRight);
  }

  private drawPassAndFnReticles(ctx: CanvasRenderingContext2D, input: MatchInputState) {
    const ctrl = this.players.find((p) => p.id === this.controlledPlayerId);
    if (!ctrl || this.ball.ownerId !== ctrl.id) return;

    const aim = this.getAimDirection(ctrl, input);
    const fnActive = input.throughHeld && input.fnMode !== 'DIRECT_ONLY';
    const target = this.findBestPassTarget(ctrl, aim.dx, aim.dy, fnActive);

    if (target) {
      ctx.save();
      ctx.strokeStyle = fnActive ? 'rgba(34, 211, 238, 0.72)' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = fnActive ? 2 : 1.5;
      ctx.setLineDash([5, 5]);
      const destX = fnActive ? target.x + 95 : target.x;
      const destY = target.y;
      ctx.beginPath();
      ctx.moveTo(ctrl.x, ctrl.y);
      ctx.lineTo(destX, destY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(destX, destY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawEntities(ctx: CanvasRenderingContext2D) {
    // Sort players + ball by Y for natural depth overlap
    const sortedPlayers = [...this.players].sort((a, b) => a.y - b.y);

    for (const p of sortedPlayers) {
      this.drawPlayer(ctx, p);
    }

    // Ball trail
    for (let i = 0; i < this.ball.trail.length; i++) {
      const t = this.ball.trail[i];
      const alpha = ((i + 1) / this.ball.trail.length) * 0.25;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y - t.z * 0.55, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ball shadow
    const shadowScale = Math.max(0.45, 1 - this.ball.z / 240);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.beginPath();
    ctx.ellipse(
      this.ball.x + 2,
      this.ball.y + 4,
      7.5 * shadowScale,
      4.5 * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Ball sphere (elevated by z)
    const bx = this.ball.x;
    const by = this.ball.y - this.ball.z * 0.55;
    const radius = 6.5 + Math.min(4, this.ball.z * 0.028);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(bx, by, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Classic pentagon pattern dot
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(bx - 1.5, by - 1, radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, p: SimPlayer) {
    const isControlled = p.id === this.controlledPlayerId;
    const team = p.team === 'HOME' ? this.homeTeam : this.awayTeam;
    const bodyColor = p.role === 'GK' ? team.gkColor : team.primaryColor;
    const trimColor = p.role === 'GK' ? '#0F172A' : team.secondaryColor;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 11, 11, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Active Player Ring + Shot Power Gauge
    if (isControlled) {
      ctx.strokeStyle = this.prevThroughHeld ? '#22D3EE' : '#34D399';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 10, 15, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Overhead arrow indicator
      ctx.fillStyle = this.prevThroughHeld ? '#22D3EE' : '#34D399';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 23);
      ctx.lineTo(p.x - 5.5, p.y - 31);
      ctx.lineTo(p.x + 5.5, p.y - 31);
      ctx.closePath();
      ctx.fill();

      // Shot Charge Bar directly beneath player
      if (this.isChargingShot) {
        const bw = 38;
        const bh = 5;
        const bx = p.x - bw / 2;
        const by = p.y + 19;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle =
          this.shotCharge > 0.8
            ? '#F43F5E'
            : this.shotCharge > 0.45
              ? '#F59E0B'
              : '#10B981';
        ctx.fillRect(bx, by, bw * this.shotCharge, bh);
      }
    }

    // Jersey / Torso
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();

    // Collar / Trim Stripe
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Head
    ctx.fillStyle = '#F3D0B1';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 10, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Jersey Number
    const isLightKit = bodyColor.toUpperCase() === '#F8FAFC';
    ctx.fillStyle = isLightKit ? '#0F172A' : '#FFFFFF';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(p.number), p.x, p.y + 0.5);

    // Subtle Name Label for controlled player
    if (isControlled) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.font = '600 9.5px "Plus Jakarta Sans", sans-serif';
      const w = ctx.measureText(p.name).width + 10;
      ctx.fillRect(p.x - w / 2, p.y - 45, w, 13);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(p.name, p.x, p.y - 38.5);
    }
  }

  private drawRadar(ctx: CanvasRenderingContext2D) {
    const rw = 148;
    const rh = 84;
    const rx = VIEW_W / 2 - rw / 2;
    const ry = VIEW_H - rh - 10;

    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 24, 0.72)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(rx + rw / 2, ry);
    ctx.lineTo(rx + rw / 2, ry + rh);
    ctx.stroke();

    for (const p of this.players) {
      const px = rx + ((p.x - PITCH_X) / PITCH_W) * rw;
      const py = ry + ((p.y - PITCH_Y) / PITCH_H) * rh;
      ctx.fillStyle =
        p.id === this.controlledPlayerId
          ? '#34D399'
          : p.team === 'HOME'
            ? this.homeTeam.primaryColor === '#111827'
              ? '#E2E8F0'
              : this.homeTeam.primaryColor
            : this.awayTeam.primaryColor;
      ctx.beginPath();
      ctx.arc(px, py, p.id === this.controlledPlayerId ? 3 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ball dot
    const bx = rx + ((this.ball.x - PITCH_X) / PITCH_W) * rw;
    const by = ry + ((this.ball.y - PITCH_Y) / PITCH_H) * rh;
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(bx, by, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

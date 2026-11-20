import React from 'react';
import { Play, RotateCcw, Sliders, Trophy, Users } from 'lucide-react';
import { TEAMS, formatKeyCode } from '../data/presets';
import {
  ControlProfile,
  MatchDifficulty,
  MatchSnapshot,
  TeamConfig,
} from '../types/emulator';

interface ScreenOverlaysProps {
  snapshot: MatchSnapshot;
  homeTeam: TeamConfig;
  awayTeam: TeamConfig;
  difficulty: MatchDifficulty;
  matchMinutes: number;
  profile: ControlProfile;
  onChangeHomeTeam: (team: TeamConfig) => void;
  onChangeAwayTeam: (team: TeamConfig) => void;
  onChangeDifficulty: (diff: MatchDifficulty) => void;
  onChangeMinutes: (mins: number) => void;
  onStartMatch: () => void;
  onGoTeamSelect: () => void;
  onResume: () => void;
  onStartSecondHalf: () => void;
  onGoTitle: () => void;
  onOpenCustomizer: () => void;
}

export const ScreenOverlays: React.FC<ScreenOverlaysProps> = ({
  snapshot,
  homeTeam,
  awayTeam,
  difficulty,
  matchMinutes,
  profile,
  onChangeHomeTeam,
  onChangeAwayTeam,
  onChangeDifficulty,
  onChangeMinutes,
  onStartMatch,
  onGoTeamSelect,
  onResume,
  onStartSecondHalf,
  onGoTitle,
  onOpenCustomizer,
}) => {
  const { screen, minute, half, stats } = snapshot;
  const totalPoss = Math.max(1, stats.homePossessionTicks + stats.awayPossessionTicks);
  const homePossPct = Math.round((stats.homePossessionTicks / totalPoss) * 100);
  const awayPossPct = 100 - homePossPct;

  if (screen === 'TITLE_MENU') {
    return (
      <div className="absolute inset-0 z-10 flex flex-col justify-between bg-gradient-to-br from-[#071527] via-[#0B1E38] to-[#08121E] p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wider text-emerald-400">
              PPSSPP · PSP-3000 HD SÜRÜMÜ
            </p>
            <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              eFOOTBALL <span className="text-amber-400">26</span>
            </h1>
            <p className="mt-1 max-w-md text-xs text-slate-300 sm:text-sm">
              Özelleştirilebilir Şut, Pas, Orta Açma ve Fonksiyon/Ara Pas tuşlarıyla tam kontrol.
            </p>
          </div>
          <div className="hidden text-right text-xs text-slate-300 sm:block">
            <p className="font-semibold text-white">Aktif Eşleşme</p>
            <p className="mt-0.5 tabular-nums">
              {homeTeam.name} vs {awayTeam.name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] text-slate-400">Şut Tuşu</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-rose-300">
              {formatKeyCode(profile.keyboard.SHOOT)}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] text-slate-400">Pas Tuşu</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-emerald-300">
              {formatKeyCode(profile.keyboard.PASS)}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] text-slate-400">Orta Açma</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-amber-300">
              {formatKeyCode(profile.keyboard.CROSS_BALL)}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] text-slate-400">Ara Pas · FN</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-cyan-300">
              {formatKeyCode(profile.keyboard.THROUGH_FN)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStartMatch}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            Hızlı Maça Başla
          </button>
          <button
            type="button"
            onClick={onGoTeamSelect}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer whitespace-nowrap"
          >
            <Users className="h-4 w-4" />
            Takım & Zorluk Seç
          </button>
          <button
            type="button"
            onClick={onOpenCustomizer}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/25 cursor-pointer whitespace-nowrap"
          >
            <Sliders className="h-4 w-4" />
            Tuşları Özelleştir
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'TEAM_SELECT') {
    return (
      <div className="absolute inset-0 z-10 flex flex-col justify-between bg-[#0A1424]/95 p-4 text-white sm:p-5">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2.5">
          <h2 className="font-display text-xl font-bold tracking-wide sm:text-2xl">
            TAKIM VE MAÇ AYARLARI
          </h2>
          <button
            type="button"
            onClick={onGoTitle}
            className="text-xs font-medium text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
          >
            Ana Menüye Dön
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 my-2 overflow-y-auto pr-1">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-emerald-400">
              Ev Sahibi (Sen)
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {TEAMS.map((t) => {
                const active = t.id === homeTeam.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChangeHomeTeam(t)}
                    className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                      active
                        ? 'border-emerald-400 bg-emerald-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-sm border border-white/30"
                        style={{ backgroundColor: t.primaryColor }}
                      />
                      <span className="truncate font-semibold">{t.name}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {t.attackRating}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-amber-400">
              Deplasman (Rakip)
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {TEAMS.map((t) => {
                const active = t.id === awayTeam.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChangeAwayTeam(t)}
                    className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-sm border border-white/30"
                        style={{ backgroundColor: t.primaryColor }}
                      />
                      <span className="truncate font-semibold">{t.name}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {t.attackRating}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-2.5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1 rounded-md bg-white/5 p-1">
              {(['AMATEUR', 'PRO', 'STAR'] as MatchDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChangeDifficulty(d)}
                  className={`rounded px-2.5 py-1 font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    difficulty === d
                      ? 'bg-slate-200 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {d === 'AMATEUR' ? 'Amatör' : d === 'PRO' ? 'Profesyonel' : 'Yıldız'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-md bg-white/5 p-1">
              {[2, 3, 5].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChangeMinutes(m)}
                  className={`rounded px-2.5 py-1 font-mono font-medium transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    matchMinutes === m
                      ? 'bg-slate-200 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {m} dk
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onStartMatch}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            Santra Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Top Broadcast Scorebug (Always visible during match/pause) */}
      <div className="pointer-events-none absolute top-2.5 left-3 right-3 z-10 flex items-start justify-between gap-3">
        <div className="flex items-center overflow-hidden rounded-md border border-white/15 bg-slate-950/85 text-xs shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-1.5 px-2.5 py-1">
            <span
              className="inline-block h-2.5 w-1.5 rounded-xs"
              style={{ backgroundColor: homeTeam.primaryColor }}
            />
            <span className="font-display text-sm font-bold tracking-wide text-white">
              {homeTeam.shortName}
            </span>
          </div>
          <div className="bg-white/10 px-2.5 py-1 font-display text-base font-extrabold text-amber-300 tabular-nums">
            {stats.homeGoals} - {stats.awayGoals}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1">
            <span className="font-display text-sm font-bold tracking-wide text-white">
              {awayTeam.shortName}
            </span>
            <span
              className="inline-block h-2.5 w-1.5 rounded-xs"
              style={{ backgroundColor: awayTeam.primaryColor }}
            />
          </div>
          <div className="border-l border-white/15 bg-emerald-500/20 px-2 py-1 font-mono text-xs font-bold text-emerald-300 tabular-nums">
            {minute}&apos; · {half === 1 ? '1Y' : '2Y'}
          </div>
        </div>

        {/* Active FN Function Key Combo Indicator */}
        {snapshot.fnActive && profile.throughFnMode !== 'DIRECT_ONLY' && (
          <div className="rounded-md border border-cyan-400/50 bg-cyan-950/90 px-2.5 py-1 text-[11px] font-medium text-cyan-200 shadow-lg backdrop-blur-sm whitespace-nowrap">
            FN Aktif: +Pas Ara Pas · +Orta Havadan · +Şut Plase
          </div>
        )}
      </div>

      {/* Transient Match Toast */}
      {snapshot.lastActionToast && screen === 'PLAYING' && (
        <div className="pointer-events-none absolute top-11 left-1/2 z-10 -translate-x-1/2 rounded-md border border-white/15 bg-slate-950/85 px-3 py-1 text-xs font-semibold text-white shadow">
          {snapshot.lastActionToast}
        </div>
      )}

      {/* Controlled Player Stamina HUD (Bottom Left) */}
      {screen === 'PLAYING' && (
        <div className="pointer-events-none absolute bottom-2.5 left-3 z-10 rounded-md border border-white/15 bg-slate-950/80 px-2.5 py-1.5 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-emerald-400 tabular-nums">
              #{snapshot.controlledPlayerNumber}
            </span>
            <span className="font-semibold text-white">
              {snapshot.controlledPlayerName}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-400 transition-all duration-75"
              style={{ width: `${Math.round(snapshot.controlledStamina)}%` }}
            />
          </div>
        </div>
      )}

      {/* Goal Celebration Overlay */}
      {snapshot.goalBanner && screen === 'PLAYING' && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex justify-center">
          <div className="rounded-xl border border-amber-300/50 bg-slate-950/92 px-8 py-4 text-center shadow-2xl backdrop-blur-md">
            <p className="font-display text-4xl font-extrabold tracking-wider text-amber-400">
              GOOOOL!
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {snapshot.goalBanner.scorerName} ({snapshot.goalBanner.teamShort}) ·{' '}
              {snapshot.goalBanner.minute}&apos; · {snapshot.goalBanner.shotType}
            </p>
          </div>
        </div>
      )}

      {/* PAUSED Modal */}
      {screen === 'PAUSED' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-xs rounded-xl border border-white/15 bg-slate-900 p-5 text-center shadow-2xl">
            <h3 className="font-display text-2xl font-bold tracking-wide text-white">
              OYUN DURAKLATILDI
            </h3>
            <p className="mt-1 text-xs text-slate-400 tabular-nums">
              {homeTeam.shortName} {stats.homeGoals} - {stats.awayGoals}{' '}
              {awayTeam.shortName} · {minute}. Dakika
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={onResume}
                className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                Maça Devam Et
              </button>
              <button
                type="button"
                onClick={onOpenCustomizer}
                className="w-full rounded-lg border border-cyan-400/35 bg-cyan-500/15 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
              >
                Tuşları & Butonları Düzenle
              </button>
              <button
                type="button"
                onClick={onStartMatch}
                className="w-full rounded-lg border border-white/15 bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10 cursor-pointer"
              >
                Maçı Yeniden Başlat
              </button>
              <button
                type="button"
                onClick={onGoTitle}
                className="w-full rounded-lg py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
              >
                Ana Menüye Çık
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HALFTIME / FULLTIME Summary */}
      {(screen === 'HALFTIME' || screen === 'FULLTIME') && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-slate-900 p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="inline-flex items-center gap-1.5 font-display text-xl font-bold text-amber-400">
                <Trophy className="h-5 w-5" />
                {screen === 'HALFTIME' ? 'DEVRE ARASI' : 'MAÇ SONUCU'}
              </span>
              <span className="font-display text-2xl font-extrabold tabular-nums">
                {homeTeam.shortName} {stats.homeGoals} - {stats.awayGoals}{' '}
                {awayTeam.shortName}
              </span>
            </div>

            <div className="mt-3 space-y-1.5 text-xs">
              {[
                ['Toplam Şut', stats.homeShots, stats.awayShots],
                ['İsabetli Şut', stats.homeOnTarget, stats.awayOnTarget],
                ['Pas', stats.homePasses, stats.awayPasses],
                ['Ara Pas (FN)', stats.homeThroughBalls, stats.awayThroughBalls],
                ['Orta Açma', stats.homeCrosses, stats.awayCrosses],
                ['Topla Oynama', `%${homePossPct}`, `%${awayPossPct}`],
              ].map(([label, hVal, aVal]) => (
                <div
                  key={String(label)}
                  className="grid grid-cols-3 items-center rounded bg-white/5 px-3 py-1.5"
                >
                  <span className="font-mono font-semibold text-emerald-300 tabular-nums">
                    {hVal}
                  </span>
                  <span className="text-center text-slate-300">{label}</span>
                  <span className="text-right font-mono font-semibold text-amber-300 tabular-nums">
                    {aVal}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {screen === 'HALFTIME' ? (
                <button
                  type="button"
                  onClick={onStartSecondHalf}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
                >
                  <Play className="h-4 w-4 fill-current" />
                  2. Yarıya Başla
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onGoTeamSelect}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer whitespace-nowrap"
                  >
                    Takım Değiştir
                  </button>
                  <button
                    type="button"
                    onClick={onStartMatch}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Tekrar Oyna
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

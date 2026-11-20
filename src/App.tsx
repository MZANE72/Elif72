import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Move,
  RotateCcw,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ControlCustomizerPanel } from './components/ControlCustomizerPanel';
import { PspHandheldShell } from './components/PspHandheldShell';
import { ScreenOverlays } from './components/ScreenOverlays';
import { TouchOverlay } from './components/TouchOverlay';
import { CONTROL_PRESETS, PSP_BUTTON_META, TEAMS, formatKeyCode } from './data/presets';
import { FootballMatchEngine, VIEW_H, VIEW_W } from './engine/footballEngine';
import {
  ControlProfile,
  EmulatorSettings,
  FootballActionId,
  MatchDifficulty,
  MatchSnapshot,
  PspButtonId,
  TeamConfig,
  TouchActionId,
} from './types/emulator';
import { soundEngine } from './utils/sound';

const PROFILE_STORAGE_KEY = 'ppsspp_efootball26_profile_v1';
const SETTINGS_STORAGE_KEY = 'ppsspp_efootball26_settings_v1';

function loadSavedProfile(): ControlProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ControlProfile;
      if (parsed?.keyboard && parsed?.touchButtons && parsed?.pspMap) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return structuredClone(CONTROL_PRESETS.efootball_modern);
}

function loadSavedSettings(): EmulatorSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as EmulatorSettings;
  } catch {
    // Ignore storage errors
  }
  return {
    soundEnabled: true,
    scanlinesEnabled: false,
    showFps: true,
    wideMode: false,
    matchMinutes: 3,
    difficulty: 'PRO',
  };
}

export default function App() {
  const [profile, setProfile] = useState<ControlProfile>(() => loadSavedProfile());
  const [settings, setSettings] = useState<EmulatorSettings>(() => loadSavedSettings());

  const [homeTeam, setHomeTeam] = useState<TeamConfig>(TEAMS[0]);
  const [awayTeam, setAwayTeam] = useState<TeamConfig>(TEAMS[3]);

  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [selectedTouchButton, setSelectedTouchButton] =
    useState<TouchActionId>('SHOOT');
  const [fps, setFps] = useState(60);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FootballMatchEngine>(new FootballMatchEngine());
  const profileRef = useRef<ControlProfile>(profile);
  const customizerOpenRef = useRef(customizerOpen);

  useEffect(() => {
    profileRef.current = profile;
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage quota errors
    }
  }, [profile]);

  useEffect(() => {
    soundEngine.enabled = settings.soundEnabled;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  useEffect(() => {
    customizerOpenRef.current = customizerOpen;
  }, [customizerOpen]);

  const [snapshot, setSnapshot] = useState<MatchSnapshot>(() =>
    engineRef.current.getSnapshot()
  );

  // Live Input State Refs for 60fps loop
  const keysDownRef = useRef<Set<string>>(new Set());
  const pspDownRef = useRef<Set<PspButtonId>>(new Set());
  const touchDownRef = useRef<Set<TouchActionId>>(new Set());
  const analogRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Edge detection for single-press actions
  const prevActionsRef = useRef<{
    PASS: boolean;
    CROSS_BALL: boolean;
    THROUGH_FN: boolean;
    PAUSE: boolean;
  }>({
    PASS: false,
    CROSS_BALL: false,
    THROUGH_FN: false,
    PAUSE: false,
  });

  // Visual highlight states for PSP shell & touch overlay
  const [activePspUi, setActivePspUi] = useState<Record<PspButtonId, boolean>>({
    UP: false,
    DOWN: false,
    LEFT: false,
    RIGHT: false,
    SQUARE: false,
    CROSS: false,
    CIRCLE: false,
    TRIANGLE: false,
    L: false,
    R: false,
    START: false,
    SELECT: false,
  });

  const [activeTouchUi, setActiveTouchUi] = useState<Record<TouchActionId, boolean>>({
    SHOOT: false,
    PASS: false,
    CROSS_BALL: false,
    THROUGH_FN: false,
    SPRINT: false,
  });

  const syncUiHighlights = useCallback(() => {
    const prof = profileRef.current;
    const keys = keysDownRef.current;
    const psp = pspDownRef.current;
    const touch = touchDownRef.current;

    const isActionDown = (action: TouchActionId): boolean => {
      const kCode = prof.keyboard[action];
      const pBtn = prof.pspMap[action];
      return keys.has(kCode) || psp.has(pBtn) || touch.has(action);
    };

    setActiveTouchUi({
      SHOOT: isActionDown('SHOOT'),
      PASS: isActionDown('PASS'),
      CROSS_BALL: isActionDown('CROSS_BALL'),
      THROUGH_FN: isActionDown('THROUGH_FN'),
      SPRINT: isActionDown('SPRINT'),
    });

    const nextPsp: Record<PspButtonId, boolean> = {
      UP: psp.has('UP') || keys.has(prof.keyboard.UP),
      DOWN: psp.has('DOWN') || keys.has(prof.keyboard.DOWN),
      LEFT: psp.has('LEFT') || keys.has(prof.keyboard.LEFT),
      RIGHT: psp.has('RIGHT') || keys.has(prof.keyboard.RIGHT),
      SQUARE: psp.has('SQUARE'),
      CROSS: psp.has('CROSS'),
      CIRCLE: psp.has('CIRCLE'),
      TRIANGLE: psp.has('TRIANGLE'),
      L: psp.has('L'),
      R: psp.has('R'),
      START: psp.has('START'),
      SELECT: psp.has('SELECT'),
    };
    (
      Object.entries(prof.pspMap) as Array<
        [Exclude<FootballActionId, 'PAUSE'>, PspButtonId]
      >
    ).forEach(([act, btn]) => {
      if (isActionDown(act)) nextPsp[btn] = true;
    });
    setActivePspUi(nextPsp);
  }, []);

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (customizerOpenRef.current) return;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code
        )
      ) {
        e.preventDefault();
      }
      if (!keysDownRef.current.has(e.code)) {
        keysDownRef.current.add(e.code);
        syncUiHighlights();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (keysDownRef.current.has(e.code)) {
        keysDownRef.current.delete(e.code);
        syncUiHighlights();
      }
    };

    const onBlur = () => {
      keysDownRef.current.clear();
      pspDownRef.current.clear();
      touchDownRef.current.clear();
      syncUiHighlights();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [syncUiHighlights]);

  // 60FPS Simulation & Render Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let frameCounter = 0;
    let fpsTimer = 0;
    let uiSyncTimer = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      frameCounter += 1;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {
        setFps(Math.round(frameCounter / fpsTimer));
        frameCounter = 0;
        fpsTimer = 0;
      }

      const engine = engineRef.current;
      const prof = profileRef.current;
      const keys = keysDownRef.current;
      const psp = pspDownRef.current;
      const touch = touchDownRef.current;

      // Poll Gamepad if connected
      let gpMoveX = 0;
      let gpMoveY = 0;
      let gpShoot = false;
      let gpPass = false;
      let gpCross = false;
      let gpThrough = false;
      let gpSprint = false;
      let gpPause = false;

      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads?.[0];
      if (pad) {
        if (Math.abs(pad.axes[0] ?? 0) > 0.2) gpMoveX = pad.axes[0];
        if (Math.abs(pad.axes[1] ?? 0) > 0.2) gpMoveY = pad.axes[1];
        if (pad.buttons[14]?.pressed) gpMoveX = -1;
        if (pad.buttons[15]?.pressed) gpMoveX = 1;
        if (pad.buttons[12]?.pressed) gpMoveY = -1;
        if (pad.buttons[13]?.pressed) gpMoveY = 1;
        gpPass = Boolean(pad.buttons[0]?.pressed);
        gpCross = Boolean(pad.buttons[1]?.pressed);
        gpShoot = Boolean(pad.buttons[2]?.pressed);
        gpThrough = Boolean(pad.buttons[3]?.pressed || pad.buttons[4]?.pressed);
        gpSprint = Boolean(pad.buttons[5]?.pressed || pad.buttons[7]?.pressed);
        gpPause = Boolean(pad.buttons[9]?.pressed);
      }

      const isDown = (act: TouchActionId) =>
        keys.has(prof.keyboard[act]) ||
        psp.has(prof.pspMap[act]) ||
        touch.has(act);

      const passNow = isDown('PASS') || gpPass;
      const crossNow = isDown('CROSS_BALL') || gpCross;
      const throughNow = isDown('THROUGH_FN') || gpThrough;
      const shootNow = isDown('SHOOT') || gpShoot;
      const sprintNow = isDown('SPRINT') || gpSprint;
      const pauseNow =
        keys.has(prof.keyboard.PAUSE) || psp.has('START') || gpPause;

      if (pauseNow && !prevActionsRef.current.PAUSE) {
        if (engine.screen === 'PLAYING') {
          engine.screen = 'PAUSED';
          soundEngine.playUiClick();
        } else if (engine.screen === 'PAUSED') {
          engine.screen = 'PLAYING';
          soundEngine.playUiClick();
        }
      }

      let moveX = analogRef.current.x + gpMoveX;
      let moveY = analogRef.current.y + gpMoveY;
      if (keys.has(prof.keyboard.LEFT) || psp.has('LEFT')) moveX -= 1;
      if (keys.has(prof.keyboard.RIGHT) || psp.has('RIGHT')) moveX += 1;
      if (keys.has(prof.keyboard.UP) || psp.has('UP')) moveY -= 1;
      if (keys.has(prof.keyboard.DOWN) || psp.has('DOWN')) moveY += 1;

      const inputState = {
        moveX: Math.max(-1, Math.min(1, moveX)),
        moveY: Math.max(-1, Math.min(1, moveY)),
        sprint: sprintNow,
        shootHeld: shootNow,
        passJustPressed: passNow && !prevActionsRef.current.PASS,
        crossJustPressed: crossNow && !prevActionsRef.current.CROSS_BALL,
        throughJustPressed: throughNow && !prevActionsRef.current.THROUGH_FN,
        throughHeld: throughNow,
        fnMode: prof.throughFnMode,
      };

      prevActionsRef.current = {
        PASS: passNow,
        CROSS_BALL: crossNow,
        THROUGH_FN: throughNow,
        PAUSE: pauseNow,
      };

      if (!isEditingLayout && !customizerOpenRef.current) {
        engine.step(dt, inputState);
      }

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        engine.render(ctx, inputState);
      }

      uiSyncTimer += dt;
      if (uiSyncTimer >= 0.05) {
        uiSyncTimer = 0;
        setSnapshot(engine.getSnapshot());
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isEditingLayout]);

  const handlePspDown = (btn: PspButtonId) => {
    if (btn === 'SELECT') {
      setSettings((s) => ({ ...s, wideMode: !s.wideMode }));
      return;
    }
    pspDownRef.current.add(btn);
    syncUiHighlights();
  };

  const handlePspUp = (btn: PspButtonId) => {
    pspDownRef.current.delete(btn);
    syncUiHighlights();
  };

  const handleTouchActionDown = (id: TouchActionId) => {
    touchDownRef.current.add(id);
    syncUiHighlights();
  };

  const handleTouchActionUp = (id: TouchActionId) => {
    touchDownRef.current.delete(id);
    syncUiHighlights();
  };

  const handleStartMatch = () => {
    soundEngine.playUiClick();
    engineRef.current.startNewMatch(
      homeTeam,
      awayTeam,
      settings.difficulty,
      settings.matchMinutes
    );
    setSnapshot(engineRef.current.getSnapshot());
  };

  const handleMoveTouchButton = (id: TouchActionId, x: number, y: number) => {
    setProfile((prev) => ({
      ...prev,
      touchButtons: {
        ...prev.touchButtons,
        [id]: {
          ...prev.touchButtons[id],
          x,
          y,
        },
      },
    }));
  };

  const openCustomizerForButton = (id?: TouchActionId) => {
    if (id) setSelectedTouchButton(id);
    setCustomizerOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0E14] text-slate-100">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (Clean Links) — Zone 3 (1 Primary Action) */}
      <header className="border-b border-slate-800/80 bg-[#0E121A]/95 px-6 py-3.5">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-8">
          <a
            href="#emulator"
            onClick={(e) => {
              e.preventDefault();
              engineRef.current.screen = 'TITLE_MENU';
              setSnapshot(engineRef.current.getSnapshot());
            }}
            className="font-display text-xl font-extrabold tracking-wide text-white whitespace-nowrap shrink-0"
          >
            PPSSPP eFootball 26
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => openCustomizerForButton()}
              className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Tuş Atama
            </button>
            <button
              type="button"
              onClick={() => setIsEditingLayout((v) => !v)}
              className={`hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isEditingLayout ? 'text-cyan-300 underline' : ''
              }`}
            >
              Buton Düzeni
            </button>
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, wideMode: !s.wideMode }))}
              className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {settings.wideMode ? 'PSP Görünümü' : 'Geniş Ekran'}
            </button>
            <button
              type="button"
              onClick={() =>
                setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))
              }
              className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {settings.soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => openCustomizerForButton()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sliders className="h-3.5 w-3.5" />
              Kontrolleri Özelleştir
            </button>
          </div>
        </div>
      </header>

      {/* Main Emulator Stage */}
      <main
        id="emulator"
        className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col justify-center gap-6 px-4 py-6 sm:px-6"
      >
        {/* Emulator Utility Row (above console) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-200">
              ISO: eFootball_2026_EUR.cso
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-emerald-400">
              {fps} FPS
            </span>
            <span aria-hidden="true">·</span>
            <span>
              FN Modu:{' '}
              <strong className="text-cyan-300">
                {profile.throughFnMode === 'HYBRID'
                  ? 'Hibrit (Ara Pas + FN)'
                  : profile.throughFnMode === 'MODIFIER_ONLY'
                    ? 'Saf Fonksiyon Tuşu'
                    : 'Tek Basış Ara Pas'}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingLayout((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                isEditingLayout
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <Move className="h-3.5 w-3.5" />
              {isEditingLayout ? 'Düzenlemeyi Bitir' : 'Butonları Sürükle'}
            </button>

            <button
              type="button"
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  scanlinesEnabled: !s.scanlinesEnabled,
                }))
              }
              className={`rounded-md border px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                settings.scanlinesEnabled
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
              }`}
            >
              LCD Efekti
            </button>

            <button
              type="button"
              onClick={() =>
                setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:border-slate-700 hover:text-white cursor-pointer"
              aria-label="Sesi aç veya kapat"
            >
              {settings.soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-slate-500" />
              )}
              <span>{settings.soundEnabled ? 'Ses' : 'Sessiz'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, wideMode: !s.wideMode }))}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:border-slate-700 hover:text-white cursor-pointer"
            >
              {settings.wideMode ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
              <span>{settings.wideMode ? 'PSP Kasası' : 'Geniş'}</span>
            </button>

            {snapshot.screen === 'PLAYING' && (
              <button
                type="button"
                onClick={handleStartMatch}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:border-slate-700 hover:text-white cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Sıfırla</span>
              </button>
            )}
          </div>
        </div>

        {/* PSP Console + 16:9 Canvas */}
        <PspHandheldShell
          profile={profile}
          wideMode={settings.wideMode}
          scanlinesEnabled={settings.scanlinesEnabled}
          activePspButtons={activePspUi}
          onPspButtonDown={handlePspDown}
          onPspButtonUp={handlePspUp}
          onAnalogMove={(x, y) => {
            analogRef.current = { x, y };
          }}
        >
          <canvas
            ref={canvasRef}
            width={VIEW_W}
            height={VIEW_H}
            className="block h-full w-full"
          />

          <ScreenOverlays
            snapshot={snapshot}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            difficulty={settings.difficulty}
            matchMinutes={settings.matchMinutes}
            profile={profile}
            onChangeHomeTeam={setHomeTeam}
            onChangeAwayTeam={setAwayTeam}
            onChangeDifficulty={(d: MatchDifficulty) =>
              setSettings((s) => ({ ...s, difficulty: d }))
            }
            onChangeMinutes={(m: number) =>
              setSettings((s) => ({ ...s, matchMinutes: m }))
            }
            onStartMatch={handleStartMatch}
            onGoTeamSelect={() => {
              soundEngine.playUiClick();
              engineRef.current.screen = 'TEAM_SELECT';
              setSnapshot(engineRef.current.getSnapshot());
            }}
            onResume={() => {
              soundEngine.playUiClick();
              engineRef.current.screen = 'PLAYING';
              setSnapshot(engineRef.current.getSnapshot());
            }}
            onStartSecondHalf={() => {
              soundEngine.playUiClick();
              engineRef.current.startSecondHalf();
              setSnapshot(engineRef.current.getSnapshot());
            }}
            onGoTitle={() => {
              soundEngine.playUiClick();
              engineRef.current.screen = 'TITLE_MENU';
              setSnapshot(engineRef.current.getSnapshot());
            }}
            onOpenCustomizer={() => openCustomizerForButton()}
          />

          <TouchOverlay
            profile={profile}
            activeActions={activeTouchUi}
            fnActive={snapshot.fnActive}
            isEditingLayout={isEditingLayout}
            selectedButton={selectedTouchButton}
            onSelectButton={(id) => {
              setSelectedTouchButton(id);
            }}
            onMoveButton={handleMoveTouchButton}
            onActionDown={handleTouchActionDown}
            onActionUp={handleTouchActionUp}
          />
        </PspHandheldShell>

        {/* Bottom 4-Action Quick Customization Strip */}
        <section
          aria-label="Özelleştirilebilir Aksiyon Tuşları"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {(
            [
              {
                id: 'SHOOT',
                title: 'Şut Tuşu',
                desc: 'Basılı tutunca güç barı dolar. Defansta müdahale eder.',
                color: 'text-rose-300',
              },
              {
                id: 'PASS',
                title: 'Pas Tuşu',
                desc: 'Takım arkadaşına yerden pas. Defansta oyuncu seçer.',
                color: 'text-emerald-300',
              },
              {
                id: 'CROSS_BALL',
                title: 'Orta Açma',
                desc: 'Ceza sahasına yüksek orta veya uzun kanat değişimi.',
                color: 'text-amber-300',
              },
              {
                id: 'THROUGH_FN',
                title: 'Ara Pas · Fonksiyon (FN)',
                desc: 'Tek basış Ara Pas · Basılı tutup +Pas/+Orta/+Şut kombosu.',
                color: 'text-cyan-300',
              },
            ] as Array<{
              id: TouchActionId;
              title: string;
              desc: string;
              color: string;
            }>
          ).map((card) => {
            const pspBtn = profile.pspMap[card.id];
            const pspMeta = PSP_BUTTON_META[pspBtn];
            const keyLabel = formatKeyCode(profile.keyboard[card.id]);
            const btnCfg = profile.touchButtons[card.id];

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => openCustomizerForButton(card.id)}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#121620] p-4 text-left transition-colors hover:border-slate-600 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-bold ${card.color}`}>
                    {card.title}
                  </span>
                  <span className="font-mono text-xs text-slate-300">
                    {keyLabel} · PSP {pspMeta.symbol}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  {card.desc}
                </p>
                <p className="mt-2.5 text-[11px] font-medium text-slate-300">
                  Buton: {btnCfg.label} · %{Math.round(btnCfg.size * 100)} boyut
                </p>
              </button>
            );
          })}
        </section>
      </main>

      {/* Right Slide-Over Control & Button Customizer */}
      <ControlCustomizerPanel
        isOpen={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        profile={profile}
        onChangeProfile={setProfile}
        isEditingLayout={isEditingLayout}
        onToggleEditLayout={() => {
          setIsEditingLayout((v) => !v);
          if (!isEditingLayout) {
            setProfile((p) => ({ ...p, touchOverlayEnabled: true }));
          }
        }}
        selectedTouchButton={selectedTouchButton}
        onSelectTouchButton={setSelectedTouchButton}
      />
    </div>
  );
}

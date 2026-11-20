import React, { useRef, useState } from 'react';
import { FootballActionId, PspButtonId, ControlProfile } from '../types/emulator';

interface PspHandheldShellProps {
  profile: ControlProfile;
  wideMode: boolean;
  scanlinesEnabled: boolean;
  activePspButtons: Record<PspButtonId, boolean>;
  onPspButtonDown: (btn: PspButtonId) => void;
  onPspButtonUp: (btn: PspButtonId) => void;
  onAnalogMove: (x: number, y: number) => void;
  children: React.ReactNode;
}

const ACTION_SHORT_LABEL: Record<Exclude<FootballActionId, 'PAUSE'>, string> = {
  SHOOT: 'ŞUT',
  PASS: 'PAS',
  CROSS_BALL: 'ORTA',
  THROUGH_FN: 'FN·ARA',
  SPRINT: 'DEPAR',
};

export const PspHandheldShell: React.FC<PspHandheldShellProps> = ({
  profile,
  wideMode,
  scanlinesEnabled,
  activePspButtons,
  onPspButtonDown,
  onPspButtonUp,
  onAnalogMove,
  children,
}) => {
  const nubRef = useRef<HTMLDivElement>(null);
  const [nubOffset, setNubOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingNub, setDraggingNub] = useState(false);

  const getMappedActionLabel = (btn: PspButtonId): string => {
    const entry = (
      Object.entries(profile.pspMap) as Array<
        [Exclude<FootballActionId, 'PAUSE'>, PspButtonId]
      >
    ).find(([, mappedBtn]) => mappedBtn === btn);
    return entry ? ACTION_SHORT_LABEL[entry[0]] : '';
  };

  const updateNubFromPointer = (clientX: number, clientY: number) => {
    if (!nubRef.current) return;
    const rect = nubRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setNubOffset({ x: dx, y: dy });
    onAnalogMove(dx / maxR, dy / maxR);
  };

  const resetNub = () => {
    setDraggingNub(false);
    setNubOffset({ x: 0, y: 0 });
    onAnalogMove(0, 0);
  };

  const bindTouchBtn = (btn: PspButtonId) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      onPspButtonDown(btn);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onPspButtonUp(btn);
    },
    onPointerCancel: () => onPspButtonUp(btn),
  });

  if (wideMode) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-4 border-slate-800 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
          {children}
          {scanlinesEnabled && (
            <div className="psp-lcd-scanlines pointer-events-none absolute inset-0 z-10" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1260px] select-none">
      {/* Shoulder L / R Triggers */}
      <div className="mx-10 flex items-end justify-between px-4">
        <button
          type="button"
          {...bindTouchBtn('L')}
          className={`flex h-7 w-32 items-center justify-center gap-2 rounded-t-2xl border border-b-0 border-slate-700/80 text-xs font-bold tracking-wider transition-transform cursor-pointer touch-none ${
            activePspButtons.L
              ? 'translate-y-0.5 bg-cyan-500/25 text-cyan-200'
              : 'bg-[#1D2330] text-slate-300 hover:bg-[#242B3B]'
          }`}
        >
          <span>L</span>
          {getMappedActionLabel('L') && (
            <span className="font-mono text-[10px] text-cyan-300">
              {getMappedActionLabel('L')}
            </span>
          )}
        </button>

        <button
          type="button"
          {...bindTouchBtn('R')}
          className={`flex h-7 w-32 items-center justify-center gap-2 rounded-t-2xl border border-b-0 border-slate-700/80 text-xs font-bold tracking-wider transition-transform cursor-pointer touch-none ${
            activePspButtons.R
              ? 'translate-y-0.5 bg-indigo-500/25 text-indigo-200'
              : 'bg-[#1D2330] text-slate-300 hover:bg-[#242B3B]'
          }`}
        >
          <span>R</span>
          {getMappedActionLabel('R') && (
            <span className="font-mono text-[10px] text-indigo-300">
              {getMappedActionLabel('R')}
            </span>
          )}
        </button>
      </div>

      {/* Main Handheld Body */}
      <div className="relative rounded-[44px] border border-slate-700/80 bg-gradient-to-b from-[#232936] via-[#171B24] to-[#11151C] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-5">
        <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[175px_1fr_175px]">
          {/* Left Grip: D-Pad & Analog Stick */}
          <div className="hidden lg:flex flex-col items-center justify-center gap-6 py-4">
            {/* D-Pad */}
            <div className="relative h-28 w-28">
              <button
                type="button"
                aria-label="Yukarı"
                {...bindTouchBtn('UP')}
                className={`absolute top-0 left-1/3 flex h-1/3 w-1/3 items-center justify-center rounded-t-md border border-slate-700 text-xs transition-colors cursor-pointer touch-none ${
                  activePspButtons.UP
                    ? 'bg-emerald-500/30 text-white'
                    : 'bg-[#12161F] text-slate-400 hover:text-white'
                }`}
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="Aşağı"
                {...bindTouchBtn('DOWN')}
                className={`absolute bottom-0 left-1/3 flex h-1/3 w-1/3 items-center justify-center rounded-b-md border border-slate-700 text-xs transition-colors cursor-pointer touch-none ${
                  activePspButtons.DOWN
                    ? 'bg-emerald-500/30 text-white'
                    : 'bg-[#12161F] text-slate-400 hover:text-white'
                }`}
              >
                ▼
              </button>
              <button
                type="button"
                aria-label="Sol"
                {...bindTouchBtn('LEFT')}
                className={`absolute top-1/3 left-0 flex h-1/3 w-1/3 items-center justify-center rounded-l-md border border-slate-700 text-xs transition-colors cursor-pointer touch-none ${
                  activePspButtons.LEFT
                    ? 'bg-emerald-500/30 text-white'
                    : 'bg-[#12161F] text-slate-400 hover:text-white'
                }`}
              >
                ◀
              </button>
              <button
                type="button"
                aria-label="Sağ"
                {...bindTouchBtn('RIGHT')}
                className={`absolute top-1/3 right-0 flex h-1/3 w-1/3 items-center justify-center rounded-r-md border border-slate-700 text-xs transition-colors cursor-pointer touch-none ${
                  activePspButtons.RIGHT
                    ? 'bg-emerald-500/30 text-white'
                    : 'bg-[#12161F] text-slate-400 hover:text-white'
                }`}
              >
                ▶
              </button>
              <div className="pointer-events-none absolute top-1/3 left-1/3 h-1/3 w-1/3 bg-[#12161F]" />
            </div>

            {/* Analog Nub */}
            <div
              ref={nubRef}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                setDraggingNub(true);
                updateNubFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (draggingNub) updateNubFromPointer(e.clientX, e.clientY);
              }}
              onPointerUp={resetNub}
              onPointerCancel={resetNub}
              className="relative flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-[#0D1017] shadow-inner cursor-grab active:cursor-grabbing touch-none"
              title="Analog Çubuk"
            >
              <div
                style={{
                  transform: `translate(${nubOffset.x}px, ${nubOffset.y}px)`,
                }}
                className="h-10 w-10 rounded-full border border-slate-600 bg-gradient-to-b from-slate-700 to-slate-900 shadow-md"
              />
            </div>
          </div>

          {/* Center 16:9 PSP Screen */}
          <div className="flex flex-col">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border-[5px] border-[#0A0D12] bg-black shadow-[inset_0_0_24px_rgba(0,0,0,0.9)]">
              {children}
              {scanlinesEnabled && (
                <div className="psp-lcd-scanlines pointer-events-none absolute inset-0 z-10" />
              )}
            </div>

            {/* Bottom PSP System Bar */}
            <div className="mt-3 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  {...bindTouchBtn('SELECT')}
                  className="rounded-full border border-slate-700 bg-[#12161F] px-3 py-1 font-mono text-[10px] font-bold tracking-wider text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
                >
                  SELECT
                </button>
                <button
                  type="button"
                  {...bindTouchBtn('START')}
                  className="rounded-full border border-slate-700 bg-[#12161F] px-3 py-1 font-mono text-[10px] font-bold tracking-wider text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
                >
                  START
                </button>
              </div>

              <span className="font-display text-sm font-bold tracking-[0.22em] text-slate-400">
                PSP · PPSSPP
              </span>

              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span>16:9 HD</span>
              </div>
            </div>
          </div>

          {/* Right Grip: Triangle, Circle, Cross, Square */}
          <div className="hidden lg:flex flex-col items-center justify-center gap-4 py-4">
            <div className="relative h-36 w-36">
              {/* Triangle (Top) */}
              <button
                type="button"
                {...bindTouchBtn('TRIANGLE')}
                className={`absolute top-0 left-1/2 -translate-x-1/2 flex h-11 w-11 flex-col items-center justify-center rounded-full border border-slate-700 transition-transform cursor-pointer touch-none ${
                  activePspButtons.TRIANGLE
                    ? 'scale-90 bg-emerald-500/30 border-emerald-400'
                    : 'bg-[#12161F] hover:border-slate-500'
                }`}
              >
                <span className="text-sm leading-none text-emerald-400">△</span>
                {getMappedActionLabel('TRIANGLE') && (
                  <span className="mt-0.5 text-[7px] font-bold text-slate-300">
                    {getMappedActionLabel('TRIANGLE')}
                  </span>
                )}
              </button>

              {/* Circle (Right) */}
              <button
                type="button"
                {...bindTouchBtn('CIRCLE')}
                className={`absolute top-1/2 right-0 -translate-y-1/2 flex h-11 w-11 flex-col items-center justify-center rounded-full border border-slate-700 transition-transform cursor-pointer touch-none ${
                  activePspButtons.CIRCLE
                    ? 'scale-90 bg-rose-500/30 border-rose-400'
                    : 'bg-[#12161F] hover:border-slate-500'
                }`}
              >
                <span className="text-sm leading-none text-rose-400">○</span>
                {getMappedActionLabel('CIRCLE') && (
                  <span className="mt-0.5 text-[7px] font-bold text-slate-300">
                    {getMappedActionLabel('CIRCLE')}
                  </span>
                )}
              </button>

              {/* Cross (Bottom) */}
              <button
                type="button"
                {...bindTouchBtn('CROSS')}
                className={`absolute bottom-0 left-1/2 -translate-x-1/2 flex h-11 w-11 flex-col items-center justify-center rounded-full border border-slate-700 transition-transform cursor-pointer touch-none ${
                  activePspButtons.CROSS
                    ? 'scale-90 bg-sky-500/30 border-sky-400'
                    : 'bg-[#12161F] hover:border-slate-500'
                }`}
              >
                <span className="text-sm leading-none text-sky-400">×</span>
                {getMappedActionLabel('CROSS') && (
                  <span className="mt-0.5 text-[7px] font-bold text-slate-300">
                    {getMappedActionLabel('CROSS')}
                  </span>
                )}
              </button>

              {/* Square (Left) */}
              <button
                type="button"
                {...bindTouchBtn('SQUARE')}
                className={`absolute top-1/2 left-0 -translate-y-1/2 flex h-11 w-11 flex-col items-center justify-center rounded-full border border-slate-700 transition-transform cursor-pointer touch-none ${
                  activePspButtons.SQUARE
                    ? 'scale-90 bg-fuchsia-500/30 border-fuchsia-400'
                    : 'bg-[#12161F] hover:border-slate-500'
                }`}
              >
                <span className="text-sm leading-none text-fuchsia-400">□</span>
                {getMappedActionLabel('SQUARE') && (
                  <span className="mt-0.5 text-[7px] font-bold text-slate-300">
                    {getMappedActionLabel('SQUARE')}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

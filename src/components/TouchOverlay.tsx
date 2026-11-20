import React, { useRef, useState } from 'react';
import { TOUCH_ACCENT_STYLES, formatKeyCode } from '../data/presets';
import { ControlProfile, TouchActionId } from '../types/emulator';

interface TouchOverlayProps {
  profile: ControlProfile;
  activeActions: Record<TouchActionId, boolean>;
  fnActive: boolean;
  isEditingLayout: boolean;
  selectedButton: TouchActionId | null;
  onSelectButton: (id: TouchActionId) => void;
  onMoveButton: (id: TouchActionId, x: number, y: number) => void;
  onActionDown: (id: TouchActionId) => void;
  onActionUp: (id: TouchActionId) => void;
}

const ACTION_ORDER: TouchActionId[] = [
  'SHOOT',
  'PASS',
  'CROSS_BALL',
  'THROUGH_FN',
  'SPRINT',
];

export const TouchOverlay: React.FC<TouchOverlayProps> = ({
  profile,
  activeActions,
  fnActive,
  isEditingLayout,
  selectedButton,
  onSelectButton,
  onMoveButton,
  onActionDown,
  onActionUp,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<TouchActionId | null>(null);

  if (!profile.touchOverlayEnabled && !isEditingLayout) {
    return null;
  }

  const getDynamicLabel = (id: TouchActionId, baseLabel: string): string => {
    if (!fnActive || profile.throughFnMode === 'DIRECT_ONLY') return baseLabel;
    if (id === 'PASS') return 'ARA PAS';
    if (id === 'CROSS_BALL') return 'HAV. ARA';
    if (id === 'SHOOT') return 'PLASE';
    return baseLabel;
  };

  const handlePointerDownEdit = (
    e: React.PointerEvent<HTMLButtonElement>,
    id: TouchActionId
  ) => {
    if (!isEditingLayout) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(id);
    onSelectButton(id);
  };

  const handlePointerMoveEdit = (
    e: React.PointerEvent<HTMLButtonElement>,
    id: TouchActionId
  ) => {
    if (!isEditingLayout || draggingId !== id || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    onMoveButton(
      id,
      Math.max(6, Math.min(94, Math.round(xPct * 10) / 10)),
      Math.max(10, Math.min(90, Math.round(yPct * 10) / 10))
    );
  };

  const handlePointerUpEdit = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isEditingLayout) return;
    e.stopPropagation();
    setDraggingId(null);
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-20 ${
        isEditingLayout
          ? 'bg-slate-950/55 backdrop-blur-[1px] ring-2 ring-inset ring-cyan-400/60'
          : 'pointer-events-none'
      }`}
    >
      {isEditingLayout && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-lg border border-cyan-400/40 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-cyan-200 shadow-lg whitespace-nowrap">
          Butonları sürükleyip konumlandırın · Seçili butonu sağ panelden özelleştirin
        </div>
      )}

      {ACTION_ORDER.map((id) => {
        const cfg = profile.touchButtons[id];
        if (!cfg.visible && !isEditingLayout) return null;

        const accent = TOUCH_ACCENT_STYLES[cfg.color] ?? TOUCH_ACCENT_STYLES.slate;
        const isPressed = activeActions[id];
        const isSelected = isEditingLayout && selectedButton === id;
        const keyHint = formatKeyCode(profile.keyboard[id]);
        const displayLabel = getDynamicLabel(id, cfg.label);

        const basePx = 52 * cfg.size;

        return (
          <button
            key={id}
            type="button"
            style={{
              left: `${cfg.x}%`,
              top: `${cfg.y}%`,
              width: `${basePx}px`,
              height: `${basePx}px`,
              opacity: cfg.visible ? cfg.opacity : 0.3,
              transform: `translate(-50%, -50%) scale(${isPressed ? 0.91 : 1})`,
            }}
            onPointerDown={(e) => {
              if (isEditingLayout) {
                handlePointerDownEdit(e, id);
              } else {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                onActionDown(id);
              }
            }}
            onPointerMove={(e) => handlePointerMoveEdit(e, id)}
            onPointerUp={(e) => {
              if (isEditingLayout) {
                handlePointerUpEdit(e);
              } else {
                e.preventDefault();
                onActionUp(id);
              }
            }}
            onPointerCancel={() => {
              if (!isEditingLayout) onActionUp(id);
            }}
            className={`pointer-events-auto absolute flex flex-col items-center justify-center rounded-full border-2 text-white transition-transform duration-75 select-none touch-none ${
              accent.bg
            } ${accent.border} ${
              isPressed || (id === 'THROUGH_FN' && fnActive) ? accent.ring : ''
            } ${
              isSelected
                ? 'ring-4 ring-white ring-offset-2 ring-offset-slate-900 cursor-grab active:cursor-grabbing'
                : isEditingLayout
                  ? 'cursor-grab'
                  : 'cursor-pointer'
            }`}
            aria-label={`${cfg.label} butonu`}
          >
            <span className="font-display text-[11px] leading-none font-bold tracking-wide whitespace-nowrap">
              {displayLabel}
            </span>
            <span className="mt-0.5 font-mono text-[9px] leading-none text-white/80">
              {keyHint}
            </span>
          </button>
        );
      })}
    </div>
  );
};

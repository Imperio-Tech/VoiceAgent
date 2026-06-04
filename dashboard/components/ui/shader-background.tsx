'use client';

import { useRef } from 'react';
import { motion, useAnimationFrame } from 'framer-motion';

// Same random() as the original GLSL shader
function random(t: number): number {
  return (Math.cos(t) + Math.cos(t * 1.3 + 1.3) + Math.cos(t * 1.4 + 1.4)) / 3.0;
}

const OVERALL_SPEED    = 0.2;
const LINE_SPEED       = 1.0  * OVERALL_SPEED;
const LINE_AMPLITUDE   = 1.0;
const LINE_FREQUENCY   = 0.2;
const WARP_SPEED       = 0.2  * OVERALL_SPEED;
const WARP_FREQUENCY   = 0.5;
const WARP_AMPLITUDE   = 1.0;
const OFFSET_FREQUENCY = 0.5;
const OFFSET_SPEED     = 1.33 * OVERALL_SPEED;
const MIN_OFFSET       = 0.6;
const MAX_OFFSET       = 2.0;
const MIN_LINE_W       = 0.01;
const MAX_LINE_W       = 0.2;
const LINES            = 16;
const SCALE            = 5.0;
const STEP             = 4;

export default function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Framer Motion's useAnimationFrame gives a high-precision elapsed time
  // synchronized with the browser render pipeline — smoother than manual RAF
  useAnimationFrame((time) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Auto-resize
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const W = canvas.width;
    const H = canvas.height;
    const t = time / 1000; // ms → seconds

    const toSpaceX = (px: number) => (px - W / 2) / W * 2.0 * SCALE;
    const spaceToPixelY = (sy: number) => (sy / (SCALE * 2)) * W + H / 2;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0, 'rgb(26,26,77)');
    bg.addColorStop(1, 'rgb(77,26,128)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Vertical edge fade
    const vFade = ctx.createLinearGradient(0, 0, 0, H);
    vFade.addColorStop(0,   'rgba(0,0,0,0.92)');
    vFade.addColorStop(0.18,'rgba(0,0,0,0)');
    vFade.addColorStop(0.82,'rgba(0,0,0,0)');
    vFade.addColorStop(1,   'rgba(0,0,0,0.92)');
    ctx.fillStyle = vFade;
    ctx.fillRect(0, 0, W, H);

    // Horizontal edge fade
    const hFade = ctx.createLinearGradient(0, 0, W, 0);
    hFade.addColorStop(0,    'rgba(0,0,0,0.82)');
    hFade.addColorStop(0.18, 'rgba(0,0,0,0)');
    hFade.addColorStop(0.82, 'rgba(0,0,0,0)');
    hFade.addColorStop(1,    'rgba(0,0,0,0.82)');
    ctx.fillStyle = hFade;
    ctx.fillRect(0, 0, W, H);

    // 16 plasma lines
    for (let l = 0; l < LINES; l++) {
      const nli        = l / LINES;
      const offsetTime = t * OFFSET_SPEED;
      const offsetPos  = l + t * OFFSET_FREQUENCY;
      const rand       = random(offsetPos + offsetTime) * 0.5 + 0.5;

      const halfWPx  = ((MIN_LINE_W + (MAX_LINE_W - MIN_LINE_W) * rand) / 2.0)
                       / (SCALE * 2) * W;
      const offset   = random(offsetPos + offsetTime * (1.0 + nli))
                       * (MIN_OFFSET + (MAX_OFFSET - MIN_OFFSET));

      // Space warp — same as the GLSL shader's space distortion
      const warpedSX = (sx: number) =>
        sx + random(sx * WARP_FREQUENCY + t * WARP_SPEED + 2.0) * WARP_AMPLITUDE;
      const plasmaY = (sx: number) =>
        random(warpedSX(sx) * LINE_FREQUENCY + t * LINE_SPEED) * LINE_AMPLITUDE + offset;

      // Shift colour slightly per line for variety
      const hue    = 260 + l * 4;
      const lum    = 55  + rand * 20;
      const alpha  = 0.45 + rand * 0.45;

      // Glow pass
      ctx.beginPath();
      for (let px = 0; px <= W; px += STEP) {
        const sx = toSpaceX(px);
        const py = spaceToPixelY(plasmaY(sx));
        px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.strokeStyle = `hsla(${hue},80%,${lum}%,${alpha * 0.3})`;
      ctx.lineWidth   = halfWPx * 2.6;
      ctx.shadowColor = `hsla(${hue},90%,${lum}%,0.9)`;
      ctx.shadowBlur  = 22 + rand * 16;
      ctx.stroke();

      // Crisp core
      ctx.beginPath();
      for (let px = 0; px <= W; px += STEP) {
        const sx = toSpaceX(px);
        const py = spaceToPixelY(plasmaY(sx));
        px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.strokeStyle = `hsla(${hue},90%,${lum + 10}%,${Math.min(1, alpha + 0.2)})`;
      ctx.lineWidth   = Math.max(0.8, halfWPx * 0.28);
      ctx.shadowBlur  = 6;
      ctx.stroke();

      // Travelling circle
      const circSX = ((l + t * LINE_SPEED) % 25.0) - 12.0;
      const circPX = (circSX / (SCALE * 2)) * W + W / 2;
      const circPY = spaceToPixelY(plasmaY(circSX));

      ctx.beginPath();
      ctx.arc(circPX, circPY, Math.max(2, halfWPx * 0.4), 0, Math.PI * 2);
      ctx.fillStyle   = `hsla(${hue},100%,85%,${Math.min(1, alpha + 0.35)})`;
      ctx.shadowColor = `hsla(${hue},100%,80%,1)`;
      ctx.shadowBlur  = 24;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  });

  return (
    // motion.canvas gives a smooth fade-in on mount
    <motion.canvas
      ref={canvasRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.4, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}

import { VisualGuide, GuideType } from '../types';

/**
 * Draws visual guides (arrows, circles, rectangles, text, number badges, freehand)
 * directly onto a 2D canvas context.
 */
export function drawGuidesOnCanvas(
  ctx: CanvasRenderingContext2D,
  guides: VisualGuide[],
  width: number,
  height: number
) {
  if (!guides || guides.length === 0) return;

  ctx.save();

  for (const guide of guides) {
    const color = guide.color || '#fef08a';
    const strokeWidth = (guide as any).strokeWidth || 4;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (guide.type) {
      case GuideType.ARROW: {
        const startX = guide.startX ?? (guide as any).x ?? 0.5;
        const startY = guide.startY ?? (guide as any).y ?? 0.5;
        const endX = guide.endX ?? ((guide as any).x ? (guide as any).x : startX + 0.05);
        const endY = guide.endY ?? ((guide as any).y ? (guide as any).y : startY + 0.05);

        const x1 = startX * width;
        const y1 = startY * height;
        const x2 = endX * width;
        const y2 = endY * height;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = Math.max(14, strokeWidth * 3.5);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - headLength * Math.cos(angle - Math.PI / 6),
          y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          x2 - headLength * Math.cos(angle + Math.PI / 6),
          y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Optional label
        if (guide.label) {
          ctx.font = 'bold 15px sans-serif';
          ctx.fillStyle = '#0f172a';
          const textMetrics = ctx.measureText(guide.label);
          const padding = 6;
          const bgX = (x1 + x2) / 2 - textMetrics.width / 2 - padding;
          const bgY = (y1 + y2) / 2 - 16;
          
          ctx.fillStyle = color;
          ctx.fillRect(bgX, bgY, textMetrics.width + padding * 2, 22);
          ctx.fillStyle = '#0f172a';
          ctx.fillText(guide.label, bgX + padding, bgY + 16);
        }
        break;
      }

      case GuideType.CIRCLE: {
        const cx = (guide.x ?? 0.5) * width;
        const cy = (guide.y ?? 0.5) * height;
        const r = (guide.radius || 0.05) * Math.min(width, height);

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (guide.fill) {
          ctx.fillStyle = `${color}33`;
          ctx.fill();
        }
        ctx.stroke();

        if (guide.label) {
          ctx.font = 'bold 14px sans-serif';
          ctx.fillStyle = color;
          ctx.fillText(guide.label, cx - 30, cy - r - 8);
        }
        break;
      }

      case GuideType.RECT: {
        const rx = (guide.x ?? 0.1) * width;
        const ry = (guide.y ?? 0.1) * height;
        const rw = (guide.width ?? 0.15) * width;
        const rh = (guide.height ?? 0.08) * height;

        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        if (guide.fill !== false) {
          ctx.fillStyle = `${color}25`;
          ctx.fill();
        }
        ctx.stroke();

        if (guide.label) {
          ctx.font = 'bold 13px sans-serif';
          ctx.fillStyle = color;
          ctx.fillText(guide.label, rx, ry - 6);
        }
        break;
      }

      case GuideType.TEXT: {
        const tx = guide.x * width;
        const ty = guide.y * height;

        ctx.font = 'bold 16px sans-serif';
        const metrics = ctx.measureText(guide.text);
        const padding = 6;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(tx - padding, ty - 18, metrics.width + padding * 2, 24);
        ctx.strokeStyle = color;
        ctx.strokeRect(tx - padding, ty - 18, metrics.width + padding * 2, 24);

        ctx.fillStyle = color;
        ctx.fillText(guide.text, tx, ty);
        break;
      }

      case GuideType.NUMBER_BADGE: {
        const bx = guide.x * width;
        const by = guide.y * height;
        const badgeRadius = 16;

        // Halo
        ctx.beginPath();
        ctx.arc(bx, by, badgeRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${color}44`;
        ctx.fill();

        // Badge Circle
        ctx.beginPath();
        ctx.arc(bx, by, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Badge Number
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(guide.number), bx, by);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';

        // Optional Step label
        if (guide.label) {
          ctx.font = 'bold 14px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`Passo ${guide.number}: ${guide.label}`, bx + badgeRadius + 8, by + 5);
        }
        break;
      }

      case GuideType.FREEHAND: {
        if (!guide.points || guide.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(guide.points[0].x * width, guide.points[0].y * height);
        for (let i = 1; i < guide.points.length; i++) {
          ctx.lineTo(guide.points[i].x * width, guide.points[i].y * height);
        }
        ctx.stroke();
        break;
      }
    }
  }

  ctx.restore();
}

/**
 * Canvas drawing for the DevFest badge and profile picture. The preview and the PNG export use
 * the same drawing, so what you see is what you download.
 */

export type PhotoFrame = {
  image: HTMLImageElement;
  /** 1 = just covers the circle; larger zooms in. */
  zoom: number;
  /** Pan, as a fraction of the circle's diameter. */
  x: number;
  y: number;
};

export type BadgeState = {
  name: string;
  role: string;
  track: { label: string; main: string; pastel: string; text: string };
  photo: PhotoFrame | null;
  dateLine: string;
  logo: HTMLImageElement | null;
  art: HTMLImageElement | null;
};

const INK = '#1e1e1e';
const WHITE = '#ffffff';
const CREAM = '#fcf8ec'; // matches the panorama's background
const GOOGLE = ['#4285f4', '#ea4335', '#f9ab00', '#34a853'];

export const BADGE_SIZE = { width: 1080, height: 1600 };
export const AVATAR_SIZE = 1080;
/** Where the photo circle sits on the badge, so the page can hit-test drags on it. */
export const BADGE_PHOTO = { x: 540, y: 640, r: 176 };

const sans = () => getComputedStyle(document.body).fontFamily;
const code = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--font-code').trim() || 'monospace';

/** Draw an image to cover a box, cropped from its centre. */
function cover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Keep the pan within bounds so no edge of the photo shows inside the circle. */
export function clampPhoto(photo: PhotoFrame) {
  const { image, zoom } = photo;
  // Sizes relative to the circle's diameter.
  const base = Math.max(1 / image.width, 1 / image.height);
  const w = image.width * base * zoom;
  const h = image.height * base * zoom;
  const bias = faceBias(photo);
  const lx = Math.max(0, (w - 1) / 2);
  const ly = Math.max(0, (h - 1) / 2);
  photo.x = Math.min(lx, Math.max(-lx, photo.x));
  photo.y = Math.min(ly - bias, Math.max(-ly - bias, photo.y));
}

/** Portrait photos start a little higher, where faces usually are (fraction of diameter). */
function faceBias(photo: PhotoFrame) {
  const { image, zoom } = photo;
  const base = Math.max(1 / image.width, 1 / image.height);
  const h = image.height * base * zoom;
  return h > 1 ? (h - 1) * 0.25 : 0;
}

/**
 * Photo inside a circle. Portrait photos default to showing their upper part, where faces
 * usually are; zoom and pan adjust from there.
 */
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  photo: PhotoFrame,
  cx: number,
  cy: number,
  r: number,
) {
  const d = r * 2;
  const { image, zoom } = photo;
  const scale = Math.max(d / image.width, d / image.height) * zoom;
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    image,
    cx - w / 2 + photo.x * d,
    cy - h / 2 + (faceBias(photo) + photo.y) * d,
    w,
    h,
  );
  ctx.restore();
}

/** Initials on the track colour when there's no photo. */
function drawInitials(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  r: number,
  bg: string,
  fg: string,
) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || 'DF';
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `700 ${r * 0.9}px ${sans()}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, cx, cy + r * 0.04);
}

/** Four-colour Google ring with small gaps. */
function googleRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  width: number,
) {
  ctx.lineWidth = width;
  GOOGLE.forEach((color, i) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      r,
      -Math.PI / 2 + (i * Math.PI) / 2 + 0.04,
      -Math.PI / 2 + ((i + 1) * Math.PI) / 2 - 0.04,
    );
    ctx.stroke();
  });
}

function fitName(ctx: CanvasRenderingContext2D, name: string, maxWidth: number) {
  const text = name.trim() || 'Your Name';
  for (let size = 112; size >= 56; size -= 4) {
    ctx.font = `700 ${size}px ${sans()}`;
    if (ctx.measureText(text).width <= maxWidth) return { lines: [text], size };
    const words = text.split(/\s+/);
    if (words.length > 1 && size <= 96) {
      let best: string[] | null = null;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' ');
        const b = words.slice(i).join(' ');
        if (ctx.measureText(a).width <= maxWidth && ctx.measureText(b).width <= maxWidth) {
          if (!best || Math.abs(a.length - b.length) < Math.abs(best[0].length - best[1].length))
            best = [a, b];
        }
      }
      if (best) return { lines: best, size };
    }
  }
  return { lines: [text], size: 56 };
}

/* ---------- badge ---------- */

export function drawBadge(ctx: CanvasRenderingContext2D, s: BadgeState) {
  const { width: W, height: H } = BADGE_SIZE;
  const { x: cx, y: cy, r } = BADGE_PHOTO;
  ctx.clearRect(0, 0, W, H);

  // Card
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 56);
  ctx.fill();
  ctx.save();
  ctx.clip();

  // Lanyard slot
  ctx.fillStyle = '#e3e3e3';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 90, 42, 180, 32, 16);
  ctx.fill();

  // Header: logo and edition
  if (s.logo) ctx.drawImage(s.logo, 64, 104, 238, 68);
  ctx.fillStyle = INK;
  ctx.font = `600 30px ${code()}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('PUNE · 2026', W - 64, 140);

  // Pune panorama
  const ax = 48;
  const ay = 206;
  const aw = W - 96;
  const ah = 420;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(ax, ay, aw, ah, 36);
  ctx.clip();
  ctx.fillStyle = CREAM;
  ctx.fillRect(ax, ay, aw, ah);
  if (s.art) cover(ctx, s.art, ax, ay, aw, ah);
  ctx.restore();

  // Centred photo with a white gap and the Google ring
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 34, 0, Math.PI * 2);
  ctx.fill();
  googleRing(ctx, cx, cy, r + 18, 12);
  if (s.photo) drawPhoto(ctx, s.photo, cx, cy, r);
  else
    drawInitials(
      ctx,
      s.name,
      cx,
      cy,
      r,
      s.track.pastel,
      s.track.main === '#f9ab00' ? INK : s.track.main,
    );

  // Role and name, centred
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = s.track.main === '#f9ab00' ? INK : s.track.main;
  ctx.font = `600 32px ${code()}`;
  ctx.fillText(s.role.toUpperCase().split('').join(' '), W / 2, 900);
  ctx.fillStyle = INK;
  const { lines, size } = fitName(ctx, s.name, W - 128);
  ctx.font = `700 ${size}px ${sans()}`;
  const nameTop = lines.length > 1 ? 960 : 990;
  lines.forEach((line, i) => ctx.fillText(line, W / 2, nameTop + size * 0.8 + i * size * 1.02));

  // Track band
  const bandY = 1196;
  ctx.fillStyle = s.track.main;
  ctx.fillRect(0, bandY, W, 116);
  ctx.fillStyle = s.track.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 52px ${sans()}`;
  ctx.fillText(s.track.label, 64, bandY + 60);
  ctx.font = `600 28px ${code()}`;
  ctx.textAlign = 'right';
  ctx.fillText('T R A C K', W - 64, bandY + 60);

  // Footer: Pune in Marathi, date, Google squares
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `800 120px "Kohinoor Devanagari", "Noto Sans Devanagari", "Mukta", ${sans()}`;
  ctx.fillText('पुणे', 56, 1440);
  ctx.font = `500 30px ${code()}`;
  ctx.fillText(s.dateLine, 64, 1544);
  GOOGLE.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(W - 64 - 4 * 44 + i * 44 + 8, 1456, 32, 32);
  });
  ctx.fillStyle = INK;
  ctx.font = `600 30px ${code()}`;
  ctx.textAlign = 'right';
  ctx.fillText('#DevFestPune', W - 64, 1544);

  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(3, 3, W - 6, H - 6, 54);
  ctx.stroke();
}

/* ---------- profile picture ---------- */

export function drawAvatar(ctx: CanvasRenderingContext2D, s: BadgeState) {
  const S = AVATAR_SIZE;
  const c = S / 2;
  const r = c - 56;
  ctx.clearRect(0, 0, S, S);

  googleRing(ctx, c, c, c - 24, 44);
  if (s.photo) {
    drawPhoto(ctx, s.photo, c, c, r);
  } else {
    // No photo: the Pune panorama fills the circle.
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, S, S);
    if (s.art) cover(ctx, s.art, c - r, c - r * 0.7, r * 2, r * 1.2);
    ctx.restore();
  }

  // Banner, worded by role
  const verbs: Record<string, string> = {
    Speaker: "I'm speaking at",
    Volunteer: "I'm volunteering at",
    Organizer: "I'm organizing",
  };
  const text = `${verbs[s.role] ?? "I'm attending"} DevFest Pune 2026`;
  let fontSize = 50;
  ctx.font = `700 ${fontSize}px ${sans()}`;
  while (ctx.measureText(text).width > S - 220 && fontSize > 32) {
    fontSize -= 2;
    ctx.font = `700 ${fontSize}px ${sans()}`;
  }
  const tw = ctx.measureText(text).width + 80;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(c - tw / 2, S - 250, tw, 92, 46);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c, S - 203);
}

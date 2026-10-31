/**
 * Screen-print style box art for the homepage shelf. Nothing here depicts a product:
 * each box stands for a shop category or a way to get help, drawn as a simple motif.
 * Covers use a 474 × 900 viewBox and spines 142 × 840, matching the box proportions.
 */

export type Motif = 'drop' | 'sun' | 'leaf' | 'wave' | 'roots' | 'sprig' | 'compass' | 'star' | 'speech' | 'book';

export interface Inks {
  bg: string;
  ink: string;
  accent: string;
}

export interface ArtItem {
  title: string;
  motif: Motif;
  inks: Inks;
  no: number;
}

const DISPLAY = "'Fraunces', Georgia, serif";
const SANS = "'DM Sans', system-ui, sans-serif";

/** Rounds so server and client render identical attribute strings. */
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Motif drawn around (237, 580), roughly 360 px across. The accent is offset slightly, like misregistered print. */
export function MotifArt({ motif, inks }: { motif: Motif; inks: Inks }) {
  const { bg, ink, accent } = inks;
  switch (motif) {
    case 'drop':
      return (
        <g>
          <circle cx="296" cy="520" r="122" fill={accent} />
          <path d="M237 372 C 237 372 136 506 136 584 A 101 101 0 0 0 338 584 C 338 506 237 372 237 372 Z" fill={ink} />
          <ellipse cx="196" cy="600" rx="16" ry="34" fill={bg} transform="rotate(-18 196 600)" />
          <path d="M120 760 C 120 760 98 790 98 806 A 22 22 0 0 0 142 806 C 142 790 120 760 120 760 Z" fill={accent} />
          <path d="M360 720 C 360 720 344 742 344 754 A 16 16 0 0 0 376 754 C 376 742 360 720 360 720 Z" fill={ink} />
        </g>
      );
    case 'sun':
      return (
        <g>
          {Array.from({ length: 18 }, (_, i) => {
            const a = (Math.PI * i) / 17;
            return (
              <line
                key={i}
                x1={r2(237 - Math.cos(a) * 140)}
                y1={r2(640 - Math.sin(a) * 140)}
                x2={r2(237 - Math.cos(a) * 200)}
                y2={r2(640 - Math.sin(a) * 200)}
                stroke={ink}
                strokeWidth="9"
                strokeLinecap="round"
              />
            );
          })}
          <path d="M115 640 A 122 122 0 0 1 359 640 Z" fill={accent} />
          <rect x="40" y="652" width="394" height="16" fill={ink} />
          <rect x="80" y="690" width="314" height="12" fill={ink} />
          <rect x="130" y="722" width="214" height="9" fill={ink} />
        </g>
      );
    case 'leaf':
      return (
        <g>
          <circle cx="176" cy="470" r="96" fill={accent} />
          <path d="M226 778 C 92 660 110 448 338 384 C 372 572 330 714 226 778 Z" fill={ink} />
          <path d="M226 778 C 262 640 296 520 334 392" stroke={bg} strokeWidth="6" fill="none" />
          <path d="M252 668 L 186 620 M270 596 L 196 560 M288 526 L 226 486 M262 672 L 324 628 M282 600 L 338 548" stroke={bg} strokeWidth="4" />
        </g>
      );
    case 'wave':
      return (
        <g fill="none" strokeWidth="18" strokeLinecap="round">
          {[420, 490, 560, 630, 700, 770].map((y, i) => (
            <path
              key={y}
              d={`M64 ${y} q 43 -38 86 0 t 86 0 t 86 0 t 86 0`}
              stroke={i % 2 ? accent : ink}
              transform={i % 2 ? 'translate(10 0)' : undefined}
            />
          ))}
        </g>
      );
    case 'roots':
      return (
        <g>
          <circle cx="300" cy="430" r="58" fill={accent} />
          <path d="M237 610 L 237 400" stroke={ink} strokeWidth="12" strokeLinecap="round" />
          <path d="M237 470 C 180 470 150 430 146 392 C 196 392 232 420 237 470 Z" fill={ink} />
          <path d="M237 520 C 296 520 326 480 330 442 C 280 442 242 470 237 520 Z" fill={ink} />
          <rect x="70" y="604" width="334" height="14" fill={ink} />
          <path
            d="M237 618 L 237 780 M237 660 L 180 720 L 160 790 M237 690 L 300 740 L 316 800 M180 720 L 120 744 M300 740 L 360 752 M237 740 L 214 810"
            stroke={accent}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    case 'sprig':
      return (
        <g>
          {[
            [150, 420],
            [237, 390],
            [324, 420],
          ].map(([x, y]) => (
            <g key={x}>
              <path d={`M237 760 Q ${(237 + x) / 2} ${(760 + y) / 2 + 40} ${x} ${y}`} stroke={ink} strokeWidth="7" fill="none" />
              {[0.25, 0.45, 0.65, 0.85].map((t) => {
                const px = 237 + (x - 237) * t;
                const py = 760 + (y - 760) * t;
                return (
                  <g key={t}>
                    <ellipse cx={px - 18} cy={py} rx="18" ry="9" fill={ink} transform={`rotate(-30 ${px - 18} ${py})`} />
                    <ellipse cx={px + 18} cy={py} rx="18" ry="9" fill={ink} transform={`rotate(30 ${px + 18} ${py})`} />
                  </g>
                );
              })}
            </g>
          ))}
          <path d="M237 700 C 180 650 150 700 186 726 Z M237 700 C 294 650 324 700 288 726 Z" fill={accent} />
          <path d="M237 700 L 206 800 M237 700 L 268 800" stroke={accent} strokeWidth="12" strokeLinecap="round" />
          <circle cx="237" cy="702" r="16" fill={accent} />
        </g>
      );
    case 'compass':
      return (
        <g>
          <circle cx="245" cy="588" r="132" fill={accent} />
          <circle cx="237" cy="580" r="172" fill="none" stroke={ink} strokeWidth="10" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (Math.PI * 2 * i) / 12;
            return (
              <line
                key={i}
                x1={r2(237 + Math.cos(a) * 150)}
                y1={r2(580 + Math.sin(a) * 150)}
                x2={r2(237 + Math.cos(a) * 166)}
                y2={r2(580 + Math.sin(a) * 166)}
                stroke={ink}
                strokeWidth="6"
              />
            );
          })}
          <path d="M237 430 L 267 580 L 207 580 Z" fill={ink} />
          <path d="M237 730 L 267 580 L 207 580 Z" fill={bg} />
          <circle cx="237" cy="580" r="12" fill={ink} />
        </g>
      );
    case 'star':
      return (
        <g>
          <circle cx="282" cy="540" r="118" fill={accent} />
          {[0, 45, 90, 135].map((a) => (
            <rect key={a} x="221" y="410" width="32" height="340" rx="16" fill={ink} transform={`rotate(${a} 237 580)`} />
          ))}
          <circle cx="237" cy="580" r="36" fill={bg} />
          <path d="M96 420 l8 22 22 8 -22 8 -8 22 -8 -22 -22 -8 22 -8 z" fill={ink} />
          <path d="M376 740 l6 16 16 6 -16 6 -6 16 -6 -16 -16 -6 16 -6 z" fill={ink} />
        </g>
      );
    case 'speech':
      return (
        <g>
          <rect x="150" y="380" width="250" height="180" rx="40" fill={accent} />
          <path d="M340 556 L 372 620 L 300 556 Z" fill={accent} />
          <rect x="70" y="470" width="290" height="210" rx="44" fill={ink} />
          <path d="M120 676 L 96 760 L 190 676 Z" fill={ink} />
          {[150, 215, 280].map((x) => (
            <circle key={x} cx={x} cy="575" r="18" fill={bg} />
          ))}
        </g>
      );
    case 'book':
      return (
        <g>
          <circle cx="237" cy="470" r="104" fill={accent} />
          <path d="M237 500 Q 160 460 72 478 L 72 740 Q 160 722 237 762 Z" fill={ink} />
          <path d="M237 500 Q 314 460 402 478 L 402 740 Q 314 722 237 762 Z" fill={ink} />
          <path d="M237 500 L 237 762" stroke={bg} strokeWidth="6" />
          {[540, 580, 620, 660].map((y) => (
            <g key={y} stroke={bg} strokeWidth="4">
              <path d={`M100 ${y} Q 165 ${y - 12} 214 ${y + 10}`} fill="none" />
              <path d={`M260 ${y + 10} Q 309 ${y - 12} 374 ${y}`} fill="none" />
            </g>
          ))}
        </g>
      );
  }
}

/** Splits a title into lines of at most ~10 characters for the big cover lettering. */
function coverLines(title: string): string[] {
  const lines: string[] = [];
  for (const word of title.split(' ')) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length <= 10) lines[lines.length - 1] = last + ' ' + word;
    else lines.push(word);
  }
  return lines;
}

/** Cover drawing as SVG content (no outer <svg>), so the detail poster can mask it. */
export function CoverArtContent({ item }: { item: ArtItem }) {
  const { bg, ink, accent } = item.inks;
  const lines = coverLines(item.title);
  const size = lines.length > 2 ? 64 : 78;
  return (
    <g>
      <rect width="474" height="900" fill={bg} />
      <rect x="18" y="18" width="438" height="864" fill="none" stroke={ink} strokeOpacity="0.35" strokeWidth="2" />
      <text x="237" y="70" textAnchor="middle" fill={ink} fontFamily={SANS} fontWeight="600" fontSize="15" letterSpacing="4.5">
        BOTANICAL &amp; YOU
      </text>
      <line x1="150" y1="88" x2="324" y2="88" stroke={accent} strokeWidth="3" />
      {lines.map((line, i) => (
        <text
          key={i}
          x="237"
          y={150 + size * 0.86 + i * size * 0.98}
          textAnchor="middle"
          fill={ink}
          fontFamily={DISPLAY}
          fontWeight="700"
          fontSize={size}
          letterSpacing="-2"
        >
          {line}
        </text>
      ))}
      <MotifArt motif={item.motif} inks={item.inks} />
      <text x="40" y="852" fill={ink} fontFamily={SANS} fontWeight="600" fontSize="14" letterSpacing="3">
        B&amp;Y
      </text>
      <rect x="360" y="828" width="76" height="32" fill="none" stroke={ink} strokeWidth="2" />
      <text x="398" y="850" textAnchor="middle" fill={ink} fontFamily={SANS} fontWeight="600" fontSize="14" letterSpacing="2">
        Nº {String(item.no).padStart(2, '0')}
      </text>
    </g>
  );
}

export function CoverArt({ item }: { item: ArtItem }) {
  return (
    <svg viewBox="0 0 474 900" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">
      <CoverArtContent item={item} />
    </svg>
  );
}

export function SpineArt({ item }: { item: ArtItem }) {
  const { bg, ink, accent } = item.inks;
  const title = item.title.toUpperCase();
  const size = Math.min(46, 540 / (title.length * 0.74));
  return (
    <svg viewBox="0 0 142 840" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">
      <rect width="142" height="840" fill={bg} />
      <rect x="8" y="8" width="126" height="824" fill="none" stroke={ink} strokeOpacity="0.3" strokeWidth="2" />
      <g transform="translate(71 92) scale(0.27) translate(-237 -580)">
        <MotifArt motif={item.motif} inks={item.inks} />
      </g>
      <line x1="30" y1="160" x2="112" y2="160" stroke={accent} strokeWidth="3" />
      <text
        x="0"
        y="0"
        transform="translate(71 430) rotate(90)"
        textAnchor="middle"
        dominantBaseline="central"
        fill={ink}
        fontFamily={DISPLAY}
        fontWeight="700"
        fontSize={size}
        letterSpacing="1"
      >
        {title}
      </text>
      <text x="71" y="752" textAnchor="middle" fill={ink} fontFamily={SANS} fontWeight="600" fontSize="15" letterSpacing="3">
        B&amp;Y
      </text>
      <rect x="35" y="772" width="72" height="30" fill="none" stroke={ink} strokeWidth="2" />
      <text x="71" y="793" textAnchor="middle" fill={ink} fontFamily={SANS} fontWeight="600" fontSize="14" letterSpacing="1.5">
        Nº {String(item.no).padStart(2, '0')}
      </text>
    </svg>
  );
}

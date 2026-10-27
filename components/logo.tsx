/** Retro botanical mascot and hand-lettered wordmark. Decorative: the surrounding link or text carries the name. */
export function Logo() {
  return (
    <span
      className="logo"
      aria-hidden="true"
      style={{
        display: 'block',
        width: 150,
        height: 50,
        flexShrink: 0,
        backgroundColor: 'var(--green)',
        maskImage: 'url(/brand/botanical-and-you-retro.png)',
        maskSize: 'contain',
        maskPosition: 'center',
        maskRepeat: 'no-repeat',
        WebkitMaskImage: 'url(/brand/botanical-and-you-retro.png)',
        WebkitMaskSize: 'contain',
        WebkitMaskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
      }}
    />
  );
}

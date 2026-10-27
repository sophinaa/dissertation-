/** Brand mark: an oil drop with leaf veins. Decorative; the link around it carries the name. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M16 2.5C16 2.5 5.5 13.2 5.5 20.2a10.5 10.5 0 0 0 21 0C26.5 13.2 16 2.5 16 2.5Z" fill="currentColor" />
      <path
        d="M16 27V12.5M16 22.5l-4.2-3.4M16 17.8l4.2-3.4"
        fill="none"
        stroke="var(--bg)"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

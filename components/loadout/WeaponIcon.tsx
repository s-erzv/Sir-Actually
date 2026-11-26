import type { WeaponSlug } from "@/lib/loadout";

interface WeaponIconProps {
  slug: WeaponSlug | string;
  size?: number;
  className?: string;
}

const SWORD = (
  <>
    <path d="M12 2.5v13" />
    <path d="M8.5 15.5h7" />
    <path d="M12 15.5v6" />
    <path d="M10 21.5h4" />
  </>
);

const DAGGER = (
  <>
    <path d="M12 5.5v9" />
    <path d="M9.5 14.5h5" />
    <path d="M12 14.5v5" />
    <path d="M10.5 19.5h3" />
  </>
);

const BOW = (
  <>
    <path d="M7 3.5c7 4.5 7 12.5 0 17" />
    <path d="M7 3.5v17" />
    <path d="M4.5 12h15" />
    <path d="M16.5 9.5 19.5 12l-3 2.5" />
  </>
);

const NET = (
  <>
    <rect x="4" y="4" width="16" height="16" />
    <path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" />
  </>
);

const SHIELD = (
  <>
    <path d="M12 2.5 19.5 6v6c0 5-7.5 9.5-7.5 9.5S4.5 17 4.5 12V6L12 2.5Z" />
    <path d="M12 6v9" />
  </>
);

const LANTERN = (
  <>
    <path d="M9 2.5h6" />
    <path d="M12 2.5V5" />
    <rect x="7" y="5" width="10" height="13" />
    <path d="M9.5 21.5h5" />
    <path d="M12 9c1.8 1.8 1.8 4.2 0 6-1.8-1.8-1.8-4.2 0-6Z" />
  </>
);

const COMPASS = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m14.8 9.2-1.6 4-4 1.6 1.6-4 4-1.6Z" />
  </>
);

const AXE = (
  <>
    <path d="M9 21V7" />
    <path d="M9 7c4-3 8-3 11 0-3 3-7 3-11 0Z" />
    <path d="M9 12h4" />
  </>
);

const CHAIN = (
  <>
    <rect x="3" y="9" width="8" height="6" rx="3" transform="rotate(-20 7 12)" />
    <rect x="13" y="9" width="8" height="6" rx="3" transform="rotate(-20 17 12)" />
    <path d="M10 12.5h4" />
  </>
);

export function WeaponIcon({ slug, size = 32, className = "" }: WeaponIconProps) {
  const shape =
    slug === "belati_presisi"
      ? DAGGER
      : slug === "busur_angka" || slug === "busur_jejak"
        ? BOW
        : slug === "jaring_bukti"
          ? NET
          : slug === "perisai_batas"
            ? SHIELD
            : slug === "lentera_kubur"
              ? LANTERN
              : slug === "kompas_rujukan"
                ? COMPASS
                : slug === "kapak_vonis"
                  ? AXE
                  : slug === "rantai_batas"
                    ? CHAIN
                    : SWORD;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="square"
      strokeLinejoin="miter"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      {shape}
    </svg>
  );
}

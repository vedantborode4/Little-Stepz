const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=in.littlestepz"
const APP_STORE_URL = "https://apps.apple.com/in/app/little-stepz/id6801905498"

const BADGE_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

function GooglePlayBadge() {
  return (
    <svg viewBox="0 0 135 40" width={135} height={40} aria-hidden="true">
      <rect x="0.5" y="0.5" width="134" height="39" rx="6" fill="#000" stroke="#A6A6A6" />
      <g transform="translate(9 8)">
        <path d="M3.7 1.6 13.5 12l-9.8 10.4c-.4-.2-.7-.7-.7-1.3V2.9c0-.6.3-1.1.7-1.3Z" fill="#00A0FF" />
        <path d="M3.7 1.6c.5-.3 1.1-.3 1.6 0l11.6 6.7L13.5 12 3.7 1.6Z" fill="#00F076" />
        <path d="m16.9 8.3 3.3 1.9c1.3.7 1.3 2.9 0 3.6l-3.3 1.9-3.4-3.7 3.4-3.7Z" fill="#FFD500" />
        <path d="M3.7 22.4 13.5 12l3.4 3.7-11.6 6.7c-.5.3-1.1.3-1.6 0Z" fill="#FF3A44" />
      </g>
      <text x="40" y="15" fill="#fff" fontSize="7.5" letterSpacing="0.4" fontFamily={BADGE_FONT}>
        GET IT ON
      </text>
      <text x="40" y="30.5" fill="#fff" fontSize="15" fontWeight="600" fontFamily={BADGE_FONT}>
        Google Play
      </text>
    </svg>
  )
}

function AppStoreBadge() {
  return (
    <svg viewBox="0 0 120 40" width={120} height={40} aria-hidden="true">
      <rect x="0.5" y="0.5" width="119" height="39" rx="6" fill="#000" stroke="#A6A6A6" />
      <path
        transform="translate(9 8)"
        fill="#fff"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
      <text x="37" y="15" fill="#fff" fontSize="7.5" fontFamily={BADGE_FONT}>
        Download on the
      </text>
      <text x="37" y="31" fill="#fff" fontSize="16" fontWeight="600" fontFamily={BADGE_FONT}>
        App Store
      </text>
    </svg>
  )
}

/** Links to the Little Stepz app on Google Play and the App Store. */
export default function AppStoreBadges() {
  const linkClass =
    "inline-block rounded-md transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get it on Google Play"
        className={linkClass}
      >
        <GooglePlayBadge />
      </a>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download on the App Store"
        className={linkClass}
      >
        <AppStoreBadge />
      </a>
    </div>
  )
}

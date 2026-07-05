/**
 * Spinner de chargement général, aux couleurs du projet.
 * Logo Horus + anneau rotatif bronze, sur fond transparent.
 *
 * - `fullScreen` : centre le spinner dans un overlay plein écran (fond
 *   transparent), pour les chargements globaux (ex : porte d'authentification).
 * - Sinon : rendu inline, à centrer par le parent.
 */

const LOGO_SRC = "/horus-manager-logo.png";
const LOGO_SRC_SET = "/horus-manager-logo.png 1x, /horus-manager-logo@2x.png 2x";

interface SpinnerProps {
  /** Diamètre de l'anneau rotatif en px (défaut : 40) */
  size?: number;
  /** Largeur du logo en px (défaut : 160). Mettre 0 pour masquer le logo. */
  logoWidth?: number;
  /** Centre le spinner dans un overlay plein écran (fond transparent) */
  fullScreen?: boolean;
  /** Texte optionnel affiché sous le spinner */
  label?: string;
  /** Classes supplémentaires sur le conteneur du spinner */
  className?: string;
}

export function Spinner({
  size = 40,
  logoWidth = 160,
  fullScreen = false,
  label,
  className,
}: SpinnerProps) {
  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-4 ${className ?? ""}`}>
      {logoWidth > 0 && (
        <img
          src={LOGO_SRC}
          srcSet={LOGO_SRC_SET}
          alt="Horus Assurances"
          style={{ width: logoWidth }}
          className="h-auto max-w-full object-contain drop-shadow-sm"
        />
      )}
      <span
        style={{ width: size, height: size }}
        className="animate-spin rounded-full border-4 border-[#614e1a]/20 border-t-[#614e1a]"
        aria-hidden="true"
      />
      {label ? <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p> : null}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex min-h-screen items-center justify-center bg-transparent p-6"
      >
        {spinner}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" aria-busy="true">
      {spinner}
    </div>
  );
}

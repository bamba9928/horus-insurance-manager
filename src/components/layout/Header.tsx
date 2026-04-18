/**
 * Header de l'application avec titre de page et actions globales.
 */

interface HeaderProps {
  /** Titre de la page courante */
  title: string;
  /** Actions optionnelles affichées à droite */
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </header>
  );
}

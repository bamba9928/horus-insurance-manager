const SUPPORT_EMAIL = "contact@horus-assur.digital";

interface AppFooterProps {
  variant?: "app" | "public";
}

export function AppFooter({ variant = "app" }: AppFooterProps) {
  const year = new Date().getFullYear();
  const isPublic = variant === "public";

  return (
    <footer
      className={
        isPublic
          ? "w-full shrink-0 px-4 pb-6 pt-20 text-center text-xs text-gray-500 dark:text-slate-500"
          : "shrink-0 border-t border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
      }
    >
      <div
        className={
          isPublic
            ? "mx-auto flex max-w-6xl flex-col items-center justify-center gap-1 sm:flex-row sm:gap-2"
            : "flex flex-col items-center justify-between gap-1 sm:flex-row"
        }
      >
        <span>© {year} Horus Assurances Manager</span>
        <span className="hidden text-gray-300 sm:inline dark:text-slate-600">•</span>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-medium text-green-700 underline-offset-4 hover:underline dark:text-green-400"
        >
          {SUPPORT_EMAIL}
        </a>
      </div>
    </footer>
  );
}

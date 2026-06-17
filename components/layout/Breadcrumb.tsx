import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs text-neutral-400 ${className}`}
    >
      <Link
        href="/"
        className="hover:text-neutral-700 transition-colors shrink-0"
      >
        Inicio
      </Link>

      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          {/* Separador */}
          <svg
            className="w-3 h-3 shrink-0 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>

          {item.href && i < items.length - 1 ? (
            <Link
              href={item.href}
              className="hover:text-neutral-700 transition-colors truncate"
            >
              {item.label}
            </Link>
          ) : (
            <span
              className="text-neutral-700 font-medium truncate"
              aria-current="page"
            >
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

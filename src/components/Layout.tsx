import { NavLink, Link, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/report', label: 'Report Issue' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/map', label: 'Map' },
  { to: '/trends', label: 'Trends' },
  { to: '/insights', label: 'Insights' },
  { to: '/policy', label: 'Governance' },
  { to: '/ask', label: 'Ask CivicLens' },
];

export default function Layout({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#faf9f7]">

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-[#e5e5e5] bg-[#faf9f7]/95 backdrop-blur-sm">

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* LOGO */}
          <Link
            to="/"
            className="flex items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e40af]">
              <Eye className="h-5 w-5 text-white" />
            </div>

            <span className="text-lg font-semibold tracking-tight text-[#1e1e1e]">
              CivicLens
              <span className="text-[#1e40af]"> AI</span>
            </span>
          </Link>

          {/* DESKTOP NAVIGATION */}
          <nav className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'nav-link',
                    isActive && 'nav-link-active',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* REPORT BUTTON */}
          <Link
            to="/report"
            className="hidden btn-primary sm:inline-flex"
          >
            Report an Issue
          </Link>
        </div>

        {/* MOBILE NAVIGATION */}
        <nav className="flex items-center gap-4 overflow-x-auto border-t border-[#e5e5e5] px-4 py-2.5 lg:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap text-sm font-medium transition-colors',
                  isActive
                    ? 'text-[#1e40af]'
                    : 'text-[#6b6b6b]',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* PAGE CONTENT */}
      <main>
        {children}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">

            {/* FOOTER LOGO */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e40af]">
                <Eye className="h-4 w-4 text-white" />
              </div>

              <span className="text-sm font-medium text-[#1e1e1e]">
                CivicLens AI
              </span>
            </div>

            {/* FOOTER DESCRIPTION */}
            <p className="text-sm text-[#6b6b6b]">
              Turning citizen reports into civic intelligence.
            </p>

          </div>
        </div>
      </footer>

    </div>
  );
}
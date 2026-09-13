interface SiteHeaderProps {
  view: "home" | "gallery";
  onNavigate: (view: "home" | "gallery") => void;
}

export function SiteHeader({
  view,
  onNavigate,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a
          className="brand"
          href="#home"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("home");
          }}
        >
          微光标本馆
        </a>
        <nav className="header-actions" aria-label="主要导航">
          <a
            className={view === "gallery" ? "nav-link is-current" : "nav-link"}
            href="#gallery"
            aria-current={view === "gallery" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate("gallery");
            }}
          >
            标本馆
          </a>
        </nav>
      </div>
    </header>
  );
}

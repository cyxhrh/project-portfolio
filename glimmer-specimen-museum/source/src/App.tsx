import { useCallback, useEffect, useMemo, useState } from "react";

import { Gallery } from "./components/Gallery";
import { HomeFlow } from "./components/HomeFlow";
import { SiteHeader } from "./components/SiteHeader";
import { createSpecimenRepository } from "./storage/specimenRepository";

type AppView = "home" | "gallery";

function viewFromLocation(): AppView {
  return window.location.hash === "#gallery" ? "gallery" : "home";
}

export default function App() {
  const repository = useMemo(() => createSpecimenRepository(), []);
  const [view, setView] = useState<AppView>(() => viewFromLocation());
  const [hasUnsavedCard, setHasUnsavedCard] = useState(false);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedCard) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedCard]);

  useEffect(() => {
    const handleHistory = () => {
      const nextView = viewFromLocation();

      if (
        view === "home" &&
        nextView !== "home" &&
        hasUnsavedCard &&
        !window.confirm("这张标本还没有收入标本馆，仍要离开吗？")
      ) {
        window.history.pushState(null, "", "#home");
        return;
      }

      if (view === "home" && nextView !== "home" && hasUnsavedCard) {
        setHasUnsavedCard(false);
      }
      setView(nextView);
    };

    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, [hasUnsavedCard, view]);

  const navigate = useCallback(
    (nextView: AppView) => {
      if (nextView === view) return;

      if (
        view === "home" &&
        hasUnsavedCard &&
        !window.confirm("这张标本还没有收入标本馆，仍要离开吗？")
      ) {
        return;
      }

      if (view === "home" && hasUnsavedCard) {
        setHasUnsavedCard(false);
      }
      window.history.pushState(null, "", `#${nextView}`);
      setView(nextView);
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    [hasUnsavedCard, view],
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader view={view} onNavigate={navigate} />
      {view === "home" ? (
        <HomeFlow repository={repository} onUnsavedChange={setHasUnsavedCard} />
      ) : (
        <Gallery repository={repository} onNavigateHome={() => navigate("home")} />
      )}
      <footer className="site-footer">
        <span>微光标本馆 · 第一版</span>
        <span>卡片只保存在当前浏览器；清理站点数据后无法恢复。</span>
      </footer>
    </div>
  );
}

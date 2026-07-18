const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function createSectionDirector({ reducedMotion = false } = {}) {
  const route = document.querySelector(".route-profile");
  const systemTabs = [...document.querySelectorAll("[data-system-tab]")];
  const systemPanels = [...document.querySelectorAll("[data-system-panel]")];
  const logEntries = [...document.querySelectorAll(".log-entry")];
  const missionSection = document.getElementById("section-mission");
  const systemsSection = document.getElementById("section-systems");
  const logSection = document.getElementById("section-log");
  let activeSystem = -1;
  let activeLog = -1;

  function setSystem(index) {
    if (index === activeSystem) return;
    activeSystem = index;
    systemTabs.forEach((tab, i) => {
      const active = i === index;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
    });
    systemPanels.forEach((panel, i) => panel.classList.toggle("is-active", i === index));
  }

  function setLog(index) {
    if (index === activeLog) return;
    activeLog = index;
    logEntries.forEach((entry, i) => entry.classList.toggle("is-active", i === index));
  }

  systemTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      setSystem(index);
      if (!systemsSection) return;
      const travel = Math.max(0, systemsSection.offsetHeight - window.innerHeight);
      const target = systemsSection.offsetTop + travel * (index / Math.max(1, systemTabs.length - 1));
      window.scrollTo({ top: target, behavior: reducedMotion ? "auto" : "smooth" });
    });
  });

  setSystem(0);
  setLog(0);

  return {
    update() {
      const missionProgress = localProgress(missionSection);
      if (route) route.style.setProperty("--route-progress", missionProgress.toFixed(3));

      const systemsProgress = localProgress(systemsSection);
      setSystem(Math.min(systemTabs.length - 1, Math.floor(systemsProgress * systemTabs.length)));

      const logProgress = localProgress(logSection);
      setLog(Math.min(logEntries.length - 1, Math.floor(logProgress * logEntries.length)));
    }
  };
}

function localProgress(section) {
  if (!section) return 0;
  const travel = Math.max(1, section.offsetHeight - window.innerHeight);
  return clamp01((window.scrollY - section.offsetTop) / travel);
}

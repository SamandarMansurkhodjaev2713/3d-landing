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
  const systemState = { progress: 0, active: 0, inView: false };

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
    if (systemsSection) {
      systemsSection.style.setProperty("--active-system", String(index));
      const counter = systemsSection.querySelector("[data-system-counter]");
      if (counter) counter.textContent = `${String(index + 1).padStart(2, "0")} / 04`;
    }
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

    tab.addEventListener("keydown", (event) => {
      let next = index;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % systemTabs.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + systemTabs.length) % systemTabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = systemTabs.length - 1;
      else return;
      event.preventDefault();
      systemTabs[next].focus();
      systemTabs[next].click();
    });
  });

  setSystem(0);
  setLog(0);

  return {
    update() {
      const missionProgress = localProgress(missionSection);
      if (route) route.style.setProperty("--route-progress", missionProgress.toFixed(3));

      const systemsProgress = localProgress(systemsSection);
      const systemsInView = isSectionInView(systemsSection);
      const nextSystem = Math.min(systemTabs.length - 1, Math.floor(systemsProgress * systemTabs.length));
      setSystem(nextSystem);
      systemState.progress = systemsProgress;
      systemState.active = nextSystem;
      systemState.inView = systemsInView;
      if (systemsSection) systemsSection.style.setProperty("--systems-progress", systemsProgress.toFixed(4));

      const logProgress = localProgress(logSection);
      setLog(Math.min(logEntries.length - 1, Math.floor(logProgress * logEntries.length)));

      return systemState;
    }
  };
}

function localProgress(section) {
  if (!section) return 0;
  const travel = Math.max(1, section.offsetHeight - window.innerHeight);
  return clamp01((window.scrollY - section.offsetTop) / travel);
}

function isSectionInView(section) {
  if (!section) return false;
  const rect = section.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

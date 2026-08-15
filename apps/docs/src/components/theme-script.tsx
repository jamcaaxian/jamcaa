// Runs before first paint so the page never renders in the wrong theme and then
// corrects itself. That flash is the whole reason this is an inline script rather
// than React state.
export const themeScript = `(function () {
  try {
    var storageKey = "jamcaa-theme";
    var query = window.matchMedia("(prefers-color-scheme: dark)");
    var apply = function () {
      var stored = localStorage.getItem(storageKey);
      var dark = stored === "dark" || (stored !== "light" && query.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    query.addEventListener("change", apply);
  } catch (error) {
    // Storage can be unavailable in private modes; the light default is fine.
  }
})();`;

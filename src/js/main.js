// Boot: settings, top bar tools, router.

applySettings();
document.getElementById("btn-theme").addEventListener("click", () => {
  S().settings.theme = currentTheme() === "dark" ? "light" : "dark";
  Store.save();
  applySettings();
});
const setScale = (d) => {
  const st = S().settings;
  st.scale = Math.min(1.4, Math.max(0.85, Math.round((st.scale + d) * 100) / 100));
  Store.save();
  applySettings();
  toast(`Tamanho do texto: ${Math.round(st.scale * 100)}%`);
  if (location.hash.includes("redacao/escrever") || location.hash.includes("simulado/prova")) render();
};
document.getElementById("btn-font-up").addEventListener("click", () => setScale(0.05));
document.getElementById("btn-font-down").addEventListener("click", () => setScale(-0.05));
window.addEventListener("hashchange", render);
render();

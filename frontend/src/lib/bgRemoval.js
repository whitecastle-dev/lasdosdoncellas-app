// Eliminación de fondo 100 % gratuita en el navegador del administrador
// (@imgly/background-removal · modelo ISNet en WebAssembly). El servidor sólo
// compone el estilo "estudio" sobre el recorte, así que no consume RAM en Render.
let modulePromise = null;
let preloaded = false;

const CONFIG = { model: "isnet_fp16", device: "cpu", output: { format: "image/png", quality: 1, type: "foreground" } };

const loadModule = () => {
  if (!modulePromise) modulePromise = import("@imgly/background-removal");
  return modulePromise;
};

export const preloadBgRemoval = async () => {
  if (preloaded) return;
  try {
    const mod = await loadModule();
    await mod.preload(CONFIG);
    preloaded = true;
  } catch { /* se intentará al vuelo */ }
};

/** Devuelve un File PNG con canal alfa (producto recortado). Lanza si falla. */
export async function removeBackgroundFile(file, onProgress) {
  const mod = await loadModule();
  const removeBackground = mod.removeBackground || mod.default;
  const blob = await removeBackground(file, {
    ...CONFIG,
    progress: (key, current, total) => {
      if (!onProgress) return;
      const isDownload = key?.startsWith("fetch");
      onProgress(isDownload ? "Descargando modelo IA…" : "Recortando producto…", total ? current / total : null);
    },
  });
  const name = (file.name || "imagen").replace(/\.[^.]+$/, "") + "-sinfondo.png";
  return new File([blob], name, { type: "image/png" });
}

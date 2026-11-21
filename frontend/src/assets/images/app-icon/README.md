# Icône de l'app (Dock macOS) — nouvelle DA, mode sombre

- **`app-icon-sombre-macos.icns`** / `app-icon-sombre-macos-1024.png` : version à utiliser dans le Dock (forme macOS arrondie, fond transparent, marge + ombre). Source : `source/icon-macos.html`.
- `app-icon-sombre-1024.png` : 1024×1024, coins carrés (version brute, macOS n'arrondit pas les icônes personnalisées).
- `app-icon-sombre.icns` : toutes les tailles 16 → 1024 (pour Finder, Electron/Tauri…).
- `source/` : `icon.html` (composition) + SVG utilisés. Régénérer : ouvrir `icon.html` dans Chrome à 1024×1024 et capturer.

Palette : fond #0d0c0b, logo #f4efe9, accent « API » #ff5a3c.
Appliquer : Finder → Lire les informations de l'app → glisser le .icns `-macos` sur l'icône en haut à gauche.

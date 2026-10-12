/*! @material/material-color-utilities 0.4.0 · Apache License 2.0 · Copyright Google LLC · https://github.com/material-foundation/material-color-utilities */
// Bundled to assets/js/vendor/mcu.js by `npm run vendor`. Exposes window.MCU.
// Same algorithm as Flutter's ColorScheme.fromSeed (material_color_utilities, 2021 spec).
import {
  argbFromHex, hexFromArgb, Hct, SchemeTonalSpot, SchemeFidelity, SchemeMonochrome, SchemeNeutral,
  SchemeVibrant, SchemeExpressive, SchemeContent, SchemeRainbow, SchemeFruitSalad
} from '@material/material-color-utilities';
window.MCU = {
  argbFromHex, hexFromArgb, Hct,
  schemes: {
    tonalSpot: SchemeTonalSpot, fidelity: SchemeFidelity, monochrome: SchemeMonochrome, neutral: SchemeNeutral,
    vibrant: SchemeVibrant, expressive: SchemeExpressive, content: SchemeContent, rainbow: SchemeRainbow, fruitSalad: SchemeFruitSalad
  }
};

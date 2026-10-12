/*! jsdiff (diff) 9.0.0 · BSD-3-Clause License · Copyright (c) 2009-2015, Kevin Decker · https://github.com/kpdecker/jsdiff */
// Bundled to assets/js/vendor/diff.js by `npm run vendor`. Exposes window.Diff.
import { diffLines, diffWords, diffWordsWithSpace, diffChars } from 'diff';
window.Diff = { diffLines, diffWords, diffWordsWithSpace, diffChars };

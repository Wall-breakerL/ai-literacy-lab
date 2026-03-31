"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/mdast-util-newline-to-break";
exports.ids = ["vendor-chunks/mdast-util-newline-to-break"];
exports.modules = {

/***/ "(ssr)/./node_modules/mdast-util-newline-to-break/lib/index.js":
/*!***************************************************************!*\
  !*** ./node_modules/mdast-util-newline-to-break/lib/index.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   newlineToBreak: () => (/* binding */ newlineToBreak)\n/* harmony export */ });\n/* harmony import */ var mdast_util_find_and_replace__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mdast-util-find-and-replace */ \"(ssr)/./node_modules/mdast-util-find-and-replace/lib/index.js\");\n/**\n * @typedef {import('mdast').Nodes} Nodes\n * @typedef {import('mdast-util-find-and-replace').ReplaceFunction} ReplaceFunction\n */\n\n\n\n/**\n * Turn normal line endings into hard breaks.\n *\n * @param {Nodes} tree\n *   Tree to change.\n * @returns {undefined}\n *   Nothing.\n */\nfunction newlineToBreak(tree) {\n  (0,mdast_util_find_and_replace__WEBPACK_IMPORTED_MODULE_0__.findAndReplace)(tree, [/\\r?\\n|\\r/g, replace])\n}\n\n/**\n * Replace line endings.\n *\n * @type {ReplaceFunction}\n */\nfunction replace() {\n  return {type: 'break'}\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvbWRhc3QtdXRpbC1uZXdsaW5lLXRvLWJyZWFrL2xpYi9pbmRleC5qcyIsIm1hcHBpbmdzIjoiOzs7OztBQUFBO0FBQ0EsYUFBYSx1QkFBdUI7QUFDcEMsYUFBYSx1REFBdUQ7QUFDcEU7O0FBRTBEOztBQUUxRDtBQUNBO0FBQ0E7QUFDQSxXQUFXLE9BQU87QUFDbEI7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNPO0FBQ1AsRUFBRSwyRUFBYztBQUNoQjs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBLFVBQVU7QUFDViIsInNvdXJjZXMiOlsid2VicGFjazovL2FpLWxpdGVyYWN5LWxhYi8uL25vZGVfbW9kdWxlcy9tZGFzdC11dGlsLW5ld2xpbmUtdG8tYnJlYWsvbGliL2luZGV4LmpzPzQyNDIiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAdHlwZWRlZiB7aW1wb3J0KCdtZGFzdCcpLk5vZGVzfSBOb2Rlc1xuICogQHR5cGVkZWYge2ltcG9ydCgnbWRhc3QtdXRpbC1maW5kLWFuZC1yZXBsYWNlJykuUmVwbGFjZUZ1bmN0aW9ufSBSZXBsYWNlRnVuY3Rpb25cbiAqL1xuXG5pbXBvcnQge2ZpbmRBbmRSZXBsYWNlfSBmcm9tICdtZGFzdC11dGlsLWZpbmQtYW5kLXJlcGxhY2UnXG5cbi8qKlxuICogVHVybiBub3JtYWwgbGluZSBlbmRpbmdzIGludG8gaGFyZCBicmVha3MuXG4gKlxuICogQHBhcmFtIHtOb2Rlc30gdHJlZVxuICogICBUcmVlIHRvIGNoYW5nZS5cbiAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gKiAgIE5vdGhpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBuZXdsaW5lVG9CcmVhayh0cmVlKSB7XG4gIGZpbmRBbmRSZXBsYWNlKHRyZWUsIFsvXFxyP1xcbnxcXHIvZywgcmVwbGFjZV0pXG59XG5cbi8qKlxuICogUmVwbGFjZSBsaW5lIGVuZGluZ3MuXG4gKlxuICogQHR5cGUge1JlcGxhY2VGdW5jdGlvbn1cbiAqL1xuZnVuY3Rpb24gcmVwbGFjZSgpIHtcbiAgcmV0dXJuIHt0eXBlOiAnYnJlYWsnfVxufVxuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/mdast-util-newline-to-break/lib/index.js\n");

/***/ })

};
;
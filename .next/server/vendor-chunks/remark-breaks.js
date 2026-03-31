"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/remark-breaks";
exports.ids = ["vendor-chunks/remark-breaks"];
exports.modules = {

/***/ "(ssr)/./node_modules/remark-breaks/lib/index.js":
/*!*************************************************!*\
  !*** ./node_modules/remark-breaks/lib/index.js ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ remarkBreaks)\n/* harmony export */ });\n/* harmony import */ var mdast_util_newline_to_break__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mdast-util-newline-to-break */ \"(ssr)/./node_modules/mdast-util-newline-to-break/lib/index.js\");\n/**\n * @typedef {import('mdast').Root} Root\n */\n\n\n\n/**\n * Support hard breaks without needing spaces or escapes (turns enters into\n * `<br>`s).\n *\n * @returns\n *   Transform.\n */\nfunction remarkBreaks() {\n  /**\n   * Transform.\n   *\n   * @param {Root} tree\n   *   Tree.\n   * @returns {undefined}\n   *   Nothing.\n   */\n  return function (tree) {\n    (0,mdast_util_newline_to_break__WEBPACK_IMPORTED_MODULE_0__.newlineToBreak)(tree)\n  }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvcmVtYXJrLWJyZWFrcy9saWIvaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQTtBQUNBLGFBQWEsc0JBQXNCO0FBQ25DOztBQUUwRDs7QUFFMUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDZTtBQUNmO0FBQ0E7QUFDQTtBQUNBLGFBQWEsTUFBTTtBQUNuQjtBQUNBLGVBQWU7QUFDZjtBQUNBO0FBQ0E7QUFDQSxJQUFJLDJFQUFjO0FBQ2xCO0FBQ0EiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9haS1saXRlcmFjeS1sYWIvLi9ub2RlX21vZHVsZXMvcmVtYXJrLWJyZWFrcy9saWIvaW5kZXguanM/MjJhMiJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEB0eXBlZGVmIHtpbXBvcnQoJ21kYXN0JykuUm9vdH0gUm9vdFxuICovXG5cbmltcG9ydCB7bmV3bGluZVRvQnJlYWt9IGZyb20gJ21kYXN0LXV0aWwtbmV3bGluZS10by1icmVhaydcblxuLyoqXG4gKiBTdXBwb3J0IGhhcmQgYnJlYWtzIHdpdGhvdXQgbmVlZGluZyBzcGFjZXMgb3IgZXNjYXBlcyAodHVybnMgZW50ZXJzIGludG9cbiAqIGA8YnI+YHMpLlxuICpcbiAqIEByZXR1cm5zXG4gKiAgIFRyYW5zZm9ybS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmVtYXJrQnJlYWtzKCkge1xuICAvKipcbiAgICogVHJhbnNmb3JtLlxuICAgKlxuICAgKiBAcGFyYW0ge1Jvb3R9IHRyZWVcbiAgICogICBUcmVlLlxuICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgKiAgIE5vdGhpbmcuXG4gICAqL1xuICByZXR1cm4gZnVuY3Rpb24gKHRyZWUpIHtcbiAgICBuZXdsaW5lVG9CcmVhayh0cmVlKVxuICB9XG59XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/remark-breaks/lib/index.js\n");

/***/ })

};
;
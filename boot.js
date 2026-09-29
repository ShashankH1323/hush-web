/* Runs synchronously in <head> before first paint: swaps .no-js for .js so scroll-reveal starts hidden only when scripting works.
 * Kept as a separate same-origin file (not inline) so the Content-Security-Policy needs no 'unsafe-inline' or hashes. */
(function () {
  var c = document.documentElement.classList;
  c.remove("no-js");
  c.add("js");
})();

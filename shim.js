// fontkit is a native font-parsing dependency pulled in by svgdom's
// Node-only text layout code (headless SVG rendering); sviewer never needs
// custom font loading, so this stubs it out rather than bundling it.
module.exports = {
  openSync: function openSync() {
    throw new Error('fontkit is stubbed out in sviewer -- custom font loading is not supported');
  }
};
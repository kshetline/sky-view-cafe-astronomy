/* eslint-disable @typescript-eslint/no-unused-vars, no-undef */

let mapsInitialized = false;
let mapsCallback = null;

// noinspection JSUnusedGlobalSymbols
function initGoogleMaps(callback) { // eslint-disable-line @typescript-eslint/no-unused-vars
  if (callback)
    mapsCallback = callback;
  else {
    mapsInitialized = true;

    if (mapsCallback)
      mapsCallback();
  }
}

(function () {
  const minWidth = 1024;
  const minHeight = 640;
  let width = Math.max(screen.width, screen.height);
  const origWidth = width;
  let height = Math.min(screen.height, screen.width);

  if (width < minWidth || height < minHeight) {
    const metaViewport = document.querySelector('meta[name=viewport]');
    const ratio = width / height;

    if (height / ratio < minHeight) {
      width = Math.round(minHeight * ratio);
      // The extra +2 ensures that a tiny amount of scrolling is possible, needed in some cases to scroll away
      // browser tabs and/or the address bar from a mobile screen.
      height = minHeight + 2;
    }
    else {
      width = minWidth;
      height = Math.round(minWidth / ratio) + 2;
    }

    const scale = origWidth / width;

    metaViewport.setAttribute('content', 'width=' + width + ', height=' + height + ', initial-scale=' + scale);
  }

  const location = document.location && document.location.href || window.location.href;
  let protocol = 'https';
  let host = 'test.skyviewcafe.com';
  let realWorld = true;
  let $ = /^(http(?:s?)):\/\/([^/]+)/.exec(location);

  if ($ && !/:(3000|8080)\b/.test($[2])) {
    protocol = $[1];
    host = $[2];
  }
  else
    realWorld = false;

  const base = (realWorld ? '' : protocol + '://' + host);
  const oldAppendChild = document.head.appendChild;

  // noinspection JSValidateTypes
  document.head.appendChild = function (node) {
    if (node.localName === 'script' && ($ = /^https:\/\/maps.googleapis.com(.*)$/.exec(node.src))) {
      node.src = base + '/maps/proxy' + $[1];

      // noinspection JSUnresolvedVariable (for `svcModKey`)
      if (window.svcModKey) // noinspection JSUnresolvedVariable (for `svcOrigKey`)
        node.src = node.src.replace(new RegExp(window.svcModKey, 'g'), window.svcOrigKey);
    }

    return oldAppendChild.apply(document.head, arguments);
  };

  const mapScript = document.createElement('script');

  mapScript.src = base + '/maps/script/';
  mapScript.setAttribute('async', '');
  mapScript.setAttribute('defer', '');
  mapScript.setAttribute('type', 'text/javascript');

  oldAppendChild.apply(document.head, [mapScript]);
})();

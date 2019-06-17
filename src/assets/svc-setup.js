var mapsInitialized = false;
var mapsCallback = null;

function initGoogleMaps(callback) {
  if (callback)
    mapsCallback = callback;
  else {
    mapsInitialized = true;

    if (mapsCallback)
      mapsCallback();
  }
}

(function() {
  var minWidth = 1024;
  var minHeight = 640;
  var width = Math.max(screen.width, screen.height);
  var origWidth = width;
  var height = Math.min(screen.height, screen.width);

  if (width < minWidth || height < minHeight) {
    var metaViewport = document.querySelector('meta[name=viewport]');
    var ratio = width / height;

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

    var scale = origWidth / width;

    metaViewport.setAttribute('content', 'width=' + width + ', height=' + height + ', initial-scale=' + scale);
  }

  var location = document.location && document.location.href || window.location.href;
  var protocol = 'https';
  var host ='test.skyviewcafe.com';
  var realWorld = true;
  var $ = /^(http(?:s?)):\/\/([^\/]+)/.exec(location);

  if ($ && !/:(3000|8080)\b/.test($[2])) {
    protocol = $[1];
    host = $[2];
  }
  else
    realWorld = false;

  var base = (realWorld ? '' : protocol + '://' + host);
  var oldAppendChild = document.head.appendChild;

  document.head.appendChild = function(node) {
    if (node.localName === 'script' && ($ = /^https:\/\/maps.googleapis.com(.*)$/.exec(node.src))) {
      node.src = base + '/maps/proxy' + $[1];

      if (window.svcModKey)
        node.src = node.src.replace(new RegExp(window.svcModKey, 'g'), window.svcOrigKey);
    }

    return oldAppendChild.apply(document.head, arguments);
  };

  var mapScript = document.createElement('script');

  mapScript.src = base + '/maps/script/';
  mapScript.setAttribute('async', '');
  mapScript.setAttribute('defer', '');
  mapScript.setAttribute('type', 'text/javascript');

  oldAppendChild.apply(document.head, [mapScript]);
})();

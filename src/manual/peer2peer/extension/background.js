//  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
//  Use of this source code is governed by a BSD-style license
//  that can be found in the LICENSE file in the root of the source
//  tree.

'use strict';

var dataSources = ['screen', 'window'];
var detectedBrowser = detectBrowser();
if (detectedBrowser.browser === 'chrome' &&
    detectedBrowser.version >= 50) {
  dataSources.push('tab');
  dataSources.push('audio');
}
var desktopMediaRequestId = '';

chrome.runtime.onConnect.addListener(function(port) {
  port.onMessage.addListener(function(msg) {
    if (msg.type === 'SS_UI_REQUEST') {
      requestScreenSharing(port, msg);
    }

    if (msg.type === 'SS_UI_CANCEL') {
      cancelScreenSharing(msg);
    }
  });
});

function requestScreenSharing(port, msg) {
  // https://developer.chrome.com/extensions/desktopCapture
  // params:
  //  - 'dataSources' Set of sources that should be shown to the user.
  //  - 'targetTab' Tab for which the stream is created.
  //  - 'streamId' String that can be passed to getUserMedia() API
  desktopMediaRequestId =
      chrome.desktopCapture.chooseDesktopMedia(dataSources, port.sender.tab,
          function(streamId) {
            if (streamId) {
              msg.type = 'SS_DIALOG_SUCCESS';
              msg.streamId = streamId;
            } else {
              msg.type = 'SS_DIALOG_CANCEL';
            }
            port.postMessage(msg);
          });
}

function cancelScreenSharing() {
  if (desktopMediaRequestId) {
    chrome.desktopCapture.cancelChooseDesktopMedia(desktopMediaRequestId);
  }
}

function extractVersion(uastring, expr, pos) {
  var match = uastring.match(expr);
  return match && match.length >= pos && parseInt(match[pos], 10);
}

function detectBrowser() {
  // Returned result object.
  var result = {};
  result.browser = null;
  result.version = null;
  result.minVersion = null;

  // Non supported browser.
  if (typeof window === 'undefined' || !window.navigator) {
    result.browser = 'Not a supported browser.';
    return result;
  }

  // Firefox.
  if (navigator.mozGetUserMedia) {
    result.browser = 'firefox';
    result.version = extractVersion(navigator.userAgent,
        /Firefox\/([0-9]+)\./, 1);
    result.minVersion = 31;
    return result;
  }

  // Chrome/Chromium/Webview.
  if (navigator.webkitGetUserMedia && window.webkitRTCPeerConnection) {
    result.browser = 'chrome';
    result.version = extractVersion(navigator.userAgent,
        /Chrom(e|ium)\/([0-9]+)\./, 2);
    result.minVersion = 38;
    return result;
  }

  // Edge.
  if (navigator.mediaDevices &&
      navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) {
    result.browser = 'edge';
    result.version = extractVersion(navigator.userAgent,
        /Edge\/(\d+).(\d+)$/, 2);
    result.minVersion = 10547;
    return result;
  }

  // Non supported browser default.
  result.browser = 'Not a supported browser.';
  return result;
}

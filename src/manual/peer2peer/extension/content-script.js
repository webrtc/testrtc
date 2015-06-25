//  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
//  Use of this source code is governed by a BSD-style license
//  that can be found in the LICENSE file in the root of the source
//  tree.

'use strict';

// https://goo.gl/7p5VrQ
//   - 'content_script' and execution env are isolated from each other
//   - In order to communicate we use the DOM (window.postMessage)
//
// app.js            |        |content-script.js |      |background.js
// window.postMessage|------->|port.postMessage  |----->| port.onMessage
//                   | window |                  | port |
// webkitGetUserMedia|<------ |window.postMessage|<-----| port.postMessage
//

var port = chrome.runtime.connect(chrome.runtime.id);

port.onMessage.addListener(function(msg) {
  window.postMessage(msg, '*');
});

window.addEventListener('message', function(event) {
  // We only accept messages from ourselves
  if (event.source !== window) {
    return;
  }

  if (event.data.type && ((event.data.type === 'SS_UI_REQUEST') ||
    (event.data.type === 'SS_UI_CANCEL'))) {
    port.postMessage(event.data);
  }
}, false);

window.postMessage({type: 'SS_PING', text: 'start'}, '*');

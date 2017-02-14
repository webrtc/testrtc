/*
 *  Copyright (c) 2017 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/*jshint esversion: 6 */

'use strict';

var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');
var startButton = document.getElementById('startButton');
startButton.onclick = start;

var pc1;
var pc2;
var stream;

function logError(err) {
  console.error(err);
}

function maybeCreateStream() {
  if (stream) {
    return;
  }
  if (localVideo.captureStream) {
    stream = localVideo.captureStream();
  } else if (localVideo.mozCaptureStream) {
    stream = localVideo.mozCaptureStream();
  } else {
    console.error('captureStream() not supported');
  }
}

function start() {
  startButton.onclick = hangup;
  startButton.className = 'red';
  startButton.innerHTML = 'Stop test';
  if (localVideo.readyState >= 3) {  // HAVE_FUTURE_DATA
    // Video is already ready to play, call maybeCreateStream in case oncanplay
    // fired before we registered the event handler.
    maybeCreateStream();
  }
  localVideo.play();
  call();
}

function call() {
  var servers = null;
  pc1 = new RTCPeerConnection(servers);
  pc1.onicecandidate = (event) => {
    if (event.candidate) {
      pc2.addIceCandidate(event.candidate);
    }
  };

  pc2 = new RTCPeerConnection(servers);
  pc2.onicecandidate = (event) => {
    if (event.candidate) {
      pc1.addIceCandidate(event.candidate);
    }
  };
  pc2.onaddstream = (event) => {
    remoteVideo.srcObject = event.stream;
  };

  pc1.addStream(stream);
  pc1.createOffer({
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
  }).then(onCreateOfferSuccess, logError);
}

function onCreateOfferSuccess(desc) {
  pc1.setLocalDescription(desc);
  pc2.setRemoteDescription(desc);
  pc2.createAnswer().then(onCreateAnswerSuccess, logError);
}

function onCreateAnswerSuccess(desc) {
  pc2.setLocalDescription(desc);
  pc1.setRemoteDescription(desc);
}

function hangup() {
  pc1.close();
  pc2.close();
  pc1 = null;
  pc2 = null;
  startButton.onclick = start;
  startButton.className = 'green';
  startButton.innerHTML = 'Start test';
  localVideo.pause();
}

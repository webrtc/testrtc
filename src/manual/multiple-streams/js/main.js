// Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.

// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file in the root of the source
// tree. An additional intellectual property rights grant can be found
// in the file PATENTS.  All contributing project authors may
// be found in the AUTHORS file in the root of the source tree.

'use strict';

var deviceList = [];
var counter = 0;
var remoteCounter = 0;
var startCall = document.getElementById('start-call');
startCall.addEventListener('click', call);
var pc1 = null;
var pc2 = null;

function call() {
  console.log('start call')
  pc1.createOffer(gotDescription1, onCreateSessionDescriptionError);
}

function gotSources_(devices) {
  for (var i = 0; i < devices.length; i++) {
    if (devices[i].kind === 'audioinput') {
      deviceList[i] = devices[i];
      console.log(deviceList[i]);
      requestAudio_(deviceList[i].deviceId);
    }
  }
}

function gotStream(stream) {
  trace('Received local stream');
  // Call the polyfill wrapper to attach the media stream to this element.
  localstream = stream;
  var audioTracks = localstream.getAudioTracks();
  if (audioTracks.length > 0) {
    trace('Using Audio device: ' + audioTracks[0].label);
  }
  pc1.addStream(localstream);
  trace('Adding Local Stream to peer connection');

  pc1.createOffer(gotDescription1, onCreateSessionDescriptionError);
}

function requestAudio_(id) {
  getUserMedia({
    audio: {optional: [{sourceId: id}]},
    video: false},
    function(stream) {
      getUserMediaOkCallback_(stream);
    },
    getUserMediaFailedCallback_);
}

function getUserMediaFailedCallback_(error) {
  alert('User media request denied with error: ' + error.name);
}

function getUserMediaOkCallback_(stream) {
  var audioArea = document.getElementById('audioArea');
  var audio = document.createElement('audio');
  var div = document.createElement('div');
  div.style.float = 'left';
  audio.setAttribute('id', 'local-audio' + counter);
  audio.setAttribute('controls', true);
  audio.setAttribute('muted', true);
  audio.setAttribute('autoplay', true);
  div.appendChild(audio);
  audioArea.appendChild(div);
  if (typeof stream.getAudioTracks()[0].label !== 'undefined') {
    var deviceLabel = document.createElement('p');
    deviceLabel.innerHTML = stream.getAudioTracks()[0].label;
    div.appendChild(deviceLabel);
  }
  stream.getAudioTracks()[0].addEventListener('ended', errorMessage_);
  attachMediaStream(document.getElementById('local-audio' + counter), stream);
  counter++;
  pc1.addStream(stream);
  trace('Adding Local Stream to peer connection');
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function setupPeerConnection() {
  trace('Starting call');
  var servers = null;
  var pcConstraints = {
    'optional': []
  };
  pc1 = new RTCPeerConnection(servers, pcConstraints);
  trace('Created local peer connection object pc1');

  pc2 = new RTCPeerConnection(servers, pcConstraints);
  trace('Created remote peer connection object pc2');

  pc1.onicecandidate = iceCallback1;
  pc2.onicecandidate = iceCallback2;
  pc2.onaddstream = gotRemoteStream;
}

function gotDescription1(desc) {
  var sdpConstraints = {
    'mandatory': {
      'OfferToReceiveAudio': true,
      'OfferToReceiveVideo': false
    }
  };
  trace('Offer from pc1 \n' + desc.sdp);
  pc1.setLocalDescription(desc, function() {
    pc2.setRemoteDescription(desc, function() {
      // Since the 'remote' side has no media stream we need
      // to pass in the right constraints in order for it to
      // accept the incoming offer of audio.
      pc2.createAnswer(gotDescription2, onCreateSessionDescriptionError,
          sdpConstraints);
    }, onSetSessionDescriptionError);
  }, onSetSessionDescriptionError);
}

function gotDescription2(desc) {
  pc2.setLocalDescription(desc, function() {
    trace('Answer from pc2 \n' + desc.sdp);
    pc1.setRemoteDescription(desc, function() {
    }, onSetSessionDescriptionError);
  }, onSetSessionDescriptionError);
}

function hangup() {
  trace('Ending call');
  pc1.close();
  pc2.close();
  pc1 = null;
  pc2 = null;
}

function gotRemoteStream(e) {
  var audioArea = document.getElementById('remoteAudioArea');
  var audio = document.createElement('audio');
  var div = document.createElement('div');
  div.style.float = 'left';
  audio.setAttribute('id', 'remote-audio' + remoteCounter);
  audio.setAttribute('controls', true);
  audio.setAttribute('muted', true);
  audio.setAttribute('autoplay', true);
  div.appendChild(audio);
  audioArea.appendChild(div);
  if (typeof e.stream.getAudioTracks()[0].label !== 'undefined') {
    var deviceLabel = document.createElement('p');
    deviceLabel.innerHTML = e.stream.getAudioTracks()[0].label;
    div.appendChild(deviceLabel);
  }
  console.log('Remote streams label: ' + e.stream.label);
  console.log('Remote streams : ' + e.stream.getAudioTracks());
  console.log('Remote audio tag: ' + audio);
  // Call the polyfill wrapper to attach the media stream to this element.
  attachMediaStream(audio, e.stream);

  trace('Received remote stream');
}

function iceCallback1(event) {
  if (event.candidate) {
    pc2.addIceCandidate(new RTCIceCandidate(event.candidate),
        onAddIceCandidateSuccess, onAddIceCandidateError);
    trace('Local ICE candidate: \n' + event.candidate.candidate);
  }
}

function iceCallback2(event) {
  if (event.candidate) {
    pc1.addIceCandidate(new RTCIceCandidate(event.candidate),
        onAddIceCandidateSuccess, onAddIceCandidateError);
    trace('Remote ICE candidate: \n ' + event.candidate.candidate);
  }
}

function onAddIceCandidateSuccess() {
  trace('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
  trace('Failed to add ICE Candidate: ' + error.toString());
}

function onSetSessionDescriptionError(error) {
  trace('Failed to set session description: ' + error.toString());
}


var errorMessage_ = function(event) {
  var message = 'getUserMedia successful but ' + event.type + ' event fired ' +
                'from camera. Most likely too many cameras on the same USB ' +
                'bus/hub. Verify this by disconnecting one of the cameras ' +
                'and try again.';
  document.getElementById('messages').innerHTML += event.target.label + ': ' +
                                                   message + '<br><br>';
};

window.onload = function() {
  setupPeerConnection();
  navigator.mediaDevices.enumerateDevices()
  .then(gotSources_);
};

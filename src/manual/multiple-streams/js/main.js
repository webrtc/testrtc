// Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.

// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file in the root of the source
// tree. An additional intellectual property rights grant can be found
// in the file PATENTS.  All contributing project authors may
// be found in the AUTHORS file in the root of the source tree.

'use strict';

// Global array of audio devices enumerated via mediaDevices
var deviceList = [];
// Keep track of how many audio tags we should create for local streams.
var counter = 0;
// Keep track of how many audio tags we should create for remote streams.
var remoteCounter = 0;
// Hookup startCallButton event.
var startCallButton = document.querySelector('#start-call');
startCallButton.addEventListener('click', call);
// Hookup endCallButton event.
var endCallButton = document.querySelector('#end-call');
endCallButton.addEventListener('click', hangup);
// Global peerConnection variables.
var pc1 = null;
var pc2 = null;
// Global local stream array.
var localStreams = [];

function call() {
  trace('Start call');
  // Setup new peerconnections if the user has hungup earlier.
  if (pc1 === null || pc2 === null) {
    setupPeerConnection_();
  }
  // Reuse existing local streams from previous call.
  if (localStreams.length > 0) {
    for (var streams in localStreams) {
      pc1.addStream(localStreams[streams]);
    }
  }
  pc1.createOffer(gotDescription1_, onCreateSessionDescriptionError_);

  // Setup the button states.
  startCallButton.disabled = true;
  endCallButton.disabled = false;
}

function gotSources_(devices) {
  for (var i = 0; i < devices.length; i++) {
    if (devices[i].kind === 'audioinput') {
      // Skipping default device due to not wanting duplicate devices.
      // This will not work on CrOS because it only exposes one device named
      // "Default" and because of just that it does not make sense to use this
      // page on CrOS at all.
      if (devices[i].label !== 'Default') {
        deviceList[i] = devices[i];
        requestAudio_(deviceList[i].deviceId);
      }
    }
  }
}

// Request getUserMedia with the provided devceId string.
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
  // Create audio tag and add to DOM.
  var localAudioArea = document.querySelector('#localAudioArea');
  var audio = document.createElement('audio');
  var div = document.createElement('div');
  audio.setAttribute('id', 'local-audio-' + counter);
  audio.setAttribute('controls', true);
  audio.setAttribute('muted', true);
  audio.setAttribute('autoplay', true);
  div.appendChild(audio);
  localAudioArea.appendChild(div);
  // Only add labels if they exist.
  if (typeof stream.getAudioTracks()[0].label !== 'undefined') {
    var deviceLabel = document.createElement('span');
    deviceLabel.style.position = 'relative';
    deviceLabel.style.top = '-0.7em';
    deviceLabel.innerHTML = stream.getAudioTracks()[0].label;
    div.appendChild(deviceLabel);
    trace('Adding Local Stream to peerConnection: ' + deviceLabel.innerHTML);
  }
  // Hookup ended event for error reporting.
  stream.getAudioTracks()[0].addEventListener('ended', trace);
  // Attach media streams to audio tags and pc1.
  attachMediaStream(document.getElementById('local-audio-' + counter), stream);
  counter++;
  pc1.addStream(stream);

  // Keep track of the localStreams for event cleanup when hanging up.
  localStreams.push(stream);
}

function onCreateSessionDescriptionError_(error) {
  alert('Failed to create session description: ' + error.toString());
}

function setupPeerConnection_() {
  trace('Setting up peerConnections');
  var servers = null;
  var pcConstraints = {
    'optional': []
  };
  pc1 = new RTCPeerConnection(servers, pcConstraints);
  trace('Created local peerConnection object pc1');
  pc2 = new RTCPeerConnection(servers, pcConstraints);
  trace('Created remote peerConnection object pc2');

  // Register peerConnect events.
  pc1.addEventListener('icecandidate', iceCallback1);
  pc2.addEventListener('icecandidate', iceCallback2);
  pc2.addEventListener('addstream', gotRemoteStream);
}

function gotDescription1_(desc) {
  var sdpConstraints = {
    'mandatory': {
      'OfferToReceiveAudio': true,
      'OfferToReceiveVideo': false
    }
  };
  trace('Got offer from pc1');
  pc1.setLocalDescription(desc, function() {
    pc2.setRemoteDescription(desc, function() {
      // Since the 'remote' side has no media stream we need
      // to pass in the right constraints in order for it to
      // accept the incoming offer of audio.
      pc2.createAnswer(gotDescription2_, onCreateSessionDescriptionError_,
          sdpConstraints);
    }, onSetSessionDescriptionError_);
  }, onSetSessionDescriptionError_);
}

function gotDescription2_(desc) {
  pc2.setLocalDescription(desc, function() {
    trace('Got answer from pc2');
    pc1.setRemoteDescription(desc, function() {
    }, onSetSessionDescriptionError_);
  }, onSetSessionDescriptionError_);
}

function hangup() {
  trace('Ending call');
  // Cleanup peerConnections.
  pc1.close();
  pc2.close();
  pc1 = null;
  pc2 = null;

  // Cleanup up audio elements.
  var remoteAudioArea = document.querySelector('#remoteAudioArea');
  var audioElementsToDelete = remoteAudioArea.childNodes.length;
  for (var i = 0; i < audioElementsToDelete; i++) {
    remoteAudioArea.removeChild(remoteAudioArea.childNodes[0]);
  }

  // Keep track of button states.
  startCallButton.disabled = false;
  endCallButton.disabled = true;
}

function gotRemoteStream(e) {
  // Create audio tag and add to DOM.
  var remoteAudioArea = document.querySelector('#remoteAudioArea');
  var audio = document.createElement('audio');
  var div = document.createElement('div');
  audio.setAttribute('id', 'remote-audio-' + remoteCounter);
  audio.setAttribute('controls', true);
  audio.setAttribute('muted', true);
  audio.setAttribute('autoplay', true);
  div.appendChild(audio);
  remoteAudioArea.appendChild(div);

  // Attach stream to audio tag button.
  var attachStream = document.createElement('button');
  attachStream.style.position = 'relative';
  attachStream.style.top = '-0.7em';
  attachStream.innerHTML = 'Attach stream';
  div.appendChild(attachStream);

  attachStream.addEventListener('click', function() {
    attachMediaStream(audio, e.stream);
    trace('Attaching stream: ' + e.stream.getAudioTracks()[0].label +
        ' to audio tag: ' + audio.id);
  });
  trace('Received remote stream: ' + e.stream.getAudioTracks()[0].label);
  remoteCounter++;

  // Remove stream from audio tag.
  var removeStream = document.createElement('button');
  removeStream.style.position = 'relative';
  removeStream.style.top = '-0.7em';
  removeStream.innerHTML = 'Remove Stream: ' +
      e.stream.getAudioTracks()[0].label;
  div.appendChild(removeStream);

  removeStream.addEventListener('click', function() {
    // This will generate a 404 error but that's expected.
    audio.src = null;
    trace('Removing stream: ' + e.stream.getAudioTracks()[0].label +
        ' from audio tag: ' + audio.id);
    trace('404 error is expected.');
  });
}

function iceCallback1(event) {
  if (event.candidate) {
    pc2.addIceCandidate(new RTCIceCandidate(event.candidate),
        onAddIceCandidateSuccess, onAddIceCandidateError);
  }
}

function iceCallback2(event) {
  if (event.candidate) {
    pc1.addIceCandidate(new RTCIceCandidate(event.candidate),
        onAddIceCandidateSuccess, onAddIceCandidateError);
  }
}

function onAddIceCandidateSuccess() {
  trace('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
  trace('Failed to add ICE Candidate: ' + error.toString());
}

function onSetSessionDescriptionError_(error) {
  trace('Failed to set session description: ' + error.toString());
}

window.onload = function() {
  setupPeerConnection_();
  navigator.mediaDevices.enumerateDevices()
  .then(gotSources_);
};

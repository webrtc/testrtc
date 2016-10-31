/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

function logError(err) {
  console.log(err);
}

var testTable = document.getElementById('test-table');
var nPeerConnectionsInput = document.getElementById('peer-connections-input');
var nPeerConnectionsSlider = document.getElementById('peer-connections-slider');
var startTestButton = document.getElementById('start-test-button');

nPeerConnectionsInput.oninput = function() {
  nPeerConnectionsSlider.value = nPeerConnectionsInput.value;
}

nPeerConnectionsSlider.oninput = function() {
  nPeerConnectionsInput.value = nPeerConnectionsSlider.value;
}

startTestButton.onclick = startTest;


function addNewVideoElement() {
  var newRow = testTable.insertRow(-1);
  var newCell = newRow.insertCell(-1);
  var video = document.createElement('video');
  video.autoplay = true;
  newCell.appendChild(video);
  return video;
}

function PeerConnection(id) {
  this.id = id;

  this.localConnection = null;
  this.remoteConnection = null;

  this.remoteView = addNewVideoElement();

  this.start = function() {
    var onGetUserMediaSuccess = this.onGetUserMediaSuccess.bind(this);
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    })
    .then(onGetUserMediaSuccess)
    .catch(logError);
  };

  this.onGetUserMediaSuccess = function(stream) {
    // Create local peer connection.
    this.localConnection = new RTCPeerConnection(null);
    this.localConnection.onicecandidate = (event) => {
      this.onIceCandidate(this.remoteConnection, event);
    };
    this.localConnection.addStream(stream);

    // Create remote peer connection.
    this.remoteConnection = new RTCPeerConnection(null);
    this.remoteConnection.onicecandidate = (event) => {
      this.onIceCandidate(this.localConnection, event);
    };
    this.remoteConnection.onaddstream = (e) => {
      this.remoteView.srcObject = e.stream;
    };

    // Initiate call.
    var onCreateOfferSuccess = this.onCreateOfferSuccess.bind(this);
    this.localConnection.createOffer({
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 1
    })
    .then(onCreateOfferSuccess, logError);
  };

  this.onCreateOfferSuccess = function(desc) {
    this.localConnection.setLocalDescription(desc);
    this.remoteConnection.setRemoteDescription(desc);

    var onCreateAnswerSuccess = this.onCreateAnswerSuccess.bind(this);
    this.remoteConnection.createAnswer()
    .then(onCreateAnswerSuccess, logError);
  };

  this.onCreateAnswerSuccess = function(desc) {
    this.remoteConnection.setLocalDescription(desc);
    this.localConnection.setRemoteDescription(desc);
  };

  this.onIceCandidate = function(connection, event) {
    if (event.candidate) {
      connection.addIceCandidate(new RTCIceCandidate(event.candidate));
    }
  };
}

function startTest() {
  var nPeerConnections = nPeerConnectionsInput.value;
  for (var i = 0; i < nPeerConnections; ++i) {
    new PeerConnection(i).start();
  }
}

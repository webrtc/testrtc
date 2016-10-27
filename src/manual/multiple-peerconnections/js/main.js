
/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

function logError(err) {
  console.log(err);
}

var nPeerConnections = 10;
var testTable = document.getElementById('test-table');

function addVideoPairToTable(localView, remoteView) {
  var newRow = testTable.insertRow(-1);
  var localCell = newRow.insertCell(-1);
  localCell.appendChild(localView);
  var remoteCell = newRow.insertCell(-1);
  remoteCell.appendChild(remoteView);
}

function PeerConnection(id) {
  this.id = id;

  this.localConnection = null;
  this.remoteConnection = null;

  this.localView = document.createElement('video');
  this.localView.autoplay = true;
  this.remoteView = document.createElement('video');
  this.remoteView.autoplay = true;
  addVideoPairToTable(this.localView, this.remoteView);

  this.start = function() {
    var onGetUserMediaSuccess = this.onGetUserMediaSuccess.bind(this);
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    })
    .then(onGetUserMediaSuccess)
    .catch(logError);
  }

  this.onGetUserMediaSuccess = function(stream) {
    // Display stream in local video tag.
    this.localView.srcObject = stream;

    // Create local peer connection.
    this.localConnection = new RTCPeerConnection(null);
    this.localConnection.onicecandidate = (event) => {
      this.onIceCandidate(this.remoteConnection, event);
    }
    this.localConnection.addStream(stream);

    // Create remote peer connection.
    this.remoteConnection = new RTCPeerConnection(null);
    this.remoteConnection.onicecandidate = (event) => {
      this.onIceCandidate(this.localConnection, event);
    }
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
  }

  this.onCreateOfferSuccess = function(desc) {
    this.localConnection.setLocalDescription(desc);
    this.remoteConnection.setRemoteDescription(desc);

    var onCreateAnswerSuccess = this.onCreateAnswerSuccess.bind(this);
    this.remoteConnection.createAnswer()
    .then(onCreateAnswerSuccess, logError);
  }

  this.onCreateAnswerSuccess = function(desc) {
    this.remoteConnection.setLocalDescription(desc);
    this.localConnection.setRemoteDescription(desc);
  }

  this.onIceCandidate = function(connection, event) {
    if (event.candidate) {
      connection.addIceCandidate(new RTCIceCandidate(event.candidate));
    }
  }
}

function startTest() {
  for (var i = 0; i < nPeerConnections; ++i) {
    new PeerConnection(i).start();
  }
}

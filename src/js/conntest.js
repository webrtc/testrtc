/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

addTest(testSuiteName.CONNECTIVITY, testCaseName.RELAYCONNECTIVITY,
    relayConnectivityTest);
addTest(testSuiteName.CONNECTIVITY, testCaseName.REFLEXIVECONNECTIVITY,
    reflexiveConnectivityTest);
addTest(testSuiteName.CONNECTIVITY, testCaseName.HOSTCONNECTIVITY,
    hostConnectivityTest);

var timeout = null;

// Set up a datachannel between two peers through a relay
// and verify data can be transmitted and received
// (packets travel through the public internet)
function relayConnectivityTest() {
  Call.asyncCreateTurnConfig(
    runConnectivityTest.bind(null, Call.isRelay),
    reportFatal);
}

// Set up a datachannel between two peers through a public IP address
// and verify data can be transmitted and received
// (packets should stay on the link if behind a router doing NAT)
function reflexiveConnectivityTest() {
  runConnectivityTest(Call.isReflexive, {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302'
        ]
      }
    ]
  });
}

// Set up a datachannel between two peers through a local IP address
// and verify data can be transmitted and received
// (packets should not leave the machine running the test)
function hostConnectivityTest() {
  runConnectivityTest(Call.isHost);
}

function runConnectivityTest(iceCandidateFilter, config) {
  var call = new Call(config);
  call.setIceCandidateFilter(iceCandidateFilter);
  call.pc1.channel = call.pc1.createDataChannel(null);
  call.pc1.channel.addEventListener('open', function() {
    call.pc1.channel.send('hello');
  });
  call.pc1.channel.addEventListener('message', function(event) {
    clearTimeout(timeout);
    if (event.data !== 'world') {
      reportFatal();
    } else {
      reportSuccess('Data successfully transmitted between peers.');
      setTestFinished();
    }
  });
  call.pc2.addEventListener('datachannel', function(event) {
    call.pc2.channel = event.channel;
    call.pc2.channel.addEventListener('message', function(event) {
      if (event.data !== 'hello') {
        clearTimeout(timeout);
        reportFatal();
      } else {
        call.pc2.channel.send('world');
      }
    });
  });
  call.establishConnection();
  timeout = setTimeout(reportFatal.bind(null, 'Timed out'), 2000);
}

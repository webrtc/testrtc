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
    runConnectivityTest.bind(null, Call.isRelay), reportFatal);
}

// Set up a datachannel between two peers through a public IP address
// and verify data can be transmitted and received
// (packets should stay on the link if behind a router doing NAT)
function reflexiveConnectivityTest() {
  Call.asyncCreateStunConfig(
    runConnectivityTest.bind(null, Call.isReflexive), reportFatal);
}

// Set up a datachannel between two peers through a local IP address
// and verify data can be transmitted and received
// (packets should not leave the machine running the test)
function hostConnectivityTest() {
  runConnectivityTest(Call.isHost);
}

function runConnectivityTest(iceCandidateFilter, config) {
  var candidates = [];
  var call = new Call(config);
  call.setIceCandidateFilter(iceCandidateFilter);

  // Collect all candidate for validation.
  call.pc1.onicecandidate = function(event) {
    if (event.candidate) {
      candidates.push(Call.parseCandidate(event.candidate.candidate));
    }
  };

  var ch1 = call.pc1.createDataChannel(null);
  ch1.addEventListener('open', function() {
    ch1.send('hello');
  });
  ch1.addEventListener('message', function(event) {
    if (event.data !== 'world') {
      reportError('Data not transmitted.');
    } else {
      reportSuccess('Data successfully transmitted between peers.');
    }
    hangup();
  });
  call.pc2.addEventListener('datachannel', function(event) {
    var ch2 = event.channel;
    ch2.addEventListener('message', function(event) {
      if (event.data !== 'hello') {
        hangup('Data not transmitted.');
      } else {
        ch2.send('world');
      }
    });
  });
  call.establishConnection();
  timeout = setTimeout(hangup.bind(null, 'Timed out'), 5000);

  function hangup(errorMessage) {
    if (errorMessage) {
      // Handle warning message for reflexive failures.
      var getReflexiveCandidate = function() {
        for (var candidate in candidates) {
          if (Call.isReflexive(candidates[candidate])) {
            return candidates[candidate];
          }
        }
      };
      if (Call.isReflexive(getReflexiveCandidate())) {
        var reflexCandidate = getReflexiveCandidate();
        reportWarning(
            'Gathered candidate with type: ' + reflexCandidate.type +
            ' Protocol: ' + reflexCandidate.protocol +
            ' Address: ' + reflexCandidate.address +
            ' but failed to connect using it, likely due to the network ' +
            'environment.');
      } else {
        reportError(errorMessage);
      }
    }
    clearTimeout(timeout);
    call.close();
    setTestFinished();
  }
}

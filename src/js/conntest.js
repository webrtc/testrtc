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
  var timeout = null;
  var parsedCandidates = [];
  var call = new Call(config);
  call.setIceCandidateFilter(iceCandidateFilter);

  // Collect all candidate for validation.
  call.pc1.addEventListener('icecandidate', function(event) {
    if (event.candidate) {
      var parsedCandidate = Call.parseCandidate(event.candidate.candidate);
      parsedCandidates.push(parsedCandidate);

      // Report candidate info based on iceCandidateFilter.
      if (iceCandidateFilter(parsedCandidate)) {
        reportInfo(
          'Gathered candidate of Type: ' + parsedCandidate.type +
          ' Protocol: ' + parsedCandidate.protocol +
          ' Address: ' + parsedCandidate.address);
      }
    }
  });

  var ch1 = call.pc1.createDataChannel(null);
  ch1.addEventListener('open', function() {
    ch1.send('hello');
  });
  ch1.addEventListener('message', function(event) {
    if (event.data !== 'world') {
      reportError('Invalid data transmitted.');
    } else {
      reportSuccess('Data successfully transmitted between peers.');
    }
    hangup();
  });
  call.pc2.addEventListener('datachannel', function(event) {
    var ch2 = event.channel;
    ch2.addEventListener('message', function(event) {
      if (event.data !== 'hello') {
        hangup('Invalid data transmitted.');
      } else {
        ch2.send('world');
      }
    });
  });
  call.establishConnection();
  timeout = setTimeout(hangup.bind(null, 'Timed out'), 5000);

  function findParsedCandidateOfSpecifiedType(candidateTypeMethod) {
    for (var candidate in parsedCandidates) {
      if (candidateTypeMethod(parsedCandidates[candidate])) {
        return candidateTypeMethod(parsedCandidates[candidate]);
      }
    }
  }

  function hangup(errorMessage) {
    if (errorMessage) {
      // Report warning for server reflexive test if it times out.
      if (errorMessage === 'Timed out' &&
          iceCandidateFilter.toString() === Call.isReflexive.toString() &&
          findParsedCandidateOfSpecifiedType(Call.isReflexive)) {
        reportWarning('Could not connect using reflexive candidates, likely ' +
            'due to the network environment/configuration.');
      } else {
        reportError(errorMessage);
      }
    }
    clearTimeout(timeout);
    call.close();
    setTestFinished();
  }
}

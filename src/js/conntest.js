/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

// Set up a datachannel between two peers through a relay
// and verify data can be transmitted and received
// (packets travel through the public internet)
addTest(
    testSuiteName.CONNECTIVITY, testCaseName.RELAYCONNECTIVITY, function(test) {
      var runConnectivityTest = new RunConnectivityTest(test, Call.isRelay);
      runConnectivityTest.run();
    });

// Set up a datachannel between two peers through a public IP address
// and verify data can be transmitted and received
// (packets should stay on the link if behind a router doing NAT)
addTest(testSuiteName.CONNECTIVITY, testCaseName.REFLEXIVECONNECTIVITY,
    function(test) {
      var runConnectivityTest = new RunConnectivityTest(test, Call.isReflexive);
      runConnectivityTest.run();
    });

// Set up a datachannel between two peers through a local IP address
// and verify data can be transmitted and received
// (packets should not leave the machine running the test)
addTest(
    testSuiteName.CONNECTIVITY, testCaseName.HOSTCONNECTIVITY, function(test) {
      var runConnectivityTest = new RunConnectivityTest(test, Call.isHost);
      runConnectivityTest.start();
    });

function RunConnectivityTest(test, iceCandidateFilter) {
  this.test = test;
  this.iceCandidateFilter = iceCandidateFilter;
  this.timeout = null;
  this.parsedCandidates = [];
  this.call = null;
}

RunConnectivityTest.prototype = {
  run: function() {
    Call.asyncCreateTurnConfig(this.start.bind(this),
        this.test.reportFatal.bind(this.test));
  },

  start: function(config) {
    this.call = new Call(config, this.test);
    this.call.setIceCandidateFilter(this.iceCandidateFilter);

    // Collect all candidates for validation.
    this.call.pc1.addEventListener('icecandidate', function(event) {
      if (event.candidate) {
        var parsedCandidate = Call.parseCandidate(event.candidate.candidate);
        this.parsedCandidates.push(parsedCandidate);

        // Report candidate info based on iceCandidateFilter.
        if (this.iceCandidateFilter(parsedCandidate)) {
          this.test.reportInfo(
              'Gathered candidate of Type: ' + parsedCandidate.type +
            ' Protocol: ' + parsedCandidate.protocol +
            ' Address: ' + parsedCandidate.address);
        }
      }
    }.bind(this));

    var ch1 = this.call.pc1.createDataChannel(null);
    ch1.addEventListener('open', function() {
      ch1.send('hello');
    });
    ch1.addEventListener('message', function(event) {
      if (event.data !== 'world') {
        this.test.reportError('Invalid data transmitted.');
      } else {
        this.test.reportSuccess('Data successfully transmitted between peers.');
      }
      this.hangup();
    }.bind(this));
    // this.call.pc2.addEventListener('datachannel', function(event) {
    //   var ch2 = event.channel;
    //   ch2.addEventListener('message', function(event) {
    //     if (event.data !== 'hello') {
    //       this.hangup('Invalid data transmitted.');
    //     } else {
    //       ch2.send('world');
    //     }
    //   }.bind(this));
    // }.bind(this));
    this.call.establishConnection();
    this.timeout = setTimeout(this.hangup.bind(this, 'Timed out'), 5000);
  },

  findParsedCandidateOfSpecifiedType: function(candidateTypeMethod) {
    for (var candidate in this.parsedCandidates) {
      if (candidateTypeMethod(this.parsedCandidates[candidate])) {
        return candidateTypeMethod(this.parsedCandidates[candidate]);
      }
    }
  },

  hangup: function(errorMessage) {
    if (errorMessage) {
      // Report warning for server reflexive test if it times out.
      if (errorMessage === 'Timed out' &&
          this.iceCandidateFilter.toString() === Call.isReflexive.toString() &&
          this.findParsedCandidateOfSpecifiedType(Call.isReflexive)) {
        this.test.reportWarning('Could not connect using reflexive ' +
            'candidates, likely due to the network environment/configuration.');
      } else {
        this.test.reportError(errorMessage);
      }
    }
    clearTimeout(this.timeout);
    this.call.close();
    this.test.done();
  }
};

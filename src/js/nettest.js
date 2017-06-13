/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

// Test whether it can connect via UDP to a TURN server
// Get a TURN config, and try to get a relay candidate using UDP.
addTest(testSuiteName.NETWORK, testCaseName.UDPENABLED, function(test) {
  var networkTest = new NetworkTest(test, 'udp', null, Call.isRelay);
  networkTest.run();
});

// Test whether it can connect via TCP to a TURN server
// Get a TURN config, and try to get a relay candidate using TCP.
addTest(testSuiteName.NETWORK, testCaseName.TCPENABLED, function(test) {
  var networkTest = new NetworkTest(test, 'tcp', null, Call.isRelay);
  networkTest.run();
});

// Test whether it is IPv6 enabled (TODO: test IPv6 to a destination).
// Turn on IPv6, and try to get an IPv6 host candidate.
addTest(testSuiteName.NETWORK, testCaseName.IPV6ENABLED, function(test) {
  var params = {optional: [{googIPv6: true}]};
  var networkTest = new NetworkTest(test, null, params, Call.isIpv6);
  networkTest.run();
});

var NetworkTest = function(test, protocol, params, iceCandidateFilter) {
  this.test = test;
  this.protocol = protocol;
  this.params = params;
  this.iceCandidateFilter = iceCandidateFilter;
};

NetworkTest.prototype = {
  run: function() {
    // Do not create turn config for IPV6 test.
    if (this.iceCandidateFilter.toString() === Call.isIpv6.toString()) {
      this.gatherCandidates(null, this.params, this.iceCandidateFilter);
    } else {
      Call.asyncCreateTurnConfig(this.start.bind(this),
          this.test.reportFatal.bind(this.test));
    }
  },

  start: function(config) {
    this.filterConfig(config, this.protocol);
    this.gatherCandidates(config, this.params, this.iceCandidateFilter);
  },

  // Filter the RTCConfiguration |config| to only contain URLs with the
  // specified transport protocol |protocol|. If no turn transport is
  // specified it is added with the requested protocol.
  filterConfig: function(config, protocol) {
    var transport = 'transport=' + protocol;
    var newIceServers = [];
    for (var i = 0; i < config.iceServers.length; ++i) {
      var iceServer = config.iceServers[i];
      var newUrls = [];
      for (var j = 0; j < iceServer.urls.length; ++j) {
        var uri = iceServer.urls[j];
        if (uri.indexOf(transport) !== -1) {
          newUrls.push(uri);
        } else if (uri.indexOf('?transport=') === -1 &&
            uri.startsWith('turn')) {
          newUrls.push(uri + '?' + transport);
        }
      }
      if (newUrls.length !== 0) {
        iceServer.urls = newUrls;
        newIceServers.push(iceServer);
      }
    }
    config.iceServers = newIceServers;
  },

  // Create a PeerConnection, and gather candidates using RTCConfig |config|
  // and ctor params |params|. Succeed if any candidates pass the |isGood|
  // check, fail if we complete gathering without any passing.
  gatherCandidates: function(config, params, isGood) {
    var pc;
    try {
      pc = new RTCPeerConnection(config, params);
    } catch (error) {
      if (params !== null && params.optional[0].googIPv6) {
        this.test.reportWarning('Failed to create peer connection, IPv6 ' +
            'might not be setup/supported on the network.');
      } else {
        this.test.reportError('Failed to create peer connection: ' + error);
      }
      this.test.done();
      return;
    }

    // In our candidate callback, stop if we get a candidate that passes
    // |isGood|.
    pc.addEventListener('icecandidate', function(e) {
      // Once we've decided, ignore future callbacks.
      if (e.currentTarget.signalingState === 'closed') {
        return;
      }

      if (e.candidate) {
        var parsed = Call.parseCandidate(e.candidate.candidate);
        if (isGood(parsed)) {
          this.test.reportSuccess('Gathered candidate of Type: ' + parsed.type +
              ' Protocol: ' + parsed.protocol + ' Address: ' + parsed.address);
          pc.close();
          pc = null;
          this.test.done();
        }
      } else {
        pc.close();
        pc = null;
        if (params !== null && params.optional[0].googIPv6) {
          this.test.reportWarning('Failed to gather IPv6 candidates, it ' +
              'might not be setup/supported on the network.');
        } else {
          this.test.reportError('Failed to gather specified candidates');
        }
        this.test.done();
      }
    }.bind(this));

    this.createAudioOnlyReceiveOffer(pc);
  },

  // Create an audio-only, recvonly offer, and setLD with it.
  // This will trigger candidate gathering.
  createAudioOnlyReceiveOffer: function(pc) {
    var createOfferParams = {offerToReceiveAudio: 1};
    pc.createOffer(
        createOfferParams
    ).then(
        function(offer) {
          pc.setLocalDescription(offer).then(
              noop,
              noop
          );
        },
        noop
    );

    // Empty function for callbacks requiring a function.
    function noop() {}
  }
};

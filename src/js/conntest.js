/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

addTest(testSuiteName.CONNECTIVITY, testCaseName.UDPCONNECTIVITY,
    udpConnectivityTest);
addTest(testSuiteName.CONNECTIVITY, testCaseName.TCPCONNECTIVITY,
    tcpConnectivityTest);
addTest(testSuiteName.CONNECTIVITY, testCaseName.IPV6ENABLED,
    hasIpv6CandidatesTest);

// Test whether it can connect via UDP to a TURN server
// Get a TURN config, and try to get a relay candidate using UDP.
function udpConnectivityTest() {
  Call.asyncCreateTurnConfig(
      function(config) {
        filterConfig(config, 'udp');
        var filter = Call.configHasStunURI(config) ? Call.isUdp : Call.isRelay;
        gatherCandidates(config, null, filter);
      },
      reportFatal);
}

// Test whether it can connect via TCP to a TURN server
// Get a TURN config, and try to get a relay candidate using TCP.
function tcpConnectivityTest() {
  Call.asyncCreateTurnConfig(
      function(config) {
        filterConfig(config, 'tcp');
        var filter = Call.configHasStunURI(config) ? Call.isTcp : Call.isRelay;
        gatherCandidates(config, null, filter);
      },
      reportFatal);
}

// Test whether it is IPv6 enabled (TODO: test IPv6 to a destination).
// Turn on IPv6, and try to get an IPv6 host candidate.
function hasIpv6CandidatesTest() {
  var params = {optional: [{googIPv6: true}]};
  gatherCandidates(null, params, Call.isIpv6);
}

// Filter the RTCConfiguration |config| to only contain URLs with the
// specified transport protocol |protocol|. If no turn transport is
// specified it is added with the requested protocol.
function filterConfig(config, protocol) {
  var transport = 'transport=' + protocol;
  for (var i = 0; i < config.iceServers.length; ++i) {
    var iceServer = config.iceServers[i];
    var newUrls = [];
    for (var j = 0; j < iceServer.urls.length; ++j) {
      var uri = iceServer.urls[j];
      if (uri.indexOf(transport) !== -1 || uri.indexOf('stun') === 0) {
        newUrls.push(uri);
      } else if (uri.indexOf('?transport=') === -1 && uri.startsWith('turn')) {
        newUrls.push(uri + '?' + transport);
      }
    }
    iceServer.urls = newUrls;
  }
}

// Create a PeerConnection, and gather candidates using RTCConfig |config|
// and ctor params |params|. Succeed if any candidates pass the |isGood|
// check, fail if we complete gathering without any passing.
function gatherCandidates(config, params, isGood) {
  var pc;
  try {
    pc = new RTCPeerConnection(config, params);
  } catch (error) {
    return reportFatal('Fail to create peer connection: ' + error);
  }

  // In our candidate callback, stop if we get a candidate that passes |isGood|.
  pc.onicecandidate = function(e) {
    // Once we've decided, ignore future callbacks.
    if (pc.signalingState === 'closed') {
      return;
    }

    if (e.candidate) {
      var parsed = Call.parseCandidate(e.candidate.candidate);
      if (isGood(parsed)) {
        reportSuccess('Gathered candidate with type: ' + parsed.type +
                      ' address: ' + parsed.address);
        pc.close();
        setTestFinished();
      }
    } else {
      pc.close();
      reportFatal('Failed to gather specified candidates');
    }
  };

  // Create an audio-only, recvonly offer, and setLD with it.
  // This will trigger candidate gathering.
  var createOfferParams = {mandatory: {OfferToReceiveAudio: true}};
  pc.createOffer(function(offer) { pc.setLocalDescription(offer, noop, noop) ;},
                 noop, createOfferParams);
}

function noop() {
}

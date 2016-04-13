/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

function Call(config, test) {
  this.test = test;
  this.traceEvent = report.traceEventAsync('call');
  this.traceEvent({config: config});

  this.pc1 = new RTCPeerConnection(config);
  this.pc2 = new RTCPeerConnection(config);

  this.pc1.addEventListener('icecandidate', this.onIceCandidate_.bind(this,
      this.pc2));
  this.pc2.addEventListener('icecandidate', this.onIceCandidate_.bind(this,
      this.pc1));

  this.iceCandidateFilter_ = Call.noFilter;
}

Call.prototype = {
  establishConnection: function() {
    this.traceEvent({state: 'start'});
    this.pc1.createOffer(this.gotOffer_.bind(this),
        this.test.reportFatal.bind(this.test));
  },

  close: function() {
    this.traceEvent({state: 'end'});
    this.pc1.close();
    this.pc2.close();
  },

  setIceCandidateFilter: function(filter) {
    this.iceCandidateFilter_ = filter;
  },

  // Constraint max video bitrate by modifying the SDP when creating an answer.
  constrainVideoBitrate: function(maxVideoBitrateKbps) {
    this.constrainVideoBitrateKbps_ = maxVideoBitrateKbps;
  },

  // Remove video FEC if available on the offer.
  disableVideoFec: function() {
    this.constrainOfferToRemoveVideoFec_ = true;
  },

  // When the peerConnection is closed the statsCb is called once with an array
  // of gathered stats.
  gatherStats: function(peerConnection, localStream, statsCb) {
    var stats = [];
    var statsCollectTime = [];
    var that = this;
    var statStepMs = 100;
    // Firefox does not handle the mediaStream object directly, either |null|
    // for all stats or mediaStreamTrack, which is according to the standard: https://www.w3.org/TR/webrtc/#widl-RTCPeerConnection-getStats-void-MediaStreamTrack-selector-RTCStatsCallback-successCallback-RTCPeerConnectionErrorCallback-failureCallback
    // Chrome accepts |null| as well but the getStats response reports do not
    // contain mediaStreamTrack stats.
    // TODO: Is it worth using MediaStreamTrack for both browsers? Then we
    // would need to request stats per track etc.
    var selector = (adapter.browserDetails.browser === 'chrome') ?
        localStream : null;
    getStats_();

    function getStats_() {
      if (peerConnection.signalingState === 'closed') {
        statsCb(stats, statsCollectTime);
        return;
      }
      peerConnection.getStats(selector)
          .then(gotStats_)
          .catch(function(error) {
            that.test.reportFatal('Could not gather stats: ' + error);
          }.bind(that));
    }

    function gotStats_(response) {
      // TODO: Remove browser specific stats gathering hack once adapter.js or
      // browsers converge on a standard.
      if (adapter.browserDetails.browser === 'chrome') {
        for (var index in response.result()) {
          stats.push(response.result()[index]);
          statsCollectTime.push(Date.now());
        }
      } else if (adapter.browserDetails.browser === 'firefox') {
        for (var j in response) {
          var stat = response[j];
          stats.push(stat);
          statsCollectTime.push(Date.now());
        }
      } else {
        that.test.reportError('Only Firefox and Chrome getStats ' +
            'implementations are supported.');
      }
      setTimeout(getStats_, statStepMs);
    }
  },

  gotOffer_: function(offer) {
    if (this.constrainOfferToRemoveVideoFec_) {
      offer.sdp = offer.sdp.replace(/(m=video 1 [^\r]+)(116 117)(\r\n)/g,
                                    '$1\r\n');
      offer.sdp = offer.sdp.replace(/a=rtpmap:116 red\/90000\r\n/g, '');
      offer.sdp = offer.sdp.replace(/a=rtpmap:117 ulpfec\/90000\r\n/g, '');
      offer.sdp = offer.sdp.replace(/a=rtpmap:98 rtx\/90000\r\n/g, '');
      offer.sdp = offer.sdp.replace(/a=fmtp:98 apt=116\r\n/g, '');
    }
    this.pc1.setLocalDescription(offer);
    this.pc2.setRemoteDescription(offer);
    this.pc2.createAnswer(this.gotAnswer_.bind(this),
        this.test.reportFatal.bind(this.test));
  },

  gotAnswer_: function(answer) {
    if (this.constrainVideoBitrateKbps_) {
      answer.sdp = answer.sdp.replace(
          /a=mid:video\r\n/g,
          'a=mid:video\r\nb=AS:' + this.constrainVideoBitrateKbps_ + '\r\n');
    }
    this.pc2.setLocalDescription(answer);
    this.pc1.setRemoteDescription(answer);
  },

  onIceCandidate_: function(otherPeer, event) {
    if (event.candidate) {
      var parsed = Call.parseCandidate(event.candidate.candidate);
      if (this.iceCandidateFilter_(parsed)) {
        otherPeer.addIceCandidate(event.candidate);
      }
    }
  }
};

Call.noFilter = function() {
  return true;
};

Call.isRelay = function(candidate) {
  return candidate.type === 'relay';
};

Call.isNotHostCandidate = function(candidate) {
  return candidate.type !== 'host';
};

Call.isReflexive = function(candidate) {
  return candidate.type === 'srflx';
};

Call.isHost = function(candidate) {
  return candidate.type === 'host';
};

Call.isIpv6 = function(candidate) {
  return candidate.address.indexOf(':') !== -1;
};

// Parse a 'candidate:' line into a JSON object.
Call.parseCandidate = function(text) {
  var candidateStr = 'candidate:';
  var pos = text.indexOf(candidateStr) + candidateStr.length;
  var fields = text.substr(pos).split(' ');
  return {
    'type': fields[7],
    'protocol': fields[2],
    'address': fields[4]
  };
};

// Get a TURN config, either from settings or from CEOD.
Call.asyncCreateTurnConfig = function(onSuccess, onError) {
  var settings = currentTest.settings;
  if (typeof(settings.turnURI) === 'string' && settings.turnURI !== '') {
    var iceServer = {
      'username': settings.turnUsername || '',
      'credential': settings.turnCredential || '',
      'urls': settings.turnURI.split(',')
    };
    var config = {'iceServers': [iceServer]};
    report.traceEventInstant('turn-config', config);
    setTimeout(onSuccess.bind(null, config), 0);
  } else {
    Call.fetchTurnConfig_(function(response) {
      var config = {'iceServers': response.iceServers};
      report.traceEventInstant('turn-config', config);
      onSuccess(config);
    }, onError);
  }
};

// Get a STUN config, either from settings or from CEOD.
Call.asyncCreateStunConfig = function(onSuccess, onError) {
  var settings = currentTest.settings;
  if (typeof(settings.stunURI) === 'string' && settings.stunURI !== '') {
    var iceServer = {
      'urls': settings.stunURI.split(',')
    };
    var config = {'iceServers': [iceServer]};
    report.traceEventInstant('stun-config', config);
    setTimeout(onSuccess.bind(null, config), 0);
  } else {
    Call.fetchTurnConfig_(function(response) {
      var config = {'iceServers': response.iceServers.urls};
      report.traceEventInstant('stun-config', config);
      onSuccess(config);
    }, onError);
  }
};

// Ask network traversal API to give us TURN server credentials and URLs.
Call.fetchTurnConfig_ = function(onSuccess, onError) {
  var xhr = new XMLHttpRequest();
  function onResult() {
    if (xhr.readyState !== 4) {
      return;
    }

    if (xhr.status !== 200) {
      onError('TURN request failed');
      return;
    }

    var response = JSON.parse(xhr.responseText);
    onSuccess(response);
  }

  xhr.onreadystatechange = onResult;
  // API_KEY and TURN_URL is replaced with API_KEY environment variable via
  // Gruntfile.js during build time by uglifyJS.
  // jscs:disable
  /* jshint ignore:start */
  xhr.open('POST', TURN_URL + API_KEY, true);
  // jscs:enable
  /* jshint ignore:end */
  xhr.send();
};

/* eslint-disable */ /* disable linting on upstream WebRTC code */

/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

var DEFAULT_PORT = 22466;
var TLS_PORT = 443;
function Call(config) {
	this.statsGatheringRunning = false;
	this.pc1 = new RTCPeerConnection(config);
	this.pc2 = new RTCPeerConnection(config);

	this.pc1.addEventListener('icecandidate', this.onIceCandidate.bind(this,
		this.pc2));
	this.pc2.addEventListener('icecandidate', this.onIceCandidate.bind(this,
		this.pc1));

	this.iceCandidateFilter_ = Call.noFilter;
}

Call.prototype = {
	establishConnection: function() {
		this.pc1.createOffer().then(
			this.gotOffer_.bind(this),
			function() { console.log("couldn't create offer"); }
		);
	},

	close: function() {
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
		var self = this;
		var statStepMs = 100;
		// Firefox does not handle the mediaStream object directly, either |null|
		// for all stats or mediaStreamTrack, which is according to the standard: https://www.w3.org/TR/webrtc/#widl-RTCPeerConnection-getStats-void-MediaStreamTrack-selector-RTCStatsCallback-successCallback-RTCPeerConnectionErrorCallback-failureCallback
		// Chrome accepts |null| as well but the getStats response reports do not
		// contain mediaStreamTrack stats.
		// TODO: Is it worth using MediaStreamTrack for both browsers? Then we
		// would need to request stats per track etc.
		var selector = (adapter.browserDetails.browser === 'chrome') ? // eslint-disable-line no-undef
			localStream : null;
		this.statsGatheringRunning = true;
		getStats();

		function getStats() {
			if (peerConnection.signalingState === 'closed') {
				self.statsGatheringRunning = false;
				statsCb(stats, statsCollectTime);
				return;
			}
			peerConnection.getStats(selector)
				.then(gotStats_)
				.catch(function(error) {
					console.log(`Could not gather stats ${error}`);
					self.statsGatheringRunning = false;
					statsCb(stats, statsCollectTime);
				});
		}

		function gotStats_(response) {
			// TODO: Remove browser specific stats gathering hack once adapter.js or
			// browsers converge on a standard.
			if (adapter.browserDetails.browser === 'chrome') { // eslint-disable-line no-undef
				for (var index in response) {
					if (response.hasOwnProperty(index)) {
						stats.push(response[index]);
						statsCollectTime.push(Date.now());
					}
				}
			} else if (adapter.browserDetails.browser === 'firefox') { // eslint-disable-line no-undef
				for (var j in response) {
					if (response.hasOwnProperty(j)) {
						var stat = response[j];
						stats.push(stat);
						statsCollectTime.push(Date.now());
					}
				}
			} else {
				console.log('Only Firefox and Chrome getStats implementations are supported.');
			}
			setTimeout(getStats, statStepMs);
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
		this.pc2.createAnswer().then(
			this.gotAnswer_.bind(this),
			function() { console.log("couldn't create offer"); }
		);
	},

	gotAnswer_: function(answer) {
		if (this.constrainVideoBitrateKbps_) {
			answer.sdp = answer.sdp.replace(
				/a=mid:video\r\n/g,
				`a=mid:video\r\nb=AS:${this.constrainVideoBitrateKbps_}\r\n`);
		}
		this.pc2.setLocalDescription(answer);
		this.pc1.setRemoteDescription(answer);
	},

	onIceCandidate: function(otherPeer, event) {
		if (event.candidate) {
			var parsed = Call.parseCandidate(event.candidate.candidate);
			if (this.iceCandidateFilter_(parsed)) {
				otherPeer.addIceCandidate(event.candidate);
			}
		}
	},
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
	var candidate_str = 'candidate:';
	var pos = text.indexOf(candidate_str) + candidate_str.length;
	var fields = text.substr(pos).split(' ');
	return {
		type: fields[7],
		protocol: fields[2],
		address: fields[4],
	};
};

// Store the ICE server response from the network traversal server.
Call.cachedIceServers_ = null;
// Keep track of when the request was made.
Call.cachedIceConfigFetchTime_ = null;

// Get a TURN config, either from settings or from network traversal server.
Call.asyncCreateTurnConfig = function(onSuccess, onError, transportProtocol = 'udp', tls = false) {
	var url = '';
	var port = '';
	if (tls) {
		url = `turns:${serverURL}`; // eslint-disable-line no-undef
		port = TLS_PORT;
	} else {
		url = `turn:${serverURL}`; // eslint-disable-line no-undef
		port = DEFAULT_PORT;
	}
	var settings = {
		turn_URI: `${url}.slack-core.com:${port}?transport=${transportProtocol}`,
		turn_username: turnUser, // eslint-disable-line no-undef
		turn_credential: turnPass, // eslint-disable-line no-undef
	};
	var ice_server = {
		username: settings.turn_username || '',
		credential: settings.turn_credential || '',
		urls: settings.turn_URI.split(','),
	};
	var config = { iceServers: [ice_server] }; // eslint-disable-line slack/var-name
	setTimeout(onSuccess.bind(null, config), 0);
};

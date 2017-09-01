/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* eslint-disable */ /* disable linting on upstream WebRTC code */

'use strict';

var NetworkTest = function(protocol, params, iceCandidateFilter, nextTestCallback, tls) {

	this.protocol = protocol;
	this.params = params;
	this.iceCandidateFilter = iceCandidateFilter;
	this.nextTestCallback = nextTestCallback;
	this.tls = tls;
	this.fail = function(failText){
		calls_errors_found = true;
		num_calls_errors+=1;
		networkWarnings+=1;
		$("#network-header").addClass("fail_flag"); //adds empty css class to denote that a test failed
		if (this.protocol === 'udp' && !this.tls) {
			$("#net-test-result").prev("span").addClass("emphasis");
			$("#net-test-result").text(failText);
			$("#net-test-result").append(warning);
			$("#net-test").addClass("fail_flag");
			addToFullText("Network UDP", $("#net-test-result"));
			callsWarnings.push(["Network UDP", failText]) //for later creation of warnings list
		} else if (this.protocol === 'tcp' && !this.tls){
			$("#net-test-result2").prev("span").addClass("emphasis");
			$("#net-test-result2").text(failText);
			$("#net-test-result2").append(warning);
			$("#net-test2").addClass("fail_flag");
			addToFullText("Network TCP", $("#net-test-result2"));
			callsWarnings.push(["Network TCP", failText]) //for later creation of warnings list
		} else if (this.protocol === 'tcp' && this.tls){
			removeTestingStyling("#network-header","#network-check-icon-running");

			$("#network-header").children("h3:first").addClass("fail");
			$("#network-header").addClass("is_active");
			$("#net-test-result3").prev("span").addClass("emphasis");
			$("#net-test-result3").text(failText);
			$("#net-test-result3").append(warning);
			$("#net-test3").addClass("fail_flag");
			addToFullText("Network TCP/TLS", $("#net-test-result3"));

			// last test, so now update child elements and header
			addCautionToHeader($("#network-check-icon-fail"), networkWarnings)
			updateChildListItems($("#net-test3").parent("ul"));
			callsWarnings.push(["Network TCP/TLS", failText]) //for later creation of warnings list
		}
		this.nextTestCallback.call();
	}
	this.running = function(){
		// transition from waiting header to testing header
		setTestingHeader($("#network-header"),$("#network-check-icon-waiting"), $("#network-check-icon-running"));
		if (this.protocol === 'udp' && !this.tls) {
			$("#net-test-result").text("connecting...");
			$("#network-check-icon-running-text").html("Testing UDP (1/3)");
			$("#calls-current-test").text("(3/" + totalTests + ") ...");

		} else if (this.protocol === 'tcp' & !this.tls){
			$("#net-test-result2").text("running...");
			$("#network-check-icon-running-text").html("Testing TCP (2/3)");
			$("#calls-current-test").text("(4/" + totalTests + ") ...");

		} else if (this.protocol === 'tcp' && this.tls){
			$("#net-test-result3").text("running...");
			$("#network-check-icon-running-text").html("Testing TCP/TLS (3/3)");
			$("#calls-current-test").text("(5/" + totalTests + ") ...");
		}
	}
	this.pass = function(){
		if (this.protocol === 'udp' && !this.tls) {
			$("#net-test-result").text("");
			$("#net-test-result").append(checkmark);
			$("#net-test").addClass("pass_flag");
		} else if (this.protocol === 'tcp' && !this.tls){
			$("#net-test-result2").text("");
			$("#net-test-result2").append(checkmark);
			$("#net-test2").addClass("pass_flag");
		} else if (this.protocol === 'tcp' && this.tls){
			removeTestingStyling("#network-header","#network-check-icon-running");
			$("#net-test-result3").text("");
			$("#net-test-result3").append(checkmark);
			$("#net-test3").addClass("pass_flag");
			// last test, also check if header has had a fail yet (i.e. another test failed)
			if(!$("#network-header").hasClass("fail_flag")){
				$("#network-header").children("h3:first").addClass("pass");
				$("#network-check-icon-pass").removeClass("hidden");
				$("#network-check-icon-pass").addClass("show");
			} else{ //add fail class
				$("#network-header").children("h3:first").addClass("fail");
				$("#network-header").addClass("is_active");
				// last test, so now update child elements and header
				addCautionToHeader($("#network-check-icon-fail"), networkWarnings)
			}
			//update all child elements appropriately
			updateChildListItems($("#net-test3").parent("ul"));
		}
		this.nextTestCallback.call();
	}
};

NetworkTest.prototype = {
	run: function() {
		this.running();
		// Do not create turn config for IPV6 test.
		if (this.iceCandidateFilter.toString() === Call.isIpv6.toString()) {
			this.gatherCandidates(null, this.params, this.iceCandidateFilter);
		} else {
			Call.asyncCreateTurnConfig(this.start.bind(this),
				function(error){console.log(error)}, this.protocol, this.tls);
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
				console.log('Failed to create peer connection, IPv6 ' +
						'might not be setup/supported on the network.');
			} else {
				console.log('Failed to create peer connection: ' + error);
			}
			this.fail("Failed to create peer connection");
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
					console.log('Gathered candidate of Type: ' + parsed.type +
							' Protocol: ' + parsed.protocol + ' Address: ' + parsed.address);
					pc.close();
					pc = null;
					this.pass()
					return;
				}
			} else {
				pc.close();
				pc = null;
				if (params !== null && params.optional[0].googIPv6) {
					console.log('Failed to gather IPv6 candidates, it ' +
							'might not be setup/supported on the network.');
				} else {
					console.log('Failed to gather specified candidates');
				}
				this.fail("Likely not supported on your network");
				return;
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

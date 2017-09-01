/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* eslint-disable */ /* disable linting on upstream WebRTC code */

'use strict';


function RunConnectivityTest(iceCandidateFilter, nextTestCallback) {
	this.iceCandidateFilter = iceCandidateFilter;
	this.timeout = null;
	this.parsedCandidates = [];
	this.call = null;
	this.nextTestCallback = nextTestCallback
	this.fail = function(failText){
		calls_errors_found = true;
		num_calls_errors += 1;
		connectivityWarnings += 1;
		callsWarnings.push(["Relay", failText]) //for later creation of warnings list
		// remove testing styling
		removeTestingStyling("#connection-header","#connection-check-icon-running");

		var list_item = $("#conn-test");
		list_item.addClass("fail_flag");
		$("#conn-test-result").text(failText);
		$("#conn-test-result").append(warning);
		$("#connection-header").children("h3:first").addClass("fail");
		$("#connection-header").addClass("is_active");
		addCautionToHeader($("#connection-check-icon-fail"), connectivityWarnings);
		addToFullText("Connectivity", $("#conn-test-result"));

		updateChildListItems(list_item.parent("ul"));
		this.nextTestCallback.call();
	}
	this.running = function(){
		// transition from waiting header to testing header
		setTestingHeader($("#connection-header"),$("#connection-check-icon-waiting"), $("#connection-check-icon-running"));
		$("#connection-check-icon-running-text").html("Testing Connectivity")
		$("#conn-test-result").text("connecting...");
		$("#calls-current-test").text("(6/" + totalTests + ") ...")
	}
	this.pass = function(){
		// remove testing styling
		removeTestingStyling("#connection-header","#connection-check-icon-running");

		var list_item = $("#conn-test");
		list_item.addClass("pass_flag");
		$("#conn-test-result").text("");
		$("#conn-test-result").append(checkmark);
		$("#connection-header").children("h3:first").addClass("pass");
		$("#connection-check-icon-pass").removeClass("hidden");
		$("#connection-check-icon-pass").addClass("show");
		updateChildListItems(list_item.parent("ul"));
		this.nextTestCallback.call();
	}
}

RunConnectivityTest.prototype = {
	run: function() {
		this.running();
		var url = "turn:" + serverURL
		Call.asyncCreateTurnConfig(this.start.bind(this),
				function(error){console.log(error)});
	},

	start: function(config) {
		this.call = new Call(config);
		this.call.setIceCandidateFilter(this.iceCandidateFilter);

		// Collect all candidates for validation.
		this.call.pc1.addEventListener('icecandidate', function(event) {
			if (event.candidate) {
				var parsedCandidate = Call.parseCandidate(event.candidate.candidate);
				this.parsedCandidates.push(parsedCandidate);

				// Report candidate info based on iceCandidateFilter.
				if (this.iceCandidateFilter(parsedCandidate)) {
					console.log(
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
				console.log('Invalid data transmitted.');
			} else {
				console.log('Data successfully transmitted between peers.');
				this.pass();
			}
			this.hangup();
		}.bind(this));
		this.call.pc2.addEventListener('datachannel', function(event) {
			var ch2 = event.channel;
			ch2.addEventListener('message', function(event) {
				if (event.data !== 'hello') {
					this.hangup('Invalid data transmitted.');
				} else {
					ch2.send('world');
				}
			}.bind(this));
		}.bind(this));
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
				console.log('Could not connect using reflexive ' +
						'candidates, likely due to the network environment/configuration.');
			} else {
				console.log(errorMessage);
			}
			this.fail("Likely not supported on your network");
		}
		clearTimeout(this.timeout);
		this.call.close();
	}
};

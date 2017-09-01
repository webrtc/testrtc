/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* eslint-disable */ /* disable linting on upstream WebRTC code */

'use strict';

// Creates a loopback via relay candidates and tries to send as many packets
// with 1024 chars as possible while keeping dataChannel bufferedAmmount above
// zero.

function DataChannelThroughputTest(nextTestCallback) {
	this.testDurationSeconds = 5.0;
	this.startTime = null;
	this.sentPayloadBytes = 0;
	this.receivedPayloadBytes = 0;
	this.stopSending = false;
	this.samplePacket = '';

	for (var i = 0; i !== 1024; ++i) {
		this.samplePacket += 'h';
	}

	this.maxNumberOfPacketsToSend = 1;
	this.bytesToKeepBuffered = 1024 * this.maxNumberOfPacketsToSend;
	this.lastBitrateMeasureTime = null;
	this.lastReceivedPayloadBytes = 0;

	this.call = null;
	this.senderChannel = null;
	this.receiveChannel = null;
	this.nextTestCallback = nextTestCallback
	this.fail = function(failText){
		calls_errors_found = true;
		num_calls_errors+=1;
		throughputWarnings+=1;
		callsWarnings.push(["Data Throughput", "Too slow for voice and video calling"]) //for later creation of warnings list
		setFail($("#datathroughput-test-result"), $("#datathroughput-test"), $("#throughput-header"), failText);
		addToFullText("Data Throughput", $("#datathroughput-test-result"));

		this.nextTestCallback.call();
	}
	this.running = function(){
		// transition from waiting header to testing header
		setTestingHeader($("#throughput-header"),$("#throughput-check-icon-waiting"), $("#throughput-check-icon-running"));
		$("#datathroughput-test-result").text("testing...");
		$("#throughput-check-icon-running-text").html("Testing Data (1/2)");
		$("#calls-current-test").text("(7/" + totalTests + ") ...")
	}
	this.pass = function(passText){
		$("#datathroughput-test-result").text(passText);
		$("#datathroughput-test-result").append(checkmark);
		$("#datathroughput-test").addClass("pass_flag");
		this.nextTestCallback.call();
	}
}

DataChannelThroughputTest.prototype = {
	run: function() {
		this.running();
		Call.asyncCreateTurnConfig(this.start.bind(this),
				function(error){console.log(error)});
	},

	start: function(config) {
		this.call = new Call(config);
		this.call.setIceCandidateFilter(Call.isRelay);
		this.senderChannel = this.call.pc1.createDataChannel(null);
		this.senderChannel.addEventListener('open', this.sendingStep.bind(this));

		this.call.pc2.addEventListener('datachannel',
				this.onReceiverChannel.bind(this));

		this.call.establishConnection();
	},

	onReceiverChannel: function(event) {
		this.receiveChannel = event.channel;
		this.receiveChannel.addEventListener('message',
				this.onMessageReceived.bind(this));
	},

	sendingStep: function() {
		var now = new Date();
		if (!this.startTime) {
			this.startTime = now;
			this.lastBitrateMeasureTime = now;
		}

		for (var i = 0; i !== this.maxNumberOfPacketsToSend; ++i) {
			if (this.senderChannel.bufferedAmount >= this.bytesToKeepBuffered) {
				break;
			}
			this.sentPayloadBytes += this.samplePacket.length;
			this.senderChannel.send(this.samplePacket);
		}

		if (now - this.startTime >= 1000 * this.testDurationSeconds) {
			this.stopSending = true;
		} else {
			setTimeout(this.sendingStep.bind(this), 1);
		}
	},

	onMessageReceived: function(event) {
		this.receivedPayloadBytes += event.data.length;
		var now = new Date();
		if (now - this.lastBitrateMeasureTime >= 1000) {
			var bitrate = (this.receivedPayloadBytes -
					this.lastReceivedPayloadBytes) / (now - this.lastBitrateMeasureTime);
			bitrate = Math.round(bitrate * 1000 * 8) / 1000;
			console.log('Transmitting at ' + bitrate + ' kbps.');
			this.lastReceivedPayloadBytes = this.receivedPayloadBytes;
			this.lastBitrateMeasureTime = now;
		}
		if (this.stopSending &&
				this.sentPayloadBytes === this.receivedPayloadBytes) {
			this.call.close();
			this.call = null;

			var elapsedTime = Math.round((now - this.startTime) * 10) / 10000.0;
			var receivedKBits = this.receivedPayloadBytes * 8 / 1000;
			console.log('Total transmitted: ' + receivedKBits +
					' kilo-bits in ' + elapsedTime + ' seconds.');
			var throughput_rate = receivedKBits/(1000.0*elapsedTime); //convert to mbps
			console.log("Throughput rate in mbps: ", throughput_rate);
			if(throughput_rate < 0.2){ // if rate is < 0.2 mbps, likely too slow for calling
				this.fail("");
			} else{
				this.pass("");
			}
		}
	}
};

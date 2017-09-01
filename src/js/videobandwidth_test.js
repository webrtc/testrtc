/* eslint-disable */ /* disable linting on upstream WebRTC code */

// Measures video bandwidth estimation performance by doing a loopback call via
// relay candidates for 40 seconds. Computes rtt and bandwidth estimation
// average and maximum as well as time to ramp up (defined as reaching 75% of
// the max bitrate. It reports infinite time to ramp up if never reaches it.

function VideoBandwidthTest(nextTestCallback) {
	this.maxVideoBitrateKbps = 2000;
	this.durationMs = 40000;
	this.statStepMs = 100;
	this.bweStats = new StatisticsAggregate(0.75 * this.maxVideoBitrateKbps *
			1000);
	this.rttStats = new StatisticsAggregate();
	this.packetsLost = null;
	this.videoStats = [];
	this.startTime = null;
	this.call = null;
	this.nextTestCallback = nextTestCallback
	// Open the camera in 720p to get a correct measurement of ramp-up time.
	this.constraints = {
		audio: false,
		video: {
			optional: [
				{minWidth: 1280},
				{minHeight: 720}
			]
		}
	};
	this.fail = function(failText){
		calls_errors_found = true;
		num_calls_errors+=1;
		throughputWarnings+=1;
		callsWarnings.push(["Video Throughput", failText]) //for later creation of warnings list

		removeTestingStyling("#throughput-header","#throughput-check-icon-running");
		$("#videobandwidth-test-result").prev("span").addClass("emphasis");
		$("#videobandwidth-test-result").text(failText);
		$("#videobandwidth-test-result").append(warning);
		$("#videobandwidth-test").addClass("fail_flag")

		$("#throughput-header").children("h3:first").addClass("fail");
		$("#throughput-header").addClass("is_active");
		// Last test, so update header and child items
		addCautionToHeader($("#throughput-check-icon-fail"), throughputWarnings)

		addToFullText("Video Throughput", $("#videobandwidth-test-result"));
		updateChildListItems($("#videobandwidth-test").parent("ul"));
		this.nextTestCallback.call();
	}
	this.running = function(){
		$("#throughput-check-icon-running-text").html("Testing Video (2/2)");
		$("#videobandwidth-test-result").text("testing...");
		$("#calls-current-test").text("(8/" + totalTests + ") ...");
	}
	this.pass = function(){
		removeTestingStyling("#throughput-header","#throughput-check-icon-running");
		$("#videobandwidth-test-result").text("");
		$("#videobandwidth-test-result").append(checkmark);
		$("#videobandwidth-test").addClass("pass_flag")
		// last test, check if above tests failed
		if(!$("#throughput-header").hasClass("fail_flag")){
			$("#throughput-header").children("h3:first").addClass("pass");
			$("#throughput-check-icon-pass").removeClass("hidden");
			$("#throughput-check-icon-pass").addClass("show");
		} else{ //fail appropriately
			$("#throughput-header").children("h3:first").addClass("fail");
			$("#throughput-header").addClass("is_active");
			addCautionToHeader($("#throughput-check-icon-fail"), throughputWarnings);
		}
		// update child elements
		updateChildListItems($("#videobandwidth-test").parent("ul"));
		this.nextTestCallback.call();
	}
}

VideoBandwidthTest.prototype = {
	run: function() {
		this.running();
		Call.asyncCreateTurnConfig(this.start.bind(this),
				function(error){console.log(error)});
	},

	start: function(config) {
		this.call = new Call(config);
		this.call.setIceCandidateFilter(Call.isRelay);
		// FEC makes it hard to study bandwidth estimation since there seems to be
		// a spike when it is enabled and disabled. Disable it for now. FEC issue
		// tracked on: https://code.google.com/p/webrtc/issues/detail?id=3050
		this.call.disableVideoFec();
		this.call.constrainVideoBitrate(this.maxVideoBitrateKbps);
		navigator.getUserMedia(this.constraints, this.gotStream.bind(this), function(error){
			console.log("Error in calling getUserMedia: ", error);
			this.fail("Camera likely blocked in browser");
		}.bind(this));
	},

	gotStream: function(stream) {
		this.call.pc1.addStream(stream);
		this.call.establishConnection();
		this.startTime = new Date();
		this.localStream = stream.getVideoTracks()[0];
		setTimeout(this.gatherStats.bind(this), this.statStepMs);
	},

	gatherStats: function() {
		var now = new Date();
		if (now - this.startTime > this.durationMs) {
			this.hangup();
			return;
		} else if (!this.call.statsGatheringRunning) {
			this.call.gatherStats(this.call.pc1, this.localStream,
					this.gotStats_.bind(this));
		}
		setTimeout(this.gatherStats.bind(this), this.statStepMs);
	},

	gotStats_: function(response) {
		// TODO: Remove browser specific stats gathering hack once adapter.js or
		// browsers converge on a standard.
		if (adapter.browserDetails.browser === 'chrome') {
			for (var i in response) {
				if (response[i].id === 'bweforvideo') {
					this.bweStats.add(Date.parse(response[i].timestamp),
							parseInt(response[i].googAvailableSendBandwidth));
				} else if (response[i].type === 'ssrc') {
					this.rttStats.add(Date.parse(response[i].timestamp),
							parseInt(response[i].googRtt));
					// Grab the last stats.
					this.videoStats[0] = response[i].googFrameWidthSent;
					this.videoStats[1] = response[i].googFrameHeightSent;
					this.packetsLost = response[i].packetsLost;
				}
			}
		} else if (adapter.browserDetails.browser === 'firefox') {
			for (var j in response) {
				if (response[j].id === 'outbound_rtcp_video_0') {
					this.rttStats.add(Date.parse(response[j].timestamp),
							parseInt(response[j].mozRtt));
					// Grab the last stats.
					this.jitter = response[j].jitter;
					this.packetsLost = response[j].packetsLost;
				} else if (response[j].id === 'outbound_rtp_video_0') {
					// TODO: Get dimensions from getStats when supported in FF.
					this.videoStats[0] = 'Not supported on Firefox';
					this.videoStats[1] = 'Not supported on Firefox';
					this.bitrateMean = response[j].bitrateMean;
					this.bitrateStdDev = response[j].bitrateStdDev;
					this.framerateMean = response[j].framerateMean;
				}
			}
		} else {
			console.log('Only Firefox and Chrome getStats implementations' +
				' are supported.');
		}
		this.completed();
	},

	hangup: function() {
		this.call.pc1.getLocalStreams()[0].getTracks().forEach(function(track) {
			track.stop();
		});
		this.call.close();
		this.call = null;
	},

	completed: function() {
		// TODO: Remove browser specific stats gathering hack once adapter.js or
		// browsers converge on a standard.
		if (adapter.browserDetails.browser === 'chrome') {
			// Checking if greater than 2 because Chrome sometimes reports 2x2 when
			// a camera starts but fails to deliver frames.
			if (this.videoStats[0] < 2 && this.videoStats[1] < 2) {
				console.log('Camera failure: ' + this.videoStats[0] + 'x' +
						this.videoStats[1] + '. Cannot test bandwidth without a working ' +
						' camera.');
				this.fail("Camera blocked or broken");
				return;
			} else {
				console.log('Video resolution: ' + this.videoStats[0] +
						'x' + this.videoStats[1]);
				console.log('Send bandwidth estimate average: ' +
						this.bweStats.getAverage() + ' bps');
				console.log('Send bandwidth estimate max: ' +
						this.bweStats.getMax() + ' bps');
				console.log('Send bandwidth ramp-up time: ' +
						this.bweStats.getRampUpTime() + ' ms');
			}
		} else if (adapter.browserDetails.browser === 'firefox') {
			if (parseInt(this.framerateMean) > 0) {
				console.log('Frame rate mean: ' +
						parseInt(this.framerateMean));
			} else {
				console.log('Frame rate mean is 0, cannot test bandwidth ' +
						'without a working camera.');
				this.fail("Camera blocked or broken");
				return;
			}
			console.log('Send bitrate mean: ' + parseInt(this.bitrateMean) +
					' bps');
			console.log('Send bitrate standard deviation: ' +
					parseInt(this.bitrateStdDev) + ' bps');
		}
		console.log('RTT average: ' + this.rttStats.getAverage() +
						' ms');
		console.log('RTT max: ' + this.rttStats.getMax() + ' ms');
		console.log('Lost packets: ' + this.packetsLost);

		this.pass();
	}
};
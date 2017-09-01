/* eslint-disable */ /* disable linting on upstream WebRTC code */

// Copyright (c) 2014, The WebRTC project authors. All rights reserved.Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

// Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

// Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

// Neither the name of Google nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


'use strict';

/*
 * In generic cameras using Chrome rescaler, all resolutions should be supported
 * up to a given one and none beyond there. Special cameras, such as digitizers,
 * might support only one resolution.
 */

/*
 * "Analyze performance for "resolution"" test uses getStats, canvas and the
 * video element to analyze the video frames from a capture device. It will
 * report number of black frames, frozen frames, tested frames and various stats
 * like average encode time and FPS. A test case will be created per mandatory
 * resolution found in the "resolutions" array.
 */

function CamResolutionsTest(nextTestCallback) {
	this.resolutions = [];
	this.current_resolution = 0;
	this.is_muted = false;
	this.is_shutting_down = false;
	this.nextTestCallback = nextTestCallback;
	this.fail = function(failText) {
		calls_errors_found = true;
		num_calls_errors += 1;
		camWarnings += 1;
		callsWarnings.push(['Camera', failText]) //for later creation of warnings list
		// remove header test styling
		removeTestingStyling("#camera-header","#cam-check-icon-running");

		var list_item = $("#cam-test");
		list_item.addClass("fail_flag");
		$("#cam-test-result").prev("span").addClass("emphasis");
		$("#cam-test-result").text(failText)
		$("#cam-test-result").append(warning);

		$("#camera-header").children("h3:first").addClass("fail");
		$("#camera-header").addClass("is_active");

		addCautionToHeader($('#cam-check-icon-fail'), camWarnings)

		addToFullText("Camera", $("#cam-test-result"));
		updateChildListItems(list_item.parent("ul"));
		this.nextTestCallback.call();
	};
	this.running = function(){
		// transition from waiting header to testing header
		setTestingHeader($("#camera-header"),$("#cam-check-icon-waiting"), $("#cam-check-icon-running"));
		$("#cam-test-result").text("testing...");
		$("#cam-check-icon-running-text").html("Testing Camera");
		$("#calls-current-test").text("(2/" + totalTests + ") ...")
	};
	this.pass = function(){
		removeTestingStyling("#camera-header","#cam-check-icon-running");

		var list_item = $("#cam-test");
		list_item.addClass("pass_flag");
		$("#cam-test-result").text("");
		$("#cam-test-result").append(checkmark);

		$("#camera-header").children("h3:first").addClass("pass");
		$("#cam-check-icon-pass").removeClass("hidden");
		$("#cam-check-icon-pass").addClass("show");
		updateChildListItems(list_item.parent("ul"));
		this.nextTestCallback.call();
	};
}

CamResolutionsTest.prototype = {
	run: function() {
		this.running();
		this.startGetUserMedia(this.resolutions[this.current_resolution]);
	},

	startGetUserMedia: function(resolution) {
		// NOTE, USING DEFAULT BROWSER SETTINGS
		var constraints = {
			audio: false,
			video: true
		};
		navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
			// Do not check actual video frames when more than one resolution is
			// provided.
			if (this.resolutions.length > 1) {
				console.log('Supported: ' + resolution[0] + 'x' +
				resolution[1]);
				stream.getTracks().forEach(function(track) {
					track.stop();
				});
			} else {
				this.collectAndAnalyzeStats_(stream, resolution);
			}
		}.bind(this))
		.catch(function(error) {
			var reason = ""
			if (this.resolutions.length > 1) {
				console.log(resolution[0] + 'x' + resolution[1] +
				' not supported');
				reason = "Camera resolution not supported";
			} else {
				console.log('getUserMedia failed with error: ' +
						error.name);
				reason = "Likely blocked in browser";
			}
			this.fail(reason);
		}.bind(this));
	},

	collectAndAnalyzeStats_: function(stream, resolution) {
		var tracks = stream.getVideoTracks();
		if (tracks.length < 1) {
			console.log('No video track in returned stream.');
			this.fail("Likely blocked in browser");
			return;
		}
		// Firefox does not support event handlers on mediaStreamTrack yet.
		// https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack
		// TODO: remove if (...) when event handlers are supported by Firefox.
		var videoTrack = tracks[0];
		if (typeof videoTrack.addEventListener === 'function') {
			// Register events.
			videoTrack.addEventListener('ended', function() {
				// Ignore events when shutting down the test.
				if (this.is_shutting_down) {
					return;
				}
				console.log('Video track ended, camera stopped working');
			}.bind(this));
			videoTrack.addEventListener('mute', function() {
				// Ignore events when shutting down the test.
				if (this.is_shutting_down) {
					return;
				}
				console.log('Your camera reported itself as muted.');
				// MediaStreamTrack.muted property is not wired up in Chrome yet,
				// checking is_muted local state.
				this.is_muted = true;
			}.bind(this));
			videoTrack.addEventListener('unmute', function() {
				// Ignore events when shutting down the test.
				if (this.is_shutting_down) {
					return;
				}
				console.log('Your camera reported itself as unmuted.');
				this.is_muted = false;
			}.bind(this));
		}
		var video = document.createElement('video');
		video.setAttribute('autoplay', '');
		video.setAttribute('muted', '');
		video.srcObject = stream;
		video.width = video.videoWidth
		video.height = video.videoHeight

		var frameChecker = new VideoFrameChecker(video);
		var call = new Call(null);

		call.pc1.addStream(stream);
		call.establishConnection();
		call.gatherStats(call.pc1, stream,
				this.onCallEnded_.bind(this, resolution, video,
						stream, frameChecker),
				100);

		setTimeout(this.endCall_.bind(this, call, stream), 8000);
	},

	onCallEnded_: function(resolution, videoElement, stream, frameChecker,
		stats, statsTime) {
		this.analyzeStats_(resolution, videoElement, stream, frameChecker,
				stats, statsTime);

		frameChecker.stop();

	},

	analyzeStats_: function(resolution, videoElement, stream,
		frameChecker, stats, statsTime) {
		var googAvgEncodeTime = [];
		var googAvgFrameRateInput = [];
		var googAvgFrameRateSent = [];
		var statsReport = {};
		var frameStats = frameChecker.frameStats;

		for (var index in stats) {
			if (stats[index].type === 'ssrc') {
				// Make sure to only capture stats after the encoder is setup.
				if (parseInt(stats[index].googFrameRateInput) > 0) {
					googAvgEncodeTime.push(
							parseInt(stats[index].googAvgEncodeMs));
					googAvgFrameRateInput.push(
							parseInt(stats[index].googFrameRateInput));
					googAvgFrameRateSent.push(
							parseInt(stats[index].googFrameRateSent));
				}
			}
		}

		statsReport.cameraName = stream.getVideoTracks()[0].label || NaN;
		statsReport.actualVideoWidth = videoElement.videoWidth;
		statsReport.actualVideoHeight = videoElement.videoHeight;
		statsReport.encodeSetupTimeMs =
				this.extractEncoderSetupTime_(stats, statsTime);
		statsReport.avgEncodeTimeMs = arrayAverage(googAvgEncodeTime);
		statsReport.minEncodeTimeMs = arrayMin(googAvgEncodeTime);
		statsReport.maxEncodeTimeMs = arrayMax(googAvgEncodeTime);
		statsReport.avgInputFps = arrayAverage(googAvgFrameRateInput);
		statsReport.minInputFps = arrayMin(googAvgFrameRateInput);
		statsReport.maxInputFps = arrayMax(googAvgFrameRateInput);
		statsReport.avgSentFps = arrayAverage(googAvgFrameRateSent);
		statsReport.minSentFps = arrayMin(googAvgFrameRateSent);
		statsReport.maxSentFps = arrayMax(googAvgFrameRateSent);
		statsReport.is_muted = this.is_muted;
		statsReport.testedFrames = frameStats.numFrames;
		statsReport.blackFrames = frameStats.numBlackFrames;
		statsReport.frozenFrames = frameStats.numFrozenFrames;

		this.testExpectations_(statsReport);
	},

	endCall_: function(callObject, stream) {
		this.is_shutting_down = true;
		stream.getTracks().forEach(function(track) {
			track.stop();
		});
		callObject.close();
	},

	extractEncoderSetupTime_: function(stats, statsTime) {
		for (var index = 0; index !== stats.length; index++) {
			if (stats[index].type === 'ssrc') {
				if (parseInt(stats[index].googFrameRateInput) > 0) {
					return JSON.stringify(statsTime[index] - statsTime[0]);
				}
			}
		}
		return NaN;
	},

	resolutionMatchesIndependentOfRotationOrCrop_: function(aWidth, aHeight,
		bWidth, bHeight) {
		var minRes = Math.min(bWidth, bHeight);
		return (aWidth === bWidth && aHeight === bHeight) ||
					 (aWidth === bHeight && aHeight === bWidth) ||
					 (aWidth === minRes && bHeight === minRes);
	},

	testExpectations_: function(info) {
		var notAvailableStats = [];
		for (var key in info) {
			if (info.hasOwnProperty(key)) {
				if (typeof info[key] === 'number' && isNaN(info[key])) {
					notAvailableStats.push(key);
				} else {
					console.log(key + ': ' + info[key]);
				}
			}
		}
		if (notAvailableStats.length !== 0) {
			console.log('Not available: ' + notAvailableStats.join(', '));
		}

		var reason = ""
		if (info.testedFrames === 0) {
			reason = "Likely blocked or broken"
			console.log('Could not analyze any video frame.');
			this.fail(reason);
			return;
		} else {
			if (info.blackFrames > info.testedFrames / 3) {
				reason = "Delivering lots of black frames"
				console.log(reason);
				this.fail(reason)
				return;
			}
			if (info.frozenFrames > info.testedFrames / 3) {
				reason = "Delivering lots of frozen frames"
				console.log(reason);
				this.fail(reason);
				return;
			}
		}
		this.pass();
	}
};

function VideoFrameChecker(videoElement) {
	this.frameStats = {
		numFrozenFrames: 0,
		numBlackFrames: 0,
		numFrames: 0
	};

	this.running_ = true;

	this.nonBlackPixelLumaThreshold = 20;
	this.previousFrame_ = [];
	this.identicalFrameSsimThreshold = 0.985;
	this.frameComparator = new Ssim();

	this.canvas_ = document.createElement('canvas');
	this.videoElement_ = videoElement;
	this.listener_ = this.checkVideoFrame_.bind(this);
	this.videoElement_.addEventListener('play', this.listener_, false);
}

VideoFrameChecker.prototype = {
	stop: function() {
		this.videoElement_.removeEventListener('play' , this.listener_);
		this.running_ = false;
	},

	getCurrentImageData_: function() {
		this.canvas_.width = this.videoElement_.videoWidth;
		this.canvas_.height = this.videoElement_.videoHeight;

		var context = this.canvas_.getContext('2d');
		context.drawImage(this.videoElement_, 0, 0, this.canvas_.width,
				this.canvas_.height);
		return context.getImageData(0, 0, this.canvas_.width, this.canvas_.height);
	},

	checkVideoFrame_: function() {
		if (!this.running_) {
			return;
		}
		if (this.videoElement_.ended) {
			return;
		}

		var imageData = this.getCurrentImageData_();

		if (this.isBlackFrame_(imageData.data, imageData.data.length)) {
			this.frameStats.numBlackFrames++;
		}

		if (this.frameComparator.calculate(this.previousFrame_, imageData.data) >
				this.identicalFrameSsimThreshold) {
			this.frameStats.numFrozenFrames++;
		}
		this.previousFrame_ = imageData.data;

		this.frameStats.numFrames++;
		setTimeout(this.checkVideoFrame_.bind(this), 20);
	},

	isBlackFrame_: function(data, length) {
		// TODO: Use a statistical, histogram-based detection.
		var thresh = this.nonBlackPixelLumaThreshold;
		var accuLuma = 0;
		for (var i = 4; i < length; i += 4) {
			// Use Luma as in Rec. 709: Y′709 = 0.21R + 0.72G + 0.07B;
			accuLuma += 0.21 * data[i] + 0.72 * data[i + 1] + 0.07 * data[i + 2];
			// Early termination if the average Luma so far is bright enough.
			if (accuLuma > (thresh * i / 4)) {
				return false;
			}
		}
		return true;
	}
};
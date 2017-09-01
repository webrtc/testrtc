// Copyright (c) 2014, The WebRTC project authors. All rights reserved.Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

// Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

// Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

// Neither the name of Google nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// Check if user can record 2 seconds of audio

/* eslint-disable */ /* disable linting on upstream WebRTC code */

function MicTest(nextTestCallback){
		this.constraints = {
				audio: true
		};
		this.nextTestCallback = nextTestCallback
		this.bufferSize = 0;
		this.collectSeconds = 2.0;
		this.silentThreshold = 1.0 / 32767;
		this.collectedAudio = [];
		this.inputChannelCount = 2
		this.outputChannelCount = 1
		for (var i = 0; i < this.inputChannelCount; ++i) {
				this.collectedAudio[i] = [];
		}
		this.collectedAudioCount = 0;
		this.fail = function(failText){
			calls_errors_found = true;
			num_calls_errors+=1;
			micWarnings +=1;
			callsWarnings.push(["Microphone", failText]) //for later creation of warnings list
			removeTestingStyling("#microphone-header","#mic-check-icon-running");

			var list_item = $("#mic-test");
			list_item.addClass("fail_flag");
			$("#mic-test-result").prev("span").addClass("emphasis");
			$("#mic-test-result").text(failText);
			$("#mic-test-result").append(warning);

			$("#microphone-header").addClass("is_active");
			$("#microphone-header").children("h3:first").addClass("fail");
			addCautionToHeader($("#mic-check-icon-fail"), micWarnings)

			updateChildListItems(list_item.parent("ul"));
			addToFullText("Microphone", $("#mic-test-result"));
			this.nextTestCallback.call();
		}
		this.running = function(){
			// transition from waiting header to testing header
			setTestingHeader($("#microphone-header"),$("#mic-check-icon-waiting"), $("#mic-check-icon-running"));

			$("#mic-test-result").text("testing...");
			$("#mic-check-icon-running-text").html("Testing Microphone")
			// update 'running tests' indicator
			$("#calls-current-test").text("(1/" + totalTests + ") ...")
		}
		this.pass = function(){
			removeTestingStyling("#microphone-header","#mic-check-icon-running");

			var list_item = $("#mic-test")
			list_item.addClass("pass_flag");
			$("#mic-test-result").text("");
			$("#mic-test-result").append(checkmark);
			$("#microphone-header").children("h3:first").addClass("pass");
			$("#mic-check-icon-pass").removeClass("hidden");
			$("#mic-check-icon-pass").addClass("show");
			updateChildListItems(list_item.parent("ul"));
			this.nextTestCallback.call();
		}
}

MicTest.prototype = {
		run: function(){
			this.running();
			if (typeof AudioContext === 'undefined'){
				console.log("Web Audio isn't supported")
				this.fail();
			} else{
				navigator.getUserMedia(this.constraints, this.gotStream.bind(this), function(error){
					this.fail("Likely blocked in browser");
				}.bind(this))
			}
		},

		gotStream: function(stream) {
				if(stream.getAudioTracks() < 1){
						this.fail("Mic likely blocked in browser");
				} else{
						this.stream = stream
						this.createAudioBuffer()
				}
		},

		createAudioBuffer: function(){
				audioContext = new AudioContext()
				this.audioSource = audioContext.createMediaStreamSource(this.stream);
				this.scriptNode = audioContext.createScriptProcessor(this.bufferSize,
						this.inputChannelCount, this.outputChannelCount);
				this.audioSource.connect(this.scriptNode);
				this.scriptNode.connect(audioContext.destination);
				this.scriptNode.onaudioprocess = this.collectAudio.bind(this);
				this.audioContext = audioContext
				this.stopCollectingAudio = setTimeout(
						this.onStopCollectingAudio.bind(this), 5000);

		},

		// fired when script node process gets audio from audioSource defined above
		collectAudio: function(event) {
		// Simple silence detection: check first and last sample of each channel in
		// the buffer. If both are below a threshold, the buffer is considered
		// silent.
		var sampleCount = event.inputBuffer.length;
		var allSilent = true;
		for (var c = 0; c < event.inputBuffer.numberOfChannels; c++) {
			var data = event.inputBuffer.getChannelData(c);
			var first = Math.abs(data[0]);
			var last = Math.abs(data[sampleCount - 1]);
			var newBuffer;
			if (first > this.silentThreshold || last > this.silentThreshold) {
				// Non-silent buffers are copied for analysis. Note that the silent
				// detection will likely cause the stored stream to contain discontinu-
				// ities, but that is ok for our needs here (just looking at levels).
				newBuffer = new Float32Array(sampleCount);
				newBuffer.set(data);
				allSilent = false;
			} else {
				// Silent buffers are not copied, but we store empty buffers so that the
				// analysis doesn't have to care.
				newBuffer = new Float32Array();
			}
			this.collectedAudio[c].push(newBuffer);
		}
		if (!allSilent) {
			this.collectedSampleCount += sampleCount;
			if ((this.collectedSampleCount / event.inputBuffer.sampleRate) >=
					this.collectSeconds) {
				this.stopCollectingAudio();
			}
		}
	},

	onStopCollectingAudio: function() {
		this.stream.getAudioTracks()[0].stop();
		this.audioSource.disconnect(this.scriptNode);
		this.scriptNode.disconnect(this.audioContext.destination);
		// analyze data
		this.analyzeAudio(this.collectedAudio)
	},

	analyzeAudio: function(channels) {
		var activeChannels = [];
		for (var c = 0; c < channels.length; c++) {
			if (this.channelStats(c, channels[c])) {
				activeChannels.push(c);
			}
		}
		if (activeChannels.length === 0) {
			console.log('No active input channels detected. Microphone ' +
						'is most likely muted or broken, please check if muted in the ' +
						'sound settings or physically on the device. Then rerun the test.');
			this.fail("Likely muted or broken.")
		}
		this.pass()
	},

	channelStats: function(channelNumber, buffers) {
		var maxPeak = 0.0;
		var maxRms = 0.0;
		var clipCount = 0;
		var maxClipCount = 0;
		for (var j = 0; j < buffers.length; j++) {
			var samples = buffers[j];
			if (samples.length > 0) {
				var s = 0;
				var rms = 0.0;
				for (var i = 0; i < samples.length; i++) {
					s = Math.abs(samples[i]);
					maxPeak = Math.max(maxPeak, s);
					rms += s * s;
					if (maxPeak >= this.clipThreshold) {
						clipCount++;
						maxClipCount = Math.max(maxClipCount, clipCount);
					} else {
						clipCount = 0;
					}
				}
				// RMS is calculated over each buffer, meaning the integration time will
				// be different depending on sample rate and buffer size. In practise
				// this should be a small problem.
				rms = Math.sqrt(rms / samples.length);
				maxRms = Math.max(maxRms, rms);
			}
		}

		if (maxPeak > this.silentThreshold) {
			return true;
		}
		return false;
	}

}

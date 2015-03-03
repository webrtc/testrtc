/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

addTest('Microphone', 'Audio capture', function() {
  var test = new MicTest();
  test.run();
});

function MicTest() {
  this.inputChannels = 6;
  this.outputChannels = 2;
  // Buffer size set to 0 to let Chrome choose based on the platform.
  this.bufferSize = 0;
  // Turning off echoCancellation constraint enables stereo input.
  this.constraints = {
    audio: {
      optional: [
        {echoCancellation: false}
      ]
    }
  };

  this.inputSamples = [];
  this.inputSampleCount = 0;
  for (var i = 0; i < this.inputChannels; ++i) {
    this.inputSamples[i] = [];
  }

  this.collectSeconds = 2.0;
  this.silentThreshold = 1.0 / 32767;
  this.clipThreshold = 1.0 - 1.0 / 32767;
  this.lowVolumeThreshold = -60;
  this.monoDetectThreshold = 1.0 / 65535;
  this.clipCountThreshold = 4;
}

MicTest.prototype = {
  run: function() {
    if (typeof audioContext === 'undefined') {
      reportError('WebAudio is not supported, test cannot run.');
      testFinished();
    } else {
      doGetUserMedia(this.constraints, this.gotStream.bind(this));
    }
  },

  gotStream: function(stream) {
    if (!this.checkAudioTracks(stream)) {
      testFinished();
      return;
    }
    this.createAudioBuffer(stream);
  },

  checkAudioTracks: function(stream) {
    this.stream = stream;
    var audioTracks = stream.getAudioTracks();
    if (audioTracks.length < 1) {
      reportError('No audio track in returned stream.');
      return false;
    }
    reportSuccess('Audio track created using device=' + audioTracks[0].label);
    return true;
  },

  createAudioBuffer: function() {
    this.audioSource = audioContext.createMediaStreamSource(this.stream);
    this.scriptNode = audioContext.createScriptProcessor(this.bufferSize,
        this.inputChannels, this.outputChannels);
    this.audioSource.connect(this.scriptNode);
    this.scriptNode.connect(audioContext.destination);
    this.scriptNode.onaudioprocess = this.collectAudio.bind(this);
    this.stopCollectingAudio = setTimeoutWithProgressBar(
        this.onStopCollectingAudio.bind(this), 5000);
  },

  collectAudio: function(event) {
    // Simple silent detection: check first and last sample of each channel in
    // the buffer. If all are below a threshold, the buffer is considered
    // silent. Non-silent buffers are stored for analysis. Note that the silent
    // detection will likely cause the stored stream to contain discontinuities,
    // but that is ok for our needs here (just looking at levels).
    var channelCount = event.inputBuffer.numberOfChannels;
    var sampleCount = event.inputBuffer.length;
    var sampleData = [];
    var isSilent = true;
    var c = 0;
    for (c = 0; c < channelCount; ++c) {
      sampleData[c] = event.inputBuffer.getChannelData(c);
      var first = Math.abs(sampleData[c][0]);
      var last = Math.abs(sampleData[c][sampleCount - 1]);
      if (first > this.silentThreshold || last > this.silentThreshold) {
        isSilent = false;
      }
    }
    if (!isSilent) {
      for (c = 0; c < channelCount; ++c) {
        this.inputSamples[c].push(sampleData[c]);
      }
      this.inputSampleCount += sampleCount;
      var inputSeconds = this.inputSampleCount / event.inputBuffer.sampleRate;
      if (inputSeconds >= this.collectSeconds) {
        this.stopCollectingAudio();
      }
    }
  },

  onStopCollectingAudio: function() {
    this.stream.getAudioTracks()[0].stop();
    this.audioSource.disconnect(this.scriptNode);
    this.scriptNode.disconnect(audioContext.destination);
    this.analyzeAudio(this.inputSamples);
    testFinished();
  },

  analyzeAudio: function(inputSamples) {
    var activeChannels = [];

    // Iterate over all channels and buffers, collect stats.
    for (var channel = 0; channel < inputSamples.length; ++channel) {
      var maxPeak = 0.0;
      var maxRms = 0.0;
      var clipCount = 0;
      var maxClipCount = 0;
      for (var j = 0; j < inputSamples[channel].length; ++j) {
        var rms = 0.0;
        var samples = inputSamples[channel][j];
        var s = 0;
        for (var i = 0; i < samples.length; ++i) {
          s = Math.abs(samples[i]);
          maxPeak = Math.max(maxPeak, s);
          rms += s * s;
          if (maxPeak > this.clipThreshold) {
            clipCount++;
            maxClipCount = Math.max(maxClipCount, clipCount);
          } else {
            clipCount = 0;
          }
        }
        rms = Math.sqrt(rms / samples.length);
        maxRms = Math.max(maxRms, rms);
      }

      if (maxPeak > this.silentThreshold) {
        activeChannels.push(channel);
        var dBPeak = this.dBFS(maxPeak);
        var dBRms = this.dBFS(maxRms);
        reportInfo('Channel ' + channel + ' levels: ' +
                   dBPeak.toFixed(2) + ' dB (peak), ' +
                   dBRms.toFixed(2) + ' dB (RMS)');
        if (dBRms < this.lowVolumeThreshold) {
          reportError('Microphone input level is low, increase input ' +
                      'volume or move closer to the microphone.');
        }
        if (maxClipCount > this.clipCountThreshold) {
          reportError('Clipping detected! Microphone input level is high. ' +
                      'Decrease input volume or move away from the ' +
                      'microphone.');
        }
      }
    }

    // Validate the result.
    if (activeChannels.length === 0) {
      reportError('No active input channels detected. Microphone is most ' +
                  'likely muted or broken, please check if muted in the ' +
                  'sound settings or physically on the device. Then rerun ' +
                  'the test.');
    } else {
      reportSuccess('Active audio input channels: ' + activeChannels.length);
    }

    // If two channel input, compare samples to determine if it is a mono
    // microphone.
    if (activeChannels.length === 2) {
      var diffSamples = 0;
      for (var j = 0; j < inputSamples[activeChannels[0]].length; ++j) {
        var l = inputSamples[activeChannels[0]][j];
        var r = inputSamples[activeChannels[1]][j];
        var d = 0.0;
        for (var i = 0; i < l.length; ++i) {
          d = Math.abs(l[i] - r[i]);
          if (d > this.monoDetectThreshold) {
            diffSamples++;
          }
        }
      }
      if (diffSamples > 0) {
        reportInfo('Stereo microphone detected.');
      } else {
        reportInfo('Mono microphone detected.');
      }
    }
  },

  dBFS: function(gain) {
    var dB = 20 * Math.log(gain) / Math.log(10);
    // Use Math.round to display up to one decimal place.
    return Math.round(dB * 10) / 10;
  },
};

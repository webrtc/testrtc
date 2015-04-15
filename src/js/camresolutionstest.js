/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

/*
 * In generic cameras using Chrome rescaler, all resolutions should be supported
 * up to a given one and none beyond there. Special cameras, such as digitizers,
 * might support only one resolution.
 */

// Each resolution has width, height and 'mandatory' fields.
var resolutions = [[160, 120, false],
                   [320, 180, false],
                   [320, 240, true],
                   [640, 360, false],
                   [640, 480, true],
                   [768, 576, false],  // PAL
                   [1024, 576, false],
                   [1280, 720, true],
                   [1280, 768, false],
                   [1280, 800, false],
                   [1920, 1080, false],  // Full HD
                   [1920, 1200, false],
                   [3840, 2160, false],  // 4K
                   [4096, 2160, false]];

/*
 * "Analyze performance for "resolution"" test uses getStats, canvas and the
 * video element to analyze the video frames from a capture device. It will
 * report number of black frames, frozen frames, tested frames and various stats
 * like average encode time and FPS. A test case will be created per mandatory
 * resolution found in the "resolutions" array.
 */
for (var index = 0; index < resolutions.length; index++) {
  if (resolutions[index][2]) {
    var testTitle = 'Check ' + resolutions[index][0] + 'x' +
                    resolutions[index][1] + ' resolution';
    addTest('Camera', testTitle, testCamera_.bind(null, [resolutions[index]]));
  }
}

/*
 * "Supported resolutions" test tries calling getUserMedia() with each
 * resolution from the list below. Each gUM() call triggers a success or a fail
 * callback; we report ok/nok and schedule another gUM() with the next
 * resolution until the list is exhausted. Some resolutions are mandatory and
 * make the test fail if not supported.
 */
addTest('Camera', 'Check supported resolutions', testCamera_.bind(null,
        resolutions));

function testCamera_(resolutions) {
  var test = new CamResolutionsTest(resolutions);
  test.run();
}

function CamResolutionsTest(resolutionArray) {
  this.resolutions = resolutionArray;
  this.mandatoryUnsupportedResolutions = 0;
  this.numResolutions = this.resolutions.length;
  this.counter = 0;
  this.supportedResolutions = 0;
  this.unsupportedResolutions = 0;
  this.currentResolutionForCheckEncodeTime = null;

  this.isMuted = false;
  this.stream = null;
}

function resolutionMatchesIndependentOfRotationOrCrop_(aWidth, aHeight,
                                                       bWidth, bHeight) {
  var minRes = Math.min(bWidth, bHeight);
  return (aWidth === bWidth && aHeight === bHeight) ||
         (aWidth === bHeight && aHeight === bWidth) ||
         (aWidth === minRes && bHeight === minRes);
}

CamResolutionsTest.prototype = {
  run: function() { this.triggerGetUserMedia_(this.resolutions[0]); },

  triggerGetUserMedia_: function(resolution) {
    var constraints = {
      audio: false,
      video: {
        mandatory: {
          minWidth:  resolution[0],
          minHeight: resolution[1],
          maxWidth:  resolution[0],
          maxHeight: resolution[1]
        }
      }
    };
    try {
      doGetUserMedia(constraints, this.successFunc_.bind(this),
          this.failFunc_.bind(this));
    } catch (e) {
      reportFatal('GetUserMedia failed.');
    }
  },

  successFunc_: function(stream) {
    this.stream = stream;
    this.supportedResolutions++;
    var selectedResolution = this.resolutions[this.counter++];
    // Measure performance only when testing one resolution.
    if (selectedResolution[2] && this.numResolutions === 1) {
      this.collectAndAnalyzeStats_(stream, selectedResolution);
    } else {
      reportInfo('Supported ' + selectedResolution[0] + 'x' +
                 selectedResolution[1]);
      stream.getVideoTracks()[0].stop();
      this.finishTestOrRetrigger_();
    }
  },

  collectAndAnalyzeStats_: function(stream, selectedResolution) {
    var tracks = stream.getVideoTracks();
    if (tracks.length < 1) {
      reportError('No video track in returned stream.');
      this.finishTestOrRetrigger_();
      return;
    }

    var videoTrack = tracks[0];
    reportInfo('Camera label: ' + videoTrack.label);
    // Register events.
    videoTrack.onended = function() {
      reportError('Video track ended, camera stopped working');
    };
    videoTrack.onmute = function() {
      reportError('Your camera reported itself as muted.');
      // MediaStreamTrack.muted property is not wired up in Chrome yet, checking
      // isMuted local state.
      this.isMuted = true;
    };
    videoTrack.onunmute = function() {
      this.isMuted = false;
    };

    var video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    window.videoElement = video;
    window.stream = stream;
    video.width = selectedResolution[0];
    video.height = selectedResolution[1];
    attachMediaStream(video, stream);
    var frameChecker = new VideoFrameChecker(video);
    var call = new Call();
    call.pc1.addStream(stream);
    call.establishConnection();
    call.gatherStats(call.pc1,
                     this.onCallEnded_.bind(this, selectedResolution, video,
                                            this.stream, frameChecker),
                     100);

    setTimeoutWithProgressBar(call.close.bind(call), 8000);
  },

  onCallEnded_: function(selectedResolution, videoElement, stream, frameChecker,
                         stats, statsTime) {
    this.analyzeStats_(selectedResolution, videoElement, stream, frameChecker,
                       stats, statsTime);

    this.stream.getVideoTracks()[0].onended = null;
    this.stream.getVideoTracks()[0].onmute = null;
    this.stream.getVideoTracks()[0].onunmute = null;
    this.stream.getVideoTracks()[0].stop();

    frameChecker.stop();

    this.finishTestOrRetrigger_();
  },

  analyzeStats_: function(selectedResolution, videoElement, stream,
                          frameChecker, stats, statsTime) {
    var googAvgEncodeTime = [];
    var googAvgFrameRateInput = [];
    var googAvgFrameRateSent = [];
    var statsReport = {};
    var frameStats = frameChecker.frameStats;

    for (var index = 0; index < stats.length - 1; index++) {
      if (stats[index].type === 'ssrc') {
        // Make sure to only capture stats after the encoder is setup.
        if (stats[index].stat('googFrameRateInput') > 0) {
          googAvgEncodeTime.push(
              parseInt(stats[index].stat('googAvgEncodeMs')));
          googAvgFrameRateInput.push(
              parseInt(stats[index].stat('googFrameRateInput')));
          googAvgFrameRateSent.push(
              parseInt(stats[index].stat('googFrameRateSent')));
        }
      }
    }

    if (googAvgEncodeTime.length === 0) {
      reportError('No stats collected. Check your camera.');
    } else {
      // TODO: Add a reportInfo() function with a table format to display
      // values clearer.
      statsReport.actualVideoWidth = videoElement.videoWidth;
      statsReport.actualVideoHeight = videoElement.videoHeight;
      statsReport.mandatoryWidth = selectedResolution[0];
      statsReport.mandatoryHeight = selectedResolution[1];
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
      statsReport.isMuted = this.isMuted;
      statsReport.readyState = stream.getVideoTracks()[0].readyState;
      statsReport.testedFrames = frameStats.numFrames;
      statsReport.blackFrames = frameStats.numBlackFrames;
      statsReport.frozenFrames = frameStats.numFrozenFrames;

      this.testExpectations_(statsReport);
    }
    report.traceEventInstant('video-stats', statsReport);
  },

  extractEncoderSetupTime_: function(stats, statsTime) {
    for (var index = 0; index !== stats.length; index++) {
      if (stats[index].type === 'ssrc') {
        if (stats[index].stat('googFrameRateInput') > 0) {
          return JSON.stringify(statsTime[index] - statsTime[0]);
        }
      }
    }
    return null;
  },

  testExpectations_: function(info) {
    for (var key in info) {
      if (info.hasOwnProperty(key)) {
        reportInfo(key + ': ' + info[key]);
      }
    }

    if (info.avgSentFps < 5) {
      reportError('Low average sent FPS: ' + info.avgSentFps);
    } else {
      reportSuccess('Average FPS above threshold');
    }
    if (!resolutionMatchesIndependentOfRotationOrCrop_(info.actualVideoWidth,
                                                       info.actualVideoHeight,
                                                       info.mandatoryWidth,
                                                       info.mandatoryHeight)) {
      reportError('Incorrect captured resolution.');
    } else {
      reportSuccess('Captured video using expected resolution.');
    }
    if (info.testedFrames === 0) {
      reportError('Could not analyze any video frame.');
    } else {
      if (info.blackFrames > info.testedFrames / 3) {
        reportError('Camera delivering lots of black frames.');
      }
      if (info.frozenFrames > info.testedFrames / 3) {
        reportError('Camera delivering lots of frozen frames.');
      }
    }
  },

  failFunc_: function() {
    this.unsupportedResolutions++;
    var selectedResolution = this.resolutions[this.counter++];
    if (selectedResolution[2]) {
      this.mandatoryUnsupportedResolutions++;
      reportError('Camera does not support a mandatory resolution: ' +
                  selectedResolution[0] + 'x' + selectedResolution[1]);
    } else {
      reportInfo('NOT supported ' + selectedResolution[0] + 'x' +
                 selectedResolution[1]);
    }
    this.finishTestOrRetrigger_();
  },

  finishTestOrRetrigger_: function() {
    if (this.counter === this.numResolutions) {
      if (this.mandatoryUnsupportedResolutions === 0) {
        if (this.supportedResolutions) {
          // Assume analyze video performance path if only one resolution.
          if (this.numResolutions > 1) {
            reportSuccess(this.supportedResolutions + '/' +
                          this.numResolutions + ' resolutions supported.');
          }
        } else {
          reportError('No camera resolutions supported, most likely the ' +
                      'camera is not accessible or dead.');
        }
      }
      testFinished();
    } else {
      this.triggerGetUserMedia_(this.resolutions[this.counter]);
    }
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
    this.videoElement_.removeEventListener(this.listener_);
  },

  getCurrentImageData_: function() {
    this.canvas_.width = this.videoElement_.width;
    this.canvas_.height = this.videoElement_.height;

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
      accuLuma += 0.21 * data[i] +  0.72 * data[i + 1] + 0.07 * data[i + 2];
      // Early termination if the average Luma so far is bright enough.
      if (accuLuma > (thresh * i / 4)) {
        return false;
      }
    }
    return true;
  }
};

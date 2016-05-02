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

/*
 * "Analyze performance for "resolution"" test uses getStats, canvas and the
 * video element to analyze the video frames from a capture device. It will
 * report number of black frames, frozen frames, tested frames and various stats
 * like average encode time and FPS. A test case will be created per mandatory
 * resolution found in the "resolutions" array.
 */

addTest(testSuiteName.CAMERA, testCaseName.CHECKRESOLUTION240, function(test) {
  var camResolutionsTest = new CamResolutionsTest(test , [[320, 240]]);
  camResolutionsTest.run();
});

addTest(testSuiteName.CAMERA, testCaseName.CHECKRESOLUTION480, function(test) {
  var camResolutionsTest = new CamResolutionsTest(test, [[640, 480]]);
  camResolutionsTest.run();
});

addTest(testSuiteName.CAMERA, testCaseName.CHECKRESOLUTION720, function(test) {
  var camResolutionsTest = new CamResolutionsTest(test, [[1280, 720]]);
  camResolutionsTest.run();
});

addTest(
  testSuiteName.CAMERA, testCaseName.CHECKSUPPORTEDRESOLUTIONS, function(test) {
  var resolutionArray = [
    [160, 120], [320, 180], [320, 240], [640, 360], [640, 480], [768, 576],
    [1024, 576], [1280, 720], [1280, 768], [1280, 800], [1920, 1080],
    [1920, 1200], [3840, 2160], [4096, 2160]
  ];
  var camResolutionsTest = new CamResolutionsTest(test, resolutionArray);
  camResolutionsTest.run();
});

function CamResolutionsTest(test, resolutions) {
  this.test = test;
  this.resolutions = resolutions;
  this.currentResolution = 0;
  this.isMuted = false;
  this.isShuttingDown = false;
}

CamResolutionsTest.prototype = {
  run: function() {
    this.startGetUserMedia(this.resolutions[this.currentResolution]);
  },

  startGetUserMedia: function(resolution) {
    var constraints = {
      audio: false,
      video: {width: {exact: resolution[0]},
          height: {exact: resolution[1]}}
    };
    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      // Do not check actual video frames when more than one resolution is
      // provided.
      if (this.resolutions.length > 1) {
        this.test.reportSuccess('Supported: ' + resolution[0] + 'x' +
            resolution[1]);
        stream.getTracks().forEach(function(track) {track.stop();});
        this.maybeContinueGetUserMedia();
      } else {
        this.collectAndAnalyzeStats_(stream, resolution);
      }
    }.bind(this))
    .catch(function(error) {
      if (this.resolutions.length > 1) {
        this.test.reportInfo(resolution[0] + 'x' + resolution[1] +
            ' not supported');
      } else {
        this.test.reportError('getUserMedia failed with error: ' + error.name);
      }
      this.maybeContinueGetUserMedia();
    }.bind(this));
  },

  maybeContinueGetUserMedia: function() {
    if (this.currentResolution === this.resolutions.length) {
      this.test.done();
      return;
    }
    this.startGetUserMedia(this.resolutions[this.currentResolution++]);
  },

  collectAndAnalyzeStats_: function(stream, resolution) {
    var tracks = stream.getVideoTracks();
    if (tracks.length < 1) {
      this.test.reportError('No video track in returned stream.');
      this.maybeContinueGetUserMedia();
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
        if (this.isShuttingDown) {
          return;
        }
        this.test.reportError('Video track ended, camera stopped working');
      }.bind(this));
      videoTrack.addEventListener('mute', function() {
        // Ignore events when shutting down the test.
        if (this.isShuttingDown) {
          return;
        }
        this.test.reportWarning('Your camera reported itself as muted.');
        // MediaStreamTrack.muted property is not wired up in Chrome yet,
        // checking isMuted local state.
        this.isMuted = true;
      }.bind(this));
      videoTrack.addEventListener('unmute', function() {
        // Ignore events when shutting down the test.
        if (this.isShuttingDown) {
          return;
        }
        this.test.reportInfo('Your camera reported itself as unmuted.');
        this.isMuted = false;
      }.bind(this));
    }

    var video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.width = resolution[0];
    video.height = resolution[1];
    video.srcObject = stream;
    var frameChecker = new VideoFrameChecker(video);
    var call = new Call(null, this.test);
    call.pc1.addStream(stream);
    call.establishConnection();
    call.gatherStats(call.pc1, stream,
                     this.onCallEnded_.bind(this, resolution, video,
                                            stream, frameChecker),
                     100);

    setTimeoutWithProgressBar(this.endCall_.bind(this, call, stream), 8000);
  },

  onCallEnded_: function(resolution, videoElement, stream, frameChecker,
                         stats, statsTime) {
    this.analyzeStats_(resolution, videoElement, stream, frameChecker,
                       stats, statsTime);

    frameChecker.stop();

    this.test.done();
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
    statsReport.mandatoryWidth = resolution[0];
    statsReport.mandatoryHeight = resolution[1];
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
    statsReport.testedFrames = frameStats.numFrames;
    statsReport.blackFrames = frameStats.numBlackFrames;
    statsReport.frozenFrames = frameStats.numFrozenFrames;

    // TODO: Add a reportInfo() function with a table format to display
    // values clearer.
    report.traceEventInstant('video-stats', statsReport);

    this.testExpectations_(statsReport);
  },

  endCall_: function(callObject, stream) {
    this.isShuttingDown = true;
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
          this.test.reportInfo(key + ': ' + info[key]);
        }
      }
    }
    if (notAvailableStats.length !== 0) {
      this.test.reportInfo('Not available: ' + notAvailableStats.join(', '));
    }

    if (isNaN(info.avgSentFps)) {
      this.test.reportInfo('Cannot verify sent FPS.');
    } else if (info.avgSentFps < 5) {
      this.test.reportError('Low average sent FPS: ' + info.avgSentFps);
    } else {
      this.test.reportSuccess('Average FPS above threshold');
    }
    if (!this.resolutionMatchesIndependentOfRotationOrCrop_(
        info.actualVideoWidth, info.actualVideoHeight, info.mandatoryWidth,
        info.mandatoryHeight)) {
      this.test.reportError('Incorrect captured resolution.');
    } else {
      this.test.reportSuccess('Captured video using expected resolution.');
    }
    if (info.testedFrames === 0) {
      this.test.reportError('Could not analyze any video frame.');
    } else {
      if (info.blackFrames > info.testedFrames / 3) {
        this.test.reportError('Camera delivering lots of black frames.');
      }
      if (info.frozenFrames > info.testedFrames / 3) {
        this.test.reportError('Camera delivering lots of frozen frames.');
      }
    }
  }
};

//TODO: Move this to a separate file.
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

/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

// Creates a loopback via relay candidates and tries to send as many packets
// with 1024 chars as possible while keeping dataChannel bufferedAmmount above
// zero.
addTest(testSuiteName.THROUGHPUT, testCaseName.DATATHROUGHPUT, function(test) {
  var dataChannelThroughputTest = new DataChannelThroughputTest(test);
  dataChannelThroughputTest.run();
});

function DataChannelThroughputTest(test) {
  this.test = test;
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
}

DataChannelThroughputTest.prototype = {
  run: function() {
    Call.asyncCreateTurnConfig(this.start.bind(this),
        this.test.reportFatal.bind(this.test));
  },

  start: function(config) {
    this.call = new Call(config, this.test);
    this.call.setIceCandidateFilter(Call.isRelay);
    this.senderChannel = this.call.pc1.createDataChannel(null);
    this.senderChannel.addEventListener('open', this.sendingStep.bind(this));

    // this.call.pc2.addEventListener('datachannel',
    //     this.onReceiverChannel.bind(this));

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
      this.test.setProgress(100);
      this.stopSending = true;
    } else {
      this.test.setProgress((now - this.startTime) /
          (10 * this.testDurationSeconds));
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
      this.test.reportSuccess('Transmitting at ' + bitrate + ' kbps.');
      this.lastReceivedPayloadBytes = this.receivedPayloadBytes;
      this.lastBitrateMeasureTime = now;
    }
    if (this.stopSending &&
        this.sentPayloadBytes === this.receivedPayloadBytes) {
      this.call.close();
      this.call = null;

      var elapsedTime = Math.round((now - this.startTime) * 10) / 10000.0;
      var receivedKBits = this.receivedPayloadBytes * 8 / 1000;
      this.test.reportSuccess('Total transmitted: ' + receivedKBits +
          ' kilo-bits in ' + elapsedTime + ' seconds.');
      this.test.done();
    }
  }
};

// Measures video bandwidth estimation performance by doing a loopback call via
// relay candidates for 40 seconds. Computes rtt and bandwidth estimation
// average and maximum as well as time to ramp up (defined as reaching 75% of
// the max bitrate. It reports infinite time to ramp up if never reaches it.
addTest(testSuiteName.THROUGHPUT, testCaseName.VIDEOBANDWIDTH, function(test) {
  var videoBandwidthTest = new VideoBandwidthTest(test);
  videoBandwidthTest.run();
});

function VideoBandwidthTest(test) {
  this.test = test;
  this.maxVideoBitrateKbps = 2000;
  this.durationMs = 40000;
  this.statStepMs = 100;
  this.bweStats = new StatisticsAggregate(0.75 * this.maxVideoBitrateKbps *
      1000);
  this.rttStats = new StatisticsAggregate();
  this.packetsLost = -1;
  this.nackCount = -1;
  this.pliCount = -1;
  this.qpSum = -1;
  this.packetsSent = -1;
  this.packetsReceived = -1;
  this.framesEncoded = -1;
  this.framesDecoded = -1;
  this.framesSent = -1;
  this.bytesSent = -1;
  this.videoStats = [];
  this.startTime = null;
  this.call = null;
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
}

VideoBandwidthTest.prototype = {
  run: function() {
    Call.asyncCreateTurnConfig(this.start.bind(this),
        this.test.reportFatal.bind(this.test));
  },

  start: function(config) {
    this.call = new Call(config, this.test);
    this.call.setIceCandidateFilter(Call.isRelay);
    // FEC makes it hard to study bandwidth estimation since there seems to be
    // a spike when it is enabled and disabled. Disable it for now. FEC issue
    // tracked on: https://code.google.com/p/webrtc/issues/detail?id=3050
    this.call.disableVideoFec();
    this.call.constrainVideoBitrate(this.maxVideoBitrateKbps);
    doGetUserMedia(this.constraints, this.gotStream.bind(this));
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
      this.test.setProgress(100);
      this.hangup();
      return;
    } else if (!this.call.statsGatheringRunning) {
      this.call.gatherStats(this.call.pc1, null, this.localStream,
          this.gotStats.bind(this));
    }
    this.test.setProgress((now - this.startTime) * 100 / this.durationMs);
    setTimeout(this.gatherStats.bind(this), this.statStepMs);
  },

  gotStats: function(response, time, response2, time2) {
    // TODO: Remove browser specific stats gathering hack once adapter.js or
    // browsers converge on a standard.
    if (adapter.browserDetails.browser === 'chrome') {
      for (var i in response) {
        if (typeof response[i].connection !== 'undefined') {
          this.bweStats.add(response[i].connection.timestamp,
              parseInt(response[i].connection.availableOutgoingBitrate));
          this.rttStats.add(response[i].connection.timestamp,
              parseInt(response[i].connection.currentRoundTripTime * 1000));
          // Grab the last stats.
          this.videoStats[0] = response[i].video.local.frameWidth;
          this.videoStats[1] = response[i].video.local.frameHeight;
          this.nackCount = response[i].video.local.nackCount;
          this.packetsLost = response2[i].video.remote.packetsLost;
          this.qpSum = response2[i].video.remote.qpSum;
          this.pliCount = response[i].video.local.pliCount;
          this.packetsSent = response[i].video.local.packetsSent;
          this.packetsReceived = response2[i].video.remote.packetsReceived;
          this.framesEncoded = response[i].video.local.framesEncoded;
          this.framesDecoded = response2[i].video.remote.framesDecoded;
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
      this.test.reportError('Only Firefox and Chrome getStats implementations' +
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
        this.test.reportError('Camera failure: ' + this.videoStats[0] + 'x' +
            this.videoStats[1] + '. Cannot test bandwidth without a working ' +
            ' camera.');
      } else {
        this.test.reportSuccess('Video resolution: ' + this.videoStats[0] +
            'x' + this.videoStats[1]);
        this.test.reportInfo('Send bandwidth estimate average: ' +
            Math.round(this.bweStats.getAverage() / 1000) + ' kbps');
        this.test.reportInfo('Send bandwidth estimate max: ' +
            this.bweStats.getMax() / 1000 + ' kbps');
        this.test.reportInfo('Send bandwidth ramp-up time: ' +
            this.bweStats.getRampUpTime() + ' ms');
        this.test.reportInfo('Packets sent: ' + this.packetsSent);
        this.test.reportInfo('Packets received: ' + this.packetsReceived);
        this.test.reportInfo('NACK count: ' + this.nackCount);
        this.test.reportInfo('Picture loss indications: ' + this.pliCount);
        this.test.reportInfo('Quality predictor sum: ' + this.qpSum);
        this.test.reportInfo('Frames encoded: ' + this.framesEncoded);
        this.test.reportInfo('Frames decoded: ' + this.framesDecoded);
      }
    } else if (adapter.browserDetails.browser === 'firefox') {
      if (parseInt(this.framerateMean) > 0) {
        this.test.reportSuccess('Frame rate mean: ' +
            parseInt(this.framerateMean));
      } else {
        this.test.reportError('Frame rate mean is 0, cannot test bandwidth ' +
            'without a working camera.');
      }
      this.test.reportInfo('Send bitrate mean: ' +
          parseInt(this.bitrateMean) / 1000 + ' kbps');
      this.test.reportInfo('Send bitrate standard deviation: ' +
          parseInt(this.bitrateStdDev) / 1000 + ' kbps');
    }
    this.test.reportInfo('RTT average: ' + this.rttStats.getAverage() +
            ' ms');
    this.test.reportInfo('RTT max: ' + this.rttStats.getMax() + ' ms');
    this.test.reportInfo('Packets lost: ' + this.packetsLost);
    this.test.done();
  }
};

addExplicitTest(testSuiteName.THROUGHPUT, testCaseName.NETWORKLATENCY,
    function(test) {
      var wiFiPeriodicScanTest = new WiFiPeriodicScanTest(test,
          Call.isNotHostCandidate);
      wiFiPeriodicScanTest.run();
    });

addExplicitTest(testSuiteName.THROUGHPUT, testCaseName.NETWORKLATENCYRELAY,
    function(test) {
      var wiFiPeriodicScanTest = new WiFiPeriodicScanTest(test, Call.isRelay);
      wiFiPeriodicScanTest.run();
    });

function WiFiPeriodicScanTest(test, candidateFilter) {
  this.test = test;
  this.candidateFilter = candidateFilter;
  this.testDurationMs = 5 * 60 * 1000;
  this.sendIntervalMs = 100;
  this.delays = [];
  this.recvTimeStamps = [];
  this.running = false;
  this.call = null;
  this.senderChannel = null;
  this.receiveChannel = null;
}

WiFiPeriodicScanTest.prototype = {
  run: function() {
    Call.asyncCreateTurnConfig(this.start.bind(this),
        this.test.reportFatal.bind(this.test));
  },

  start: function(config) {
    this.running = true;
    this.call = new Call(config, this.test);
    this.chart = this.test.createLineChart();
    this.call.setIceCandidateFilter(this.candidateFilter);

    this.senderChannel = this.call.pc1.createDataChannel({ordered: false,
      maxRetransmits: 0});
    this.senderChannel.addEventListener('open', this.send.bind(this));
    // this.call.pc2.addEventListener('datachannel',
    //     this.onReceiverChannel.bind(this));
    this.call.establishConnection();

    setTimeoutWithProgressBar(this.finishTest.bind(this),
        this.testDurationMs);
  },

  onReceiverChannel: function(event) {
    this.receiveChannel = event.channel;
    this.receiveChannel.addEventListener('message', this.receive.bind(this));
  },

  send: function() {
    if (!this.running) {
      return;
    }
    this.senderChannel.send('' + Date.now());
    setTimeout(this.send.bind(this), this.sendIntervalMs);
  },

  receive: function(event) {
    if (!this.running) {
      return;
    }
    var sendTime = parseInt(event.data);
    var delay = Date.now() - sendTime;
    this.recvTimeStamps.push(sendTime);
    this.delays.push(delay);
    this.chart.addDatapoint(sendTime + delay, delay);
  },

  finishTest: function() {
    report.traceEventInstant('periodic-delay', {delays: this.delays,
      recvTimeStamps: this.recvTimeStamps});
    this.running = false;
    this.call.close();
    this.call = null;
    this.chart.parentElement.removeChild(this.chart);

    var avg = arrayAverage(this.delays);
    var max = arrayMax(this.delays);
    var min = arrayMin(this.delays);
    this.test.reportInfo('Average delay: ' + avg + ' ms.');
    this.test.reportInfo('Min delay: ' + min + ' ms.');
    this.test.reportInfo('Max delay: ' + max + ' ms.');

    if (this.delays.length < 0.8 * this.testDurationMs / this.sendIntervalMs) {
      this.test.reportError('Not enough samples gathered. Keep the page on ' +
          ' the foreground while the test is running.');
    } else {
      this.test.reportSuccess('Collected ' + this.delays.length +
          ' delay samples.');
    }

    if (max > (min + 100) * 2) {
      this.test.reportError('There is a big difference between the min and ' +
          'max delay of packets. Your network appears unstable.');
    }
    this.test.done();
  }
};

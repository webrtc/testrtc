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
    var start = function(config) {
      this.call = new Call(config);
      this.call.setIceCandidateFilter(Call.isRelay);
      this.senderChannel = this.call.pc1.createDataChannel(null);
      this.senderChannel.addEventListener('open', this.sendingStep.bind(this));

      this.call.pc2.addEventListener('datachannel',
          this.onReceiverChannel.bind(this));

      this.call.establishConnection();
    }.bind(this);

    Call.asyncCreateTurnConfig(start, this.test.reportFatal.bind(this.test));
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
  this.packetsLost = null;
  this.videoStats = [];
  this.startTime = null;
  // Open the camera in 720p to get a correct measurement of ramp-up time.
  this.constraints = {
    audio: false,
    video: {
      optional: [
       {minWidth:  1280},
       {minHeight: 720}
      ]
    }
  };
}

VideoBandwidthTest.prototype = {
  run: function() {
    var start = function(config) {
      this.call = new Call(config);
      this.call.setIceCandidateFilter(Call.isRelay);
      // FEC makes it hard to study bandwidth estimation since there seems to be
      // a spike when it is enabled and disabled. Disable it for now. FEC issue
      // tracked on: https://code.google.com/p/webrtc/issues/detail?id=3050
      this.call.disableVideoFec();
      this.call.constrainVideoBitrate(this.maxVideoBitrateKbps);
      doGetUserMedia(this.constraints, this.gotStream.bind(this));
    }.bind(this);

    Call.asyncCreateTurnConfig(start, this.test.reportFatal.bind(this.test));
  },

  gotStream: function(stream) {
    this.call.pc1.addStream(stream);
    this.call.establishConnection();
    this.startTime = new Date();
    setTimeout(this.gatherStats.bind(this), this.statStepMs);
  },

  gatherStats: function() {
    var now = new Date();
    if (now - this.startTime > this.durationMs) {
      this.test.setProgress(100);
      this.completed();
    } else {
      this.test.setProgress((now - this.startTime) * 100 / this.durationMs);
      this.call.pc1.getStats(this.gotStats.bind(this));
    }
  },

  gotStats: function(response) {
    for (var index in response.result()) {
      var report = response.result()[index];
      if (report.id === 'bweforvideo') {
        this.bweStats.add(Date.parse(report.timestamp),
          parseInt(report.stat('googAvailableSendBandwidth')));
      } else if (report.type === 'ssrc') {
        this.rttStats.add(Date.parse(report.timestamp),
          parseInt(report.stat('googRtt')));
        // Grab the last stats.
        this.videoStats[0] = parseInt(report.stat('googFrameWidthSent'));
        this.videoStats[1] = parseInt(report.stat('googFrameHeightSent'));
        this.packetsLost = parseInt(report.stat('packetsLost'));
      }
    }
    setTimeout(this.gatherStats.bind(this), this.statStepMs);
  },

  completed: function() {
    this.call.pc1.getLocalStreams()[0].getTracks().forEach(function(track) {
      track.stop();
    });
    this.call.close();
    this.call = null;

    // Checking if greater than 2 because Chrome sometimes reports 2x2 when
    // a camera starts but fails to deliver frames.
    if (this.videoStats[0] < 2 && this.videoStats[1] < 2) {
      this.test.reportError('Camera failure: ' + this.videoStats[0] + 'x' +
          this.videoStats[1] + '. Cannot test bandwidth without a working ' +
          ' camera.');
    } else {
      this.test.reportSuccess('Video resolution: ' + this.videoStats[0] + 'x' +
          this.videoStats[1]);
      this.test.reportInfo('RTT average: ' + this.rttStats.getAverage() +
          ' ms');
      this.test.reportInfo('RTT max: ' + this.rttStats.getMax() + ' ms');
      this.test.reportInfo('Lost packets: ' + this.packetsLost);
      this.test.reportInfo('Send bandwidth estimate average: ' +
          this.bweStats.getAverage() + ' bps');
      this.test.reportInfo('Send bandwidth estimate max: ' +
          this.bweStats.getMax() + ' bps');
      this.test.reportInfo('Send bandwidth ramp-up time: ' +
          this.bweStats.getRampUpTime() + ' ms');
    }
    this.test.done();
  }
};

addExplicitTest(testSuiteName.THROUGHPUT, testCaseName.NETWORKLATENCY,
  Call.asyncCreateTurnConfig.bind(null, wiFiPeriodicScanTest.bind(null,
      Call.isNotHostCandidate), reportFatal));

addExplicitTest(testSuiteName.THROUGHPUT, testCaseName.NETWORKLATENCYRELAY,
  Call.asyncCreateTurnConfig.bind(null, wiFiPeriodicScanTest.bind(null,
      Call.isRelay), reportFatal));

function wiFiPeriodicScanTest(candidateFilter, config) {
  var testDurationMs = 5 * 60 * 1000;
  var sendIntervalMs = 100;
  var running = true;
  var delays = [];
  var recvTimeStamps = [];
  var call = new Call(config);
  var chart = createLineChart();
  call.setIceCandidateFilter(candidateFilter);

  var senderChannel = call.pc1.createDataChannel({ordered: false,
                                                  maxRetransmits: 0});
  senderChannel.addEventListener('open', send);
  call.pc2.addEventListener('datachannel', onReceiverChannel);
  call.establishConnection();

  setTimeoutWithProgressBar(finishTest, testDurationMs);

  function onReceiverChannel(event) {
    event.channel.addEventListener('message', receive);
  }

  function send() {
    if (!running) { return; }
    senderChannel.send('' + Date.now());
    setTimeout(send, sendIntervalMs);
  }

  function receive(event) {
    if (!running) { return; }
    var sendTime = parseInt(event.data);
    var delay = Date.now() - sendTime;
    recvTimeStamps.push(sendTime);
    delays.push(delay);
    chart.addDatapoint(sendTime + delay, delay);
  }

  function finishTest() {
    report.traceEventInstant('periodic-delay', {delays: delays,
        recvTimeStamps: recvTimeStamps});
    running = false;
    call.close();
    chart.parentElement.removeChild(chart);

    var avg = arrayAverage(delays);
    var max = arrayMax(delays);
    var min = arrayMin(delays);
    reportInfo('Average delay: ' + avg + ' ms.');
    reportInfo('Min delay: ' + min + ' ms.');
    reportInfo('Max delay: ' + max + ' ms.');

    if (delays.length < 0.8 * testDurationMs / sendIntervalMs) {
      reportError('Not enough samples gathered. Keep the page on the ' +
          'foreground while the test is running.');
    } else {
      reportSuccess('Collected ' + delays.length + ' delay samples.');
    }

    if (max > (min + 100) * 2) {
      reportError('There is a big difference between the min and max delay ' +
          'of packets. Your network appears unstable.');
    }
    setTestFinished();
  }
}

/*
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';

function RecorderTest() {
  this.theLocalStream = null;
  this.theRemoteStream = null;
  this.theRecorder = null;
  this.eventsMonitored = null;
  // Note: ondataavailable is not in the list below because it is necessary to
  // have it always on if we ever want to playbabk/download the recording in a
  // consistent manner.
  this.RECORDER_EVENTS = ['onstart', 'onpause', 'onresume', 'onstop',
      'onerror'];
  this.eventCounter = 0;
  this.recordedData = {};
  this.timeDataReceived = null;
}

RecorderTest.prototype = {
  // This function sets up the different event handlers necessary to run the
  // ui.
  setup: function() {
    this.onButtonClick('GetUserMedia', this.getUserMedia.bind(this));
    this.onButtonClick('CreatePeerConnection', this.createPeerConnection.bind(
        this));
    this.onButtonClick('CreateRecorder', this.createRecorder.bind(this));
    this.onButtonClick('Start', this.startRecorder.bind(this));
    this.onButtonClick('Pause', this.pauseRecorder.bind(this));
    this.onButtonClick('Resume', this.resumeRecorder.bind(this));
    this.onButtonClick('Stop', this.stopRecorder.bind(this));
    this.onButtonClick('RequestData', this.requestDataRecorder.bind(this));
    this.onButtonClick('Playback', this.playback.bind(this));
    this.onButtonClick('Download', this.download.bind(this));
    var monitorSelect = document.getElementById('monitorEvents');
    monitorSelect.onchange = this.monitorRecorderEvents.bind(this, event);
  },

  // This function creates a button onClick event handler.
  onButtonClick: function(buttonName, callBack) {
    console.log('button name', buttonName);
    document.getElementsByName(buttonName)[0].addEventListener('click',
        callBack);
  },

  // This function configures the event handlers of media recorder.
  monitorRecorderEvents: function(event) {
    console.log('monitor debug:', event);
    if (!this.theRecorder) {
      alert('No recorder initialized!');
      return;
    }
    if (this.eventsMonitored) {
      this.recorderEventHandlersAction('remove', this.eventsMonitored);
    }
    var eventName = event.path[0].value;
    if (eventName) {
      this.recorderEventHandlersAction('add', eventName);
    }
    this.eventsMonitored = eventName;
  },

  // This function gets the selected value of a <select> element.
  getSelectedValue: function(id) {
    var e = document.getElementById(id);
    return e.options[e.selectedIndex].value;
  },

  // This function builds the basic gUM constraints from the
  // selected GetUserMedia options in html.
  buildConstraints: function(audioEnabled, videoEnabled, resolution) {
    var constraints = {audio: false, video: false};
    var res = resolution.split('x');
    var width = res[0];
    var height = res[1];
    if (height && videoEnabled) {
      constraints.video = {mandatory: {
        minWidth: width,
        minHeight: height,
        maxWidth: width,
        maxHeight: height
      }};
    } else if (videoEnabled) {
      constraints.video = true;
    }
    if (audioEnabled) {
      constraints.audio = true;
    }
    return constraints;
  },

  // This function returns true if the string provided is equal to 'true'.
  // Otherwise it returns false.
  isTrue: function(someString) {
    return someString === 'true';
  },

  // This function performs a gUM request and populates the local stream as
  // well as the localVideo tag.
  getUserMedia: function() {
    var enableAudio = this.isTrue(this.getSelectedValue('enableAudio'));
    var enableVideo = this.isTrue(this.getSelectedValue('enableVideo'));
    var resolution = this.getSelectedValue('resolution');
    var constraints = this.buildConstraints(enableAudio, enableVideo,
        resolution);
    var me = this;
    navigator.mediaDevices.getUserMedia(constraints)
      .then(function(stream) {
        document.getElementById('localVideo').src = URL.createObjectURL(stream);
        me.theLocalStream = stream;
        me.onButtonClick('StopLocalStream', me.stopStream.bind(me,
            me.theLocalStream));
        me.onButtonClick('StopLocalVideoTrack', me.stopStream.bind(me,
            me.theLocalStream, 'video'));
        me.onButtonClick('StopLocalAudioTracks', me.stopStream.bind(me,
            me.theLocalStream, 'audio'));
      });
  },

  // This function stops a either a whole stream, or video tracks or audio
  // tracks from that stream.
  stopStream: function(stream, tracksType) {
    return new Promise(function(resolve, reject) {
      var tracks = null;
      if (!stream) {
        alert('Stream is not initialized!');
        reject();
      }
      if (tracksType === 'video') {
        tracks = stream.getVideoTracks();
      } else if (tracksType === 'audio') {
        tracks = stream.getAudioTracks();
      } else {
        tracks = stream.getTracks();
      }
      tracks.forEach(function(track) {
        track.stop();
      });
      resolve();
    });
  },

  // This function builds the media recorder's configuration.
  buildRecorderConfig: function() {
    var options = {};
    console.log('in builder, this=', this);
    var stream = this.getSelectedValue('recordedStream');
    var audioBitrate = this.getSelectedValue('audioBitrate');
    var videoCodec = this.getSelectedValue('videoCodec');
    var videoBitrate = this.getSelectedValue('videoBitrate');
    var overallBitrate = this.getSelectedValue('overallAvBitrate');
    if (stream === 'local') {
      stream = this.theLocalStream;
    } else {
      stream = this.theRemoteStream;
    }
    if (!stream) {
      return null;
    }
    if (audioBitrate && !overallBitrate) {
      options.audioBitsPerSecond = audioBitrate;
    }
    if (videoBitrate && !overallBitrate) {
      options.videoBitsPerSecond = videoBitrate;
    }
    if (overallBitrate) {
      options.bitsPerSecond = overallBitrate;
    }
    if (videoCodec) {
      options.mimeType = 'video/webm; codecs="' + videoCodec + '"';
    }
    return [stream, options];
  },

  // This function creates the media recorder instance, configures the
  // ignoreMutedMedia parameter and sets a handler to save the recording.
  createRecorder: function() {
    var config = this.buildRecorderConfig();
    console.log('recorder config', config);
    var ON_DATA_AVAILABLE = 'ondataavailable';
    if (!config) {
      alert('Cannot create recorder without a stream!');
      return;
    }
    var stream = config[0];
    var options = config[1];
    var ignoreMutedMedia = this.isTrue(this.getSelectedValue('ignoreMuted'));
    var me = this;
    this.createMediaRecorderInstance(stream, options)
        .then(function(recorder) {
          me.theRecorder = recorder;
          me.theRecorder.ignoreMutedMedia = ignoreMutedMedia;
          me.theRecorder[ON_DATA_AVAILABLE] = function(event) {
            me.computeAndDisplayEventCount(ON_DATA_AVAILABLE);
            if (event.data && event.data.size > 0) {
              me.recordedData.push(event.data);
              me.timeDataReceived.push(new Date());
            }};
          // Keep track of recorder state in UI every 500ms.
          setInterval(function() {me.displayRecorderState();}, 500);
        });
  },

  // This function starts the media recorder.
  // If a time slice is selected, the function will configure the
  // recorder time slice when starting recorder.
  startRecorder: function() {
    if (!this.theRecorder) {
      alert('Recorder not initialized!');
      return;
    }
    this.recordedData = [];
    this.timeDataReceived = [];
    this.eventCounter = {};
    var timeSlice = this.getSelectedValue('timeSlice');
    if (timeSlice) {
      this.theRecorder.start(timeSlice);
    } else {
      this.theRecorder.start();
    }
    this.displayRecorderState();
  },

  // This function pauses the media recorder.
  pauseRecorder: function() {
    if (!this.theRecorder) {
      alert('Recorder not initialized!');
      return;
    }
    this.theRecorder.pause();
    this.displayRecorderState();
  },

  // This function resumes the media recorder.
  resumeRecorder: function() {
    if (!this.theRecorder) {
      alert('Recorder not initialized!');
      return;
    }
    this.theRecorder.resume();
    this.displayRecorderState();
  },

  // This function stops the media recorder.
  stopRecorder: function() {
    if (!this.theRecorder) {
      alert('Recorder not initialized!');
      return;
    }
    this.theRecorder.stop();
    this.displayRecorderState();
    this.displayBitrateEstimate();
  },

  // This function requests a blob from media recorder.
  requestDataRecorder: function() {
    if (!this.theRecorder) {
      alert('Recorder not initialized!');
      return;
    }
    this.theRecorder.requestData();
  },

  // This function adds/removes the recorder's event handlers.
  recorderEventHandlersAction: function(action, eventName) {
    var events = [];
    if (eventName === 'all') {
      events = this.RECORDER_EVENTS;
    } else {
      events = [eventName];
    }
    events.forEach(function(event) {
      if (action === 'remove') {
        this.theRecorder[event] = null;
        this.computeAndDisplayEventCount(event, true);
      } else {
        this.theRecorder[event] = function() {this.computeAndDisplayEventCount(
            event);};
      }
    });
  },

  // This function computes and displays the recorder events counts.
  computeAndDisplayEventCount: function(eventName, initialize) {
    // TODO(cpaulin): see if this can be used for more than the event counts.
    if (initialize) {
      this.eventCounter[eventName] = 0;
    } else if (this.eventCounter[eventName]) {
      this.eventCounter[eventName] += 1;
    } else {
      this.eventCounter[eventName] = 1;
    }
    document.getElementById(eventName + 'Count').value = this.eventCounter[
        eventName];
  },

  // This function displays the media recoder's state.
  displayRecorderState: function() {
    document.getElementById('recorderState').value = this.theRecorder.state;
  },

  // This function attempts to estimate the overall bitrate of the recording.
  // It then displays the estimate in UI.
  displayBitrateEstimate: function() {
    var dataSize = 0;
    this.recordedData.forEach(function(data) {
      dataSize += data.size;
    });
    var deltaTime = this.timeDataReceived.pop() - this.timeDataReceived.shift();
    if (!deltaTime) {
      return;
    }
    // Time is in ms, size is in bytes.
    var bitrateEstimate = dataSize / deltaTime * 8 * 1000;
    document.getElementById('bitrateEstimate').value = bitrateEstimate;
  },

  // This function playsback the recording.
  playback: function() {
    if (!this.recordedData.length) {
      alert('No recording found!');
      return;
    }
    var videoBlob = new Blob(this.recordedData, {type: 'video/webm'});
    document.getElementById('playbackVideo').src = window.URL.createObjectURL(
        videoBlob);
  },

  download: function() {
    if (!this.recordedData.length) {
      alert('No recording found!');
      return;
    }
    var videoBlob = new Blob(this.recordedData, {type: 'video/webm'});
    var url = window.URL.createObjectURL(videoBlob);
    var downloader = document.createElement('a');
    downloader.style.display = 'none';
    downloader.href = url;
    downloader.download = 'test.webm';
    document.body.appendChild(downloader);
    downloader.click();
    setTimeout(function() {
      document.body.removeChild(downloader);
      window.URL.revokeObjectURL(url);
    }, 100);
  },

  // This function creates the local peer connection and saves the
  // remote stream object.
  createPeerConnection: function(stream) {
    if (!this.theLocalStream) {
      alert('No local stream initialized!');
      return;
    }
    var me = this;
    this.setupPeerConnection(this.theLocalStream)
        .then(function(stream) {
          me.theRemoteStream = stream;
          me.onButtonClick('StopRemoteStream', me.stopStream.bind(me,
              me.theRemoteStream));
          me.onButtonClick('StopRemoteVideoTrack', me.stopStream.bind(me,
              me.theRemoteStream, 'video'));
          me.onButtonClick('StopRemoteAudioTracks', me.stopStream.bind(me,
              me.theRemoteStream, 'audio'));
        })
        .catch(function(error) {
          alert('Peer Connection setup failed: ' + error);
        });
  },

  // This function is called by createPeerConnection and is responsible for the
  // actual setting of the local peer connection.
  setupPeerConnection: function(stream) {
    return new Promise(function(resolve, reject) {
      var localStream = stream;
      var remoteStream = null;
      var localPeerConnection = new RTCPeerConnection(null);
      var remotePeerConnection = new RTCPeerConnection(null);

      function createAnswer(description) {
        remotePeerConnection.createAnswer(function(description) {
          remotePeerConnection.setLocalDescription(description);
          localPeerConnection.setRemoteDescription(description);
        }, function(error) { alert(error.toString()); });
      }

      if (!localStream) {
        reject('Stream not initialized!!');
      }
      localPeerConnection.onicecandidate = function(event) {
        if (event.candidate) {
          remotePeerConnection.addIceCandidate(new RTCIceCandidate(
              event.candidate));
        }
      };
      remotePeerConnection.onicecandidate = function(event) {
        if (event.candidate) {
          localPeerConnection.addIceCandidate(new RTCIceCandidate(
              event.candidate));
        }
      };
      remotePeerConnection.onaddstream = function(event) {
        document.getElementById('remoteVideo').src = URL.createObjectURL(
            event.stream);
        remoteStream = event.stream;
        resolve(remoteStream);
      };

      localPeerConnection.addStream(localStream);

      localPeerConnection.createOffer(function(description) {
        localPeerConnection.setLocalDescription(description);
        remotePeerConnection.setRemoteDescription(description);
        createAnswer(description);
      }, function(error) { alert(error.toString()); });
    });
  },

  // This function creates a media recorder instance.
  createMediaRecorderInstance: function(stream, options) {
    return new Promise(function(resolve, reject) {
      var recorder = new MediaRecorder(stream, options);
      console.log('Recorder object created.');
      resolve(recorder);
    });
  },
};

var test = new RecorderTest();
test.setup();

window.onerror = function(message, filename, lineno, colno, error) {
  console.log('Something went wrong, here is the stack trace --> %s',
    error.stack);
};

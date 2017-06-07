/*
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';
var theLocalStream = null;
var theRemoteStream = null;
var theRecorder = null;
var eventsMonitored = null;
// Note: ondataavailable is not in the list below because it is necessary to
// have it always on if we ever want to playbabk/download the recording in a
// consistent manner.
var RECORDER_EVENTS = ['onstart', 'onpause', 'onresume', 'onstop', 'onerror'];
var eventCounter;
var recordedData;
var timeDataReceived;

// This function gets the selected value of a <select> element.
function getSelectedValue(id) {
  var e = document.getElementById(id);
  return e.options[e.selectedIndex].value;
}

// This function builds the basic gUM constraints from the
// selected GetUserMedia options in html.
function buildConstraints(audioEnabled, videoEnabled, resolution) {
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
}

// This function returns true if the string provided is equal to 'true'.
// Otherwise it returns false.
function isTrue(someString) {
 if (someString == 'true') {
   return true;
 } else {
   return false;
 }
}

// This function performs a gUM request and populates the local stream as
// well as the local_video tag.
function getUserMedia() {
 var enableAudio = isTrue(getSelectedValue('enable_audio'));
 var enableVideo = isTrue(getSelectedValue('enable_video'));
 var resolution = getSelectedValue('resolution');
 var constraints = buildConstraints(enableAudio, enableVideo, resolution);

 navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      document.getElementById('local_video').src = URL.createObjectURL(stream);
      theLocalStream = stream;
    });
}

// This function stops a either a whole stream, or video tracks or audio tracks
// from that stream.
function stopStream(stream, tracksType) {
  return new Promise(function(resolve, reject) {
    var tracks = null;
    if (!stream) {
      alert('Stream is not initialized!');
      reject();
    }
    if (tracksType == 'video') {
      tracks = stream.getVideoTracks();
    } else if (tracksType == 'audio') {
      tracks = stream.getAudioTracks();
    } else {
      tracks = stream.getTracks();
    }
    tracks.forEach(function(track) {
        track.stop();
    });
    resolve();
  });
}

// This function builds the media recorder's configuration.
function buildRecorderConfig() {
  var options = {};
  var stream = getSelectedValue('recorded_stream');
  var audioBitrate = getSelectedValue('audio_bitrate');
  var videoCodec = getSelectedValue('video_codec');
  var videoBitrate = getSelectedValue('video_bitrate');
  var overallBitrate = getSelectedValue('overall_av_bitrate');
  if (stream == 'local') {
    stream = theLocalStream;
  } else {
    stream = theRemoteStream;
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
}

// This function creates the media recorder instance, configures the
// ignoreMutedMedia parameter and sets a handler to save the recording.
function createRecorder() {
  var config = buildRecorderConfig();
  var ON_DATA_AVAILABLE = 'ondataavailable';
  if (!config) {
    alert('Cannot create recorder without a stream!');
    return;
  }
  var stream = config[0];
  var options = config[1];
  var ignoreMutedMedia = isTrue(getSelectedValue('ignore_muted'));
  createMediaRecorderInstance(stream, options)
      .then(function(recorder) {
        theRecorder = recorder;
        theRecorder.ignoreMutedMedia = ignoreMutedMedia;
        theRecorder[ON_DATA_AVAILABLE] = function(event) {
            computeAndDisplayEventCount(ON_DATA_AVAILABLE);
            if (event.data && event.data.size > 0) {
              recordedData.push(event.data);
              timeDataReceived.push(new Date());
            }};
        // Keep track of recorder state in UI every 500ms.
        setInterval(function() {displayRecorderState();}, 500);
      });
}

// This function starts the media recorder.
// If a time slice is selected, the function will configure the
// recorder time slice when starting recorder.
function startRecorder() {
  if (!theRecorder) {
    alert('Recorder not initialized!');
    return;
  }
  recordedData = [];
  timeDataReceived = [];
  eventCounter = {};
  var timeSlice = getSelectedValue('time_slice');
  if (timeSlice) {
    theRecorder.start(timeSlice);
  } else {
    theRecorder.start();
  }
  displayRecorderState();
}

// This function pauses the media recorder.
function pauseRecorder() {
  if (!theRecorder) {
    alert('Recorder not initialized!');
    return;
  }
  theRecorder.pause();
  displayRecorderState();
}

// This function resumes the media recorder.
function resumeRecorder() {
  if (!theRecorder) {
    alert('Recorder not initialized!');
    return;
  }
  theRecorder.resume();
  displayRecorderState();
}

// This function stops the media recorder.
function stopRecorder() {
  if (!theRecorder) {
    alert('Recorder not initialized!');
    return;
  }
  theRecorder.stop();
  displayRecorderState();
  displayBitrateEstimate();
}

// This function requests a blob from media recorder.
function requestDataRecorder() {
  if (!theRecorder) {
    alert('Recorder not initialized!');
    return;
  }
  theRecorder.requestData();
}

// This function configures the event handlers of media recorder.
function monitorRecorderEvents(eventName) {
  if (!theRecorder) {
    alert('No recorder initialized!');
    return;
  }
  if (eventsMonitored) {
    recorderEventHandlersAction('remove', eventsMonitored);
  }
  if (eventName)
    recorderEventHandlersAction('add', eventName);
  eventsMonitored = eventName;
}

// This function adds/removes the recorder's event handlers.
function recorderEventHandlersAction(action, eventName) {
  var events = [];
  if (eventName == 'all') {
    events = RECORDER_EVENTS;
  } else {
    events = [eventName];
  }
  events.forEach(function(event) {
      if (action == 'remove') {
        theRecorder[event] = null;
        computeAndDisplayEventCount(event, true);
      } else {
        theRecorder[event] = function() {computeAndDisplayEventCount(event);};
      }
  });
}

// This function computes and displays the recorder events counts.
function computeAndDisplayEventCount(eventName, initialize) {
  // TODO(cpaulin): see if this can be used for more than the event counts.
  if (initialize) {
    eventCounter[eventName] = 0;
  } else if (eventCounter[eventName]) {
    eventCounter[eventName] += 1;
  } else {
    eventCounter[eventName] = 1;
  }
  document.getElementById(eventName + '_count').value = eventCounter[eventName];
}

// This function displays the media recoder's state.
function displayRecorderState() {
  document.getElementById('recorder_state').value = theRecorder.state;
}

// This function attempts to estimate the overall bitrate of the recording.
// It then displays the estimate in UI.
function displayBitrateEstimate() {
  var dataSize = 0;
  recordedData.forEach(function(data) {
    dataSize += data.size;
  });
  var deltaTime = timeDataReceived.pop() - timeDataReceived.shift();
  if (!deltaTime)
    return;
  // Time is in ms, size is in bytes.
  var bitrateEstimate = dataSize / deltaTime * 8 * 1000;
  document.getElementById('bitrate_estimate').value = bitrateEstimate;
}

// This function playsback the recording.
function playback() {
  if (!recordedData.length) {
    alert('No recording found!');
    return;
  }
  var videoBlob = new Blob(recordedData, {type: 'video/webm'});
  playback_video.src = window.URL.createObjectURL(videoBlob);
}

function download() {
  if (!recordedData.length) {
    alert('No recording found!');
    return;
  }
  var videoBlob = new Blob(recordedData, {type: 'video/webm'});
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
}

// This function creates the local peer connection and saves the
// remote stream object.
function createPeerConnection(stream) {
  if (!theLocalStream) {
    alert('No local stream initialized!');
    return;
  }
  setupPeerConnection(theLocalStream)
      .then(function(stream) {
        theRemoteStream = stream;
      })
      .catch(function(error) {
        alert('Peer Connection setup failed: ' + error);
      });
}

// This function is called by createPeerConnection and is responsible for the
// actual setting of the local peer connection.
function setupPeerConnection(stream) {
  return new Promise(function(resolve, reject) {
    var localStream = stream;
    var remoteStream = null;
    var localPeerConnection = new webkitRTCPeerConnection(null);
    var remotePeerConnection = new webkitRTCPeerConnection(null);

    function createAnswer(description) {
      remotePeerConnection.createAnswer(function(description) {
        remotePeerConnection.setLocalDescription(description);
        localPeerConnection.setRemoteDescription(description);
      }, function(error) { alert(error.toString()); });
    }

    if (!localStream)
      reject('Stream not initialized!!');

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
      document.getElementById('remote_video').src = URL.createObjectURL(
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
}

// This function creates a media recorder instance.
function createMediaRecorderInstance(stream, options) {
  return new Promise(function(resolve, reject) {
    var recorder = new MediaRecorder(stream, options);
    console.log('Recorder object created.');
    resolve(recorder);
  });
}

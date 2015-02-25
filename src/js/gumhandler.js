/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */
/* exported GumHandler */
'use strict';

function GumHandler() {
  this.gumPendingDialog_ = document.getElementById('gum-pending-dialog');
  this.gumErrorDialog_ = document.getElementById('gum-error-dialog');
  this.gumNotSupportedDialog_ =
      document.getElementById('gum-not-supported-dialog');
  this.gumErrorMessage_ = document.getElementById('gum-error-message');
  this.firstUserCheck_ = null;
  this.gumStreamSuccessCallback_ = null;
  this.gumBypassed_ = false;
  this.gumBypassButton_ = document.getElementById('gum-bypass');
  this.gumBypassButton_.addEventListener('click', function() {
    this.gumBypassed_ = true;
  }.bind(this));

}

GumHandler.prototype = {
  start: function(callback) {
    this.gumStreamSuccessCallback_ = callback;
    if (typeof navigator.getUserMedia === 'undefined') {
      this.gumNotSupportedDialog_.open();
    } else {
      this.getUserMedia_(callback);
      this.firstUserCheck_ = setTimeout(this.firstTimeUser_.bind(this), 300);
    }
  },

  firstTimeUser_: function() {
    this.gumPendingDialog_.open();
  },

  getUserMedia_: function() {
    var constraints = {};
    if (typeof MediaStreamTrack.getSources !== 'undefined') {
      MediaStreamTrack.getSources(function(sources) {
        for (var l = 0; l < sources.length; l++) {
          if (sources[l].kind === 'audio') {
            constraints.audio = true;
          }
          if (sources[l].kind === 'video') {
            constraints.video = true;
          }
          if (l === sources.length - 1) {
            doGetUserMedia(constraints, this.gotStream_.bind(this),
                this.gotError_.bind(this));
          }
        }
        if (sources.length === 0) {
          doGetUserMedia({audio: true, video: true}, this.gotStream_.bind(this),
              this.gotError_.bind(this));
        }
      }.bind(this));
    } else {
      //If the browser does not have getSources support fall back to default.
      doGetUserMedia({audio: true, video: true}, this.gotStream_.bind(this),
          this.gotError_.bind(this));
    }
  },

  gotStream_: function(stream) {
    clearTimeout(this.firstUserCheck_);

    // Stop all tracks to ensure the camera and audio devices are shutdown
    // directly.
    for (var i = 0; i < stream.getVideoTracks().length; i++) {
      stream.getVideoTracks()[i].stop();
    }
    for (var j = 0; j < stream.getAudioTracks().length; j++) {
      stream.getAudioTracks()[j].stop();
    }
    this.gumPendingDialog_.close();
    this.gumErrorDialog_.close();
    this.gumStreamSuccessCallback_();
  },

  gotError_: function(error) {
    console.log(error.name);
    clearTimeout(this.firstUserCheck_);
    this.gumPendingDialog_.close();
    if (!this.gumBypassed_) {
      this.gumNoDeviceDialog_.close();
      this.gumErrorMessage_.innerHTML = error.name;
      this.gumErrorDialog_.open();
    } else if (this.gumBypassed_) {
      var traceGumBypassed = report.traceEventAsync('getusermedia');
      traceGumBypassed('User has bypassed gum.');
      // Rename the callback to correspond to the correct status.
      this.gumBypassCallback_ = this.gumStreamSuccessCallback_;
      this.gumBypassCallback_();
      return;
    }
    setTimeout(this.getUserMedia_.bind(this), 1000);
  }
};

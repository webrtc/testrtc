"use strict";

//
// PeerConnection
//
function NewPeerConnection() {
  var pc = new RTCPeerConnection();

  function OutsidePromise() {
    var outsideResolve;
    var outsideReject;
    var p = new Promise(function(resolve, reject) {
      outsideResolve = resolve;
      outsideReject = reject;
    });
    p.resolve = outsideResolve;
    p.reject = outsideReject;
    return p;
  }

  var iceCandidates = [];
  var iceCandidatesPromise = OutsidePromise();

  pc.iceCandidatesPromise = iceCandidatesPromise;

  pc.onnegotiationneeded = function(event) {
    console.log("onnegotiationneeded");
  }

  pc.onicecandidate = function(event) {
    console.log("onicecandidate");
    if(event.candidate) {
      iceCandidates.push(event.candidate);
    } else {
      console.log("End of ICE candidates");
      iceCandidatesPromise.resolve(iceCandidates);
    }
  }

  pc.onicecandidateerror = function(event) {
    console.log("onicecandidateerror");
  }

  pc.onsignalingstatechange = function(event) {
    console.log("onsignalingstatechange: " + event.target.signalingState);
  }

  pc.iceconnectionstatechange = function(event) {
    console.log("iceconnectionstatechange: " + event.target.iceConnectionState);
  }

  pc.icegatheringstatechange = function(event) {
    console.log("icegatheringstatechange: " + event.target.iceGatheringState);
  }

  pc.onconnectionstatechange = function(event) {
    console.log("onconnectionstatechange: " + event.target.connectionState);
  }

  return pc;
}

function Base64Encode(str, encoding = 'utf-8') {
    var bytes = new (TextEncoder || TextEncoderLite)(encoding).encode(str);
    return base64js.fromByteArray(bytes);
}

function b64EncodeUnicode(str) {
    // first we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
                                                function toSolidBytes(match, p1) {
                                                    return String.fromCharCode('0x' + p1);
                                                }));
}


//
// LegionAPI
//
var Legion = {
  noterror: function(json) {
    if(json.janus === 'error') {
      var e = json.error;
      var msg = "Legion API error: " + e.code + " " + e.reason;
      console.error(msg);
      return Promise.reject(msg);
    }
    return json;
  },

  GET: function(url) {
    var request = new Request(url, {
      method: "GET",
      mode: "cors",
      cache: "no-cache",
    });

    return fetch(request).then(function(response) {
      return response.json();
    }).then(this.noterror);
  },

  POST: function(url, object) {
    var headers = new Headers();
    var request = new Request(url, {
      method: "POST",
      mode: "cors",
      headers: headers,
      cache: "no-cache",
      body: JSON.stringify(object)
    });

    return fetch(request).then(function(response) {
      return response.json();
    }).then(this.noterror);
  },

  PUT: function(url, object) {
    var headers = new Headers();
    var request = new Request(url, {
      method: "PUT",
      mode: "cors",
      headers: headers,
      cache: "no-cache",
      body: JSON.stringify(object)
    });

    return fetch(request).then(function(response) {
      return response.json();
    }).then(this.noterror);
  },

  DELETE: function(url, object) {
    var headers = new Headers();
    headers.append("Content-Type", "application/json");

    var request = new Request(url, {
      method: "DELETE",
      mode: "cors",
      headers: headers,
      cache: "no-cache",
      body: JSON.stringify(object)
    });

    return fetch(request).then(function(response) {
      return response.json();
    }).then(this.noterror);
  }
};
